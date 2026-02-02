/**
 * Login Page
 *
 * Updated authentication page with:
 * - Password-based login
 * - Registration with optional username/phone
 * - Device registration (handled automatically)
 * - Session creation
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { login, register } from '../api/auth';

const STORAGE_KEY = 'chat_session';

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Login State
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register State
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Check if already authenticated
  useEffect(() => {
    const savedSession = localStorage.getItem(STORAGE_KEY);
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        if (session.token && session.userId) {
          router.push('/');
        }
      } catch (e) {
        // Invalid session, continue
      }
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername || !loginPassword) {
      setError('Username and password are required');
      return;
    }

    try {
      setError(null);
      setLoading(true);

      const response = await login({
        username: loginUsername,
        password: loginPassword,
      });

      const { token, user } = response.data;

      // Save session
      const session = {
        token,
        userId: user.id,
        username: user.username,
        phone: user.phone,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));

      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regPassword) {
      setError('Password is required');
      return;
    }
    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      setError(null);
      setLoading(true);

      const response = await register({
        username: regUsername || undefined,
        password: regPassword,
        phone: regPhone || undefined,
      });

      const { token, user } = response.data;

      // Save session
      const session = {
        token,
        userId: user.id,
        username: user.username,
        phone: user.phone,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));

      setSuccessMsg('Registration successful! Redirecting...');
      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (tab: 'login' | 'register') => {
    setActiveTab(tab);
    setError(null);
    setSuccessMsg(null);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex border-b border-gray-700">
          <button
            className={`flex-1 py-4 text-center font-medium ${
              activeTab === 'login'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-gray-200 bg-gray-750'
            }`}
            onClick={() => switchTab('login')}
          >
            Login
          </button>
          <button
            className={`flex-1 py-4 text-center font-medium ${
              activeTab === 'register'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-gray-200 bg-gray-750'
            }`}
            onClick={() => switchTab('register')}
          >
            Register
          </button>
        </div>

        <div className="p-8">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            {activeTab === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>

          {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-100 px-4 py-3 rounded mb-6 text-sm">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="bg-green-900/50 border border-green-500 text-green-100 px-4 py-3 rounded mb-6 text-sm">
              {successMsg}
            </div>
          )}

          {activeTab === 'login' ? (
            <form onSubmit={handleLogin}>
              <div className="mb-4">
                <label className="block text-gray-300 mb-2 text-sm">Username</label>
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-600"
                  placeholder="Enter your username"
                  disabled={loading}
                />
              </div>
              <div className="mb-6">
                <label className="block text-gray-300 mb-2 text-sm">Password</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-600"
                  placeholder="Enter your password"
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <div className="mb-4">
                <label className="block text-gray-300 mb-2 text-sm">Username <span className="text-gray-500">(Optional)</span></label>
                <input
                  type="text"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-600"
                  placeholder="Choose a username"
                  disabled={loading}
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-300 mb-2 text-sm">Password <span className="text-red-400">*</span></label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-600"
                  placeholder="Choose a password (min 6 chars)"
                  minLength={6}
                  disabled={loading}
                />
              </div>
              <div className="mb-6">
                <label className="block text-gray-300 mb-2 text-sm">Phone <span className="text-gray-500">(Optional)</span></label>
                <input
                  type="tel"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-600"
                  placeholder="+1234567890"
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating Account...' : 'Register'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
