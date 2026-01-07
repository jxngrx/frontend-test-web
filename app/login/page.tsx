/**
 * Login Page
 *
 * Dedicated authentication page with:
 * - Phone OTP flow
 * - Google OAuth option
 * - Device registration during login
 * - Session creation
 * - Redirect to chat app after authentication
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { requestOTP, verifyOTP, googleOAuth } from '../api/auth';
import { getProfile } from '../api/users';
import { registerDevice } from '../api/devices';
import { createSession } from '../api/sessions';
import { getDeviceInfo } from '../utils/device';
import { getCurrentLocation } from '../utils/location';

const STORAGE_KEY = 'chat_session';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [authStep, setAuthStep] = useState<'phone' | 'otp' | 'google-phone'>('phone');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googlePhone, setGooglePhone] = useState('');

  // Check if already authenticated
  useEffect(() => {
    const savedSession = localStorage.getItem(STORAGE_KEY);
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        if (session.token && session.userId) {
          // Already authenticated, redirect to home
          router.push('/');
        }
      } catch (e) {
        // Invalid session, continue with login
      }
    }
  }, [router]);

  const handleRequestOTP = async () => {
    if (!phone.trim()) {
      setError('Please enter phone number');
      return;
    }

    // Basic phone validation (E.164 format)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
      setError('Please enter a valid phone number (E.164 format, e.g., +1234567890)');
      return;
    }

    try {
      setError(null);
      setLoading(true);
      await requestOTP(phone);
      setAuthStep('otp');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to request OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim() || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    try {
      setError(null);
      setLoading(true);

      // Get device info and location
      const deviceInfo = getDeviceInfo();
      const location = await getCurrentLocation();

      // Verify OTP with deviceId and location
      const response = await verifyOTP(
        phone,
        otp,
        deviceInfo.deviceId,
        location || undefined
      );
      const token = response.data.token;

      // Get user profile
      const profile = await getProfile(token);

      // Register device with full info
      try {
        await registerDevice(token, deviceInfo);
      } catch (deviceError) {
        console.warn('Device registration failed:', deviceError);
      }

      // Create session if not already created
      if (!response.data.session && deviceInfo.deviceId) {
        try {
          await createSession(token, {
            deviceId: deviceInfo.deviceId,
            loginMethod: 'phone',
            location: location || undefined,
          });
        } catch (sessionError) {
          console.warn('Session creation failed:', sessionError);
        }
      }

      // Save session
      const session = {
        token,
        userId: profile.id,
        username: profile.username || null,
        phone: phone,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));

      // Redirect to home
      router.push('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setError(null);
      setLoading(true);

      // Check if Google Sign-In is available
      if (typeof window === 'undefined' || !(window as any).google) {
        setError('Google Sign-In is not available. Please use phone OTP instead.');
        setLoading(false);
        return;
      }

      // Initialize Google Sign-In if needed
      await new Promise<void>((resolve, reject) => {
        if ((window as any).google?.accounts?.id) {
          resolve();
        } else {
          // Load Google Sign-In script
          const script = document.createElement('script');
          script.src = 'https://accounts.google.com/gsi/client';
          script.async = true;
          script.defer = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Google Sign-In'));
          document.head.appendChild(script);
        }
      });

      // Get Google ID token
      const google = (window as any).google;
      const response = await google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
        callback: async (credentialResponse: any) => {
          try {
            const idToken = credentialResponse.credential;

            // Ask for phone number (required by backend)
            setAuthStep('google-phone');
            setLoading(false);

            // Store idToken temporarily
            (window as any).__googleIdToken = idToken;
          } catch (err: any) {
            setError(err.message || 'Google Sign-In failed');
            setLoading(false);
          }
        },
      });

      // Trigger Google Sign-In
      google.accounts.id.prompt();
    } catch (err: any) {
      setError(err.message || 'Google Sign-In failed');
      setLoading(false);
    }
  };

  const handleGooglePhoneSubmit = async () => {
    if (!googlePhone.trim()) {
      setError('Please enter phone number');
      return;
    }

    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(googlePhone.replace(/\s/g, ''))) {
      setError('Please enter a valid phone number (E.164 format)');
      return;
    }

    const idToken = (window as any).__googleIdToken;
    if (!idToken) {
      setError('Google authentication token not found. Please try again.');
      return;
    }

    try {
      setError(null);
      setLoading(true);

      // Get device info and location
      const deviceInfo = getDeviceInfo();
      const location = await getCurrentLocation();

      // Authenticate with Google OAuth
      const response = await googleOAuth(
        idToken,
        googlePhone,
        deviceInfo.deviceId,
        location || undefined
      );
      const token = response.data.token;

      // Get user profile
      const profile = await getProfile(token);

      // Register device
      try {
        await registerDevice(token, deviceInfo);
      } catch (deviceError) {
        console.warn('Device registration failed:', deviceError);
      }

      // Create session if not already created
      if (!response.data.session && deviceInfo.deviceId) {
        try {
          await createSession(token, {
            deviceId: deviceInfo.deviceId,
            loginMethod: 'google',
            location: location || undefined,
          });
        } catch (sessionError) {
          console.warn('Session creation failed:', sessionError);
        }
      }

      // Save session
      const session = {
        token,
        userId: profile.id,
        username: profile.username || null,
        phone: googlePhone,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));

      // Clean up
      delete (window as any).__googleIdToken;

      // Redirect to home
      router.push('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Google authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-white mb-8 text-center">
          Chat App
        </h1>

        {error && (
          <div className="bg-red-900 text-red-100 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {authStep === 'phone' && (
          <div>
            <div className="mb-4">
              <label className="block text-gray-300 mb-2">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1234567890"
                className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>
            <button
              onClick={handleRequestOTP}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Request OTP'}
            </button>
            <div className="mt-4 text-center">
              <p className="text-gray-400 mb-2">or</p>
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full bg-white hover:bg-gray-100 text-gray-800 font-semibold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
              </button>
            </div>
          </div>
        )}

        {authStep === 'otp' && (
          <div>
            <div className="mb-4">
              <label className="block text-gray-300 mb-2">Enter OTP</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest"
                disabled={loading}
              />
            </div>
            <button
              onClick={handleVerifyOTP}
              disabled={loading || otp.length !== 6}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button
              onClick={() => {
                setAuthStep('phone');
                setOtp('');
                setError(null);
              }}
              className="w-full mt-2 text-gray-400 hover:text-gray-300"
              disabled={loading}
            >
              Back
            </button>
          </div>
        )}

        {authStep === 'google-phone' && (
          <div>
            <div className="mb-4">
              <label className="block text-gray-300 mb-2">Phone Number (Required)</label>
              <input
                type="tel"
                value={googlePhone}
                onChange={(e) => setGooglePhone(e.target.value)}
                placeholder="+1234567890"
                className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
              <p className="text-gray-400 text-sm mt-1">
                Phone number is required even for Google Sign-In
              </p>
            </div>
            <button
              onClick={handleGooglePhoneSubmit}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Authenticating...' : 'Continue'}
            </button>
            <button
              onClick={() => {
                setAuthStep('phone');
                setGooglePhone('');
                setError(null);
                delete (window as any).__googleIdToken;
              }}
              className="w-full mt-2 text-gray-400 hover:text-gray-300"
              disabled={loading}
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
