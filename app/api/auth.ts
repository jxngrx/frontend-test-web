/**
 * Authentication API
 *
 * Maps exactly to the Authentication endpoints from Postman collection:
 * - POST /api/v1/auth/request-otp
 * - POST /api/v1/auth/verify-otp
 */

import { createApiClient } from './client';

export interface RequestOTPRequest {
  phone: string;
}

export interface VerifyOTPRequest {
  phone: string;
  otp: string;
}

export interface AuthResponse {
  data: {
    token: string;
    user?: {
      id: string;
      phone: string;
      username?: string;
    };
  };
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
 */
export const verifyOTP = async (
  phone: string,
  otp: string
): Promise<AuthResponse> => {
  const client = createApiClient();
  const response = await client.post<AuthResponse>('/api/v1/auth/verify-otp', {
    phone,
    otp,
  });
  return response.data;
};
