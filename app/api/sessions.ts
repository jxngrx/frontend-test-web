/**
 * Sessions API
 *
 * Maps to the Session endpoints from the backend:
 * - POST /api/v1/sessions (Create Session)
 * - GET /api/v1/sessions (Get User Sessions)
 * - DELETE /api/v1/sessions/:sessionId (Deactivate Session)
 * - DELETE /api/v1/sessions (Deactivate All Sessions)
 */

import { createApiClient } from './client';

export interface Session {
  sessionId: string;
  deviceId: string;
  loginMethod: 'phone' | 'google' | 'password';
  expiresAt: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateSessionRequest {
  deviceId: string;
  loginMethod: 'phone' | 'google' | 'password';
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
}

export interface CreateSessionResponse {
  success: boolean;
  data: Session;
  message?: string;
}

export interface SessionsListResponse {
  success: boolean;
  data: Session[];
  message?: string;
}

export interface SessionResponse {
  success: boolean;
  data: Session;
}

/**
 * Create a new active session
 * POST /api/v1/sessions
 * Requires: Bearer token
 */
export const createSession = async (
  token: string,
  sessionData: CreateSessionRequest
): Promise<Session> => {
  const client = createApiClient(token);
  const response = await client.post<CreateSessionResponse>(
    '/api/v1/sessions',
    sessionData
  );
  return response.data.data;
};

/**
 * Get all active sessions for the current user
 * GET /api/v1/sessions
 * Requires: Bearer token
 */
export const getUserSessions = async (token: string): Promise<Session[]> => {
  const client = createApiClient(token);
  const response = await client.get<SessionsListResponse>('/api/v1/sessions');
  return response.data.data || [];
};

/**
 * Deactivate a specific session
 * DELETE /api/v1/sessions/:sessionId
 * Requires: Bearer token
 */
export const deactivateSession = async (
  token: string,
  sessionId: string
): Promise<void> => {
  const client = createApiClient(token);
  await client.delete(`/api/v1/sessions/${sessionId}`);
};

/**
 * Deactivate all sessions (logout from all devices)
 * DELETE /api/v1/sessions
 * Requires: Bearer token
 */
export const deactivateAllSessions = async (token: string): Promise<void> => {
  const client = createApiClient(token);
  await client.delete('/api/v1/sessions');
};
