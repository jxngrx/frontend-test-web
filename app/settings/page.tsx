/**
 * Settings Page
 *
 * Profile management, device management, session management,
 * contact sync, and location settings
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getProfile, updateUsername, updatePhone, User } from '../api/users';
import { getUserDevices, Device } from '../api/devices';
import { getUserSessions, deactivateSession, deactivateAllSessions, Session } from '../api/sessions';
import { getContacts, Contact } from '../api/contacts';
import { getLastKnownLocation, Location } from '../api/location';
import { hashPhoneNumbers } from '../utils/crypto';

const STORAGE_KEY = 'chat_session';

export default function SettingsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [lastLocation, setLastLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [phoneNumbers, setPhoneNumbers] = useState('');
  const [syncingContacts, setSyncingContacts] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const savedSession = localStorage.getItem(STORAGE_KEY);
        if (!savedSession) {
          router.push('/login');
          return;
        }

        const session = JSON.parse(savedSession);
        if (!session.token) {
          router.push('/login');
          return;
        }

        setToken(session.token);

        // Load all data in parallel
        const [profile, userDevices, userSessions, userContacts, location] = await Promise.all([
          getProfile(session.token).catch(() => null),
          getUserDevices(session.token).catch(() => []),
          getUserSessions(session.token).catch(() => []),
          getContacts(session.token).catch(() => []),
          getLastKnownLocation(session.token).catch(() => null),
        ]);

        if (profile) {
          setUser(profile);
          setNewUsername(profile.username || '');
          setNewPhone(profile.phone || '');
        }
        setDevices(userDevices);
        setSessions(userSessions);
        setContacts(userContacts);
        setLastLocation(location);
      } catch (err: any) {
        setError('Failed to load settings');
        console.error('Settings load error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [router]);

  const handleUpdateUsername = async () => {
    if (!token || !newUsername.trim()) {
      setError('Username cannot be empty');
      return;
    }

    if (newUsername.length < 3 || newUsername.length > 30) {
      setError('Username must be between 3 and 30 characters');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
      setError('Username can only contain letters, numbers, and underscores');
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      await updateUsername(token, newUsername);
      const updatedProfile = await getProfile(token);
      setUser(updatedProfile);
      setSuccess('Username updated successfully');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update username');
    }
  };

  const handleUpdatePhone = async () => {
    if (!token || !newPhone.trim()) {
      setError('Phone number cannot be empty');
      return;
    }

    // Basic validation
    if (!/^\+?[1-9]\d{1,14}$/.test(newPhone.replace(/\s/g, ''))) {
      setError('Please enter a valid phone number (E.164 format)');
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      await updatePhone(token, newPhone);
      const updatedProfile = await getProfile(token);
      setUser(updatedProfile);
      setSuccess('Phone number updated successfully');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update phone number');
    }
  };

  const handleSyncContacts = async () => {
    if (!token || !phoneNumbers.trim()) {
      setError('Please enter at least one phone number');
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      setSyncingContacts(true);

      // Parse phone numbers (comma or newline separated)
      const phones = phoneNumbers
        .split(/[,\n]/)
        .map(p => p.trim())
        .filter(p => p.length > 0);

      if (phones.length === 0) {
        setError('Please enter at least one phone number');
        return;
      }

      // Hash phone numbers
      const phoneHashes = await hashPhoneNumbers(phones);

      // Import syncContacts function
      const { syncContacts } = await import('../api/contacts');
      const syncedContacts = await syncContacts(token, phoneHashes);

      setContacts(syncedContacts);
      setPhoneNumbers('');
      setSuccess(`Synced ${syncedContacts.length} contact(s)`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to sync contacts');
    } finally {
      setSyncingContacts(false);
    }
  };

  const handleDeactivateSession = async (sessionId: string) => {
    if (!token) return;

    try {
      setError(null);
      await deactivateSession(token, sessionId);
      const updatedSessions = await getUserSessions(token);
      setSessions(updatedSessions);
      setSuccess('Session deactivated');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to deactivate session');
    }
  };

  const handleLogoutAll = async () => {
    if (!token) return;

    if (!confirm('Are you sure you want to logout from all devices?')) {
      return;
    }

    try {
      setError(null);
      await deactivateAllSessions(token);
      localStorage.removeItem(STORAGE_KEY);
      router.push('/login');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to logout');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Settings</h1>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
          >
            Back to Chats
          </button>
        </div>

        {error && (
          <div className="bg-red-900 text-red-100 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-900 text-green-100 px-4 py-3 rounded mb-4">
            {success}
          </div>
        )}

        {/* Profile Section */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Profile</h2>
          {user && (
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 mb-2">Phone</label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+1234567890"
                    className="flex-1 px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleUpdatePhone}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
                  >
                    Update
                  </button>
                </div>
              </div>
              {user.email && (
                <div>
                  <label className="block text-gray-300 mb-2">Email</label>
                  <div className="text-gray-400">{user.email}</div>
                </div>
              )}
              <div>
                <label className="block text-gray-300 mb-2">Auth Method</label>
                <div className="text-gray-400">{user.authMethod || 'phone'}</div>
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Username</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Enter username"
                    className="flex-1 px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleUpdateUsername}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
                  >
                    Update
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Device Management */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Devices ({devices.length})</h2>
          {devices.length === 0 ? (
            <div className="text-gray-400">No devices registered</div>
          ) : (
            <div className="space-y-4">
              {devices.map((device) => (
                <div key={device.id} className="bg-gray-700 rounded p-4">
                  <div className="font-semibold">{device.deviceModel}</div>
                  <div className="text-sm text-gray-400">
                    {device.manufacturer} • {device.osName} {device.osVersion}
                  </div>
                  <div className="text-sm text-gray-400">
                    Platform: {device.platform} • App: {device.appVersion}
                  </div>
                  {device.createdAt && (
                    <div className="text-xs text-gray-500 mt-2">
                      Registered: {new Date(device.createdAt).toLocaleString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Session Management */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Active Sessions ({sessions.length})</h2>
          {sessions.length === 0 ? (
            <div className="text-gray-400">No active sessions</div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => (
                <div key={session.sessionId} className="bg-gray-700 rounded p-4 flex justify-between items-center">
                  <div>
                    <div className="font-semibold">Device: {session.deviceId.substring(0, 8)}...</div>
                    <div className="text-sm text-gray-400">
                      Login: {session.loginMethod} • Expires: {new Date(session.expiresAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeactivateSession(session.sessionId)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm"
                  >
                    Deactivate
                  </button>
                </div>
              ))}
              <button
                onClick={handleLogoutAll}
                className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
              >
                Logout from All Devices
              </button>
            </div>
          )}
        </div>

        {/* Contact Sync */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">
            Contacts ({contacts.length})
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-gray-300 mb-2">
                Phone Numbers (comma or newline separated)
              </label>
              <textarea
                value={phoneNumbers}
                onChange={(e) => setPhoneNumbers(e.target.value)}
                placeholder="+1234567890, +0987654321"
                className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
                disabled={syncingContacts}
              />
            </div>
            <button
              onClick={handleSyncContacts}
              disabled={syncingContacts}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
            >
              {syncingContacts ? 'Syncing...' : 'Sync Contacts'}
            </button>
            {contacts.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold mb-2">Synced Contacts:</h3>
                <div className="space-y-2">
                  {contacts.map((contact) => (
                    <div key={contact.userId} className="bg-gray-700 rounded p-2">
                      <div className="font-semibold">{contact.username || contact.phone}</div>
                      <div className="text-sm text-gray-400">
                        {contact.phone} {contact.isOnline ? '• Online' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Location Settings */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Location</h2>
          {lastLocation ? (
            <div className="space-y-2">
              <div className="text-gray-300">
                Last Known Location:
              </div>
              <div className="text-gray-400">
                {lastLocation.latitude.toFixed(6)}, {lastLocation.longitude.toFixed(6)}
              </div>
              {lastLocation.accuracy && (
                <div className="text-sm text-gray-500">
                  Accuracy: {Math.round(lastLocation.accuracy)}m
                </div>
              )}
              {lastLocation.timestamp && (
                <div className="text-sm text-gray-500">
                  Updated: {new Date(lastLocation.timestamp).toLocaleString()}
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-400">No location data available</div>
          )}
        </div>

        {/* Logout */}
        <div className="bg-gray-800 rounded-lg p-6">
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
