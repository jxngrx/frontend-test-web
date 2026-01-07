/**
 * Authentication API
 *
 * Maps exactly to the Authentication endpoints from Postman collection:
 * - POST /api/v1/auth/request-otp
 * - POST /api/v1/auth/verify-otp
 * - POST /api/v1/auth/google (Google OAuth)
 */

import { createApiClient } from './client';

export interface RequestOTPRequest {
  phone: string;
}

export interface VerifyOTPRequest {
  phone: string;
  otp: string;
  deviceId?: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
}

export interface GoogleOAuthRequest {
  idToken: string;
  phone: string;
  deviceId?: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
}

export interface User {
  id: string;
  phone: string;
  username?: string;
  email?: string;
  authMethod?: 'phone' | 'google' | 'phone+google';
}

export interface Session {
  sessionId: string;
  deviceId: string;
  loginMethod: 'phone' | 'google';
  expiresAt: string;
  isActive: boolean;
}

export interface AuthResponse {
  success?: boolean;
  data: {
    token: string;
    user: User;
    session?: Session;
  };
  message?: string;
}

/**
 * Request OTP for phone number authentication
 * POST /api/v1/auth/request-otp
 */
export const requestOTP = async (phone: string): Promise<void> => {
  const client = createApiClient();
  await client.post('/api/v1/auth/request-otp', { phone });
};

/**
 * Verify OTP and get JWT token
 * POST /api/v1/auth/verify-otp
 * Returns token that should be stored for subsequent API calls
 * Supports optional deviceId and location for session creation
 */
export const verifyOTP = async (
  phone: string,
  otp: string,
  deviceId?: string,
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  }
): Promise<AuthResponse> => {
  const client = createApiClient();
  const payload: VerifyOTPRequest = { phone, otp };
  if (deviceId) {
    payload.deviceId = deviceId;
  }
  if (location) {
    payload.location = location;
  }
  const response = await client.post<AuthResponse>('/api/v1/auth/verify-otp', payload);
  return response.data;
};

/**
 * Authenticate using Google OAuth
 * POST /api/v1/auth/google
 * Phone number is mandatory even for Google OAuth
 */
export const googleOAuth = async (
  idToken: string,
  phone: string,
  deviceId?: string,
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  }
): Promise<AuthResponse> => {
  const client = createApiClient();
  const payload: GoogleOAuthRequest = { idToken, phone };
  if (deviceId) {
    payload.deviceId = deviceId;
  }
  if (location) {
    payload.location = location;
  }
  const response = await client.post<AuthResponse>('/api/v1/auth/google', payload);
  return response.data;
};
