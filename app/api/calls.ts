/**
 * Calls API
 *
 * Maps to the Calls endpoints from the backend:
 * - POST /api/v1/calls (Initiate Call)
 * - POST /api/v1/calls/:callId/answer (Answer Call)
 * - POST /api/v1/calls/:callId/reject (Reject Call)
 * - POST /api/v1/calls/:callId/end (End Call)
 * - GET /api/v1/calls/history (Get Call History)
 */

import { createApiClient } from './client';

export interface CallUser {
  id: string;
  phone: string;
  username?: string;
}

export interface Call {
  id: string;
  caller: CallUser;
  receiver: CallUser;
  status: 'ringing' | 'answered' | 'rejected' | 'ended';
  startedAt?: string;
  endedAt?: string;
  duration?: number;
  createdAt: string;
  // Legacy fields for backward compatibility
  callerId?: string;
  receiverId?: string;
}

export interface InitiateCallRequest {
  receiverId: string;
}

export interface CallResponse {
  success: boolean;
  data: Call;
  message?: string;
}

export interface CallsHistoryResponse {
  success: boolean;
  data: {
    calls: Call[];
  };
}

/**
 * Initiate a call
 * POST /api/v1/calls
 * Requires: Bearer token
 */
export const initiateCall = async (
  token: string,
  receiverId: string
): Promise<Call> => {
  const client = createApiClient(token);
  const response = await client.post<CallResponse>('/api/v1/calls', {
    receiverId,
  });
  return response.data.data;
};

/**
 * Answer a call
 * POST /api/v1/calls/:callId/answer
 * Requires: Bearer token
 */
export const answerCall = async (
  token: string,
  callId: string
): Promise<Call> => {
  const client = createApiClient(token);
  const response = await client.post<CallResponse>(`/api/v1/calls/${callId}/answer`);
  return response.data.data;
};

/**
 * Reject a call
 * POST /api/v1/calls/:callId/reject
 * Requires: Bearer token
 */
export const rejectCall = async (
  token: string,
  callId: string
): Promise<void> => {
  const client = createApiClient(token);
  await client.post(`/api/v1/calls/${callId}/reject`);
};

/**
 * End a call
 * POST /api/v1/calls/:callId/end
 * Requires: Bearer token
 */
export const endCall = async (
  token: string,
  callId: string
): Promise<Call> => {
  const client = createApiClient(token);
  const response = await client.post<CallResponse>(`/api/v1/calls/${callId}/end`);
  return response.data.data;
};

/**
 * Get call history
 * GET /api/v1/calls/history?limit=50
 * Requires: Bearer token
 */
export const getCallHistory = async (
  token: string,
  limit: number = 50
): Promise<Call[]> => {
  const client = createApiClient(token);
  const response = await client.get<CallsHistoryResponse>(`/api/v1/calls/history?limit=${limit}`);

  // Handle response structure
  if (response.data.data?.calls && Array.isArray(response.data.data.calls)) {
    return response.data.data.calls;
  }
  return [];
};
