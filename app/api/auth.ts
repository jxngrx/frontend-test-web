/**
 * Authentication API
 *
 * Maps exactly to the Authentication endpoints from the new spec:
 * - POST /api/v1/auth/register
 * - POST /api/v1/auth/login
 */

import { createApiClient } from './client';
import { generateDeviceId } from '../utils/device';

export interface RegisterRequest {
  username?: string;
  password?: string; // Required in spec but making optional here to avoid TS strictness before validation
  deviceId: string;
  phone?: string;
}

export interface LoginRequest {
  username: string;
  password?: string;
  deviceId: string;
}

export interface User {
  id: string;
  username: string;
  phone: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    token: string;
    user: User;
  };
  message: string;
}

/**
 * Register a new user
 * POST /api/v1/auth/register
 */
export const register = async (data: Omit<RegisterRequest, 'deviceId'>): Promise<AuthResponse> => {
  const client = createApiClient();
  const deviceId = generateDeviceId();

  const payload: RegisterRequest = {
    ...data,
    deviceId
  };

  const response = await client.post<AuthResponse>('/api/v1/auth/register', payload);
  return response.data;
};

/**
 * Login user
 * POST /api/v1/auth/login
 */
export const login = async (data: Omit<LoginRequest, 'deviceId'>): Promise<AuthResponse> => {
  const client = createApiClient();
  const deviceId = generateDeviceId();

  const payload: LoginRequest = {
    ...data,
    deviceId
  };

  const response = await client.post<AuthResponse>('/api/v1/auth/login', payload);
  return response.data;
};
