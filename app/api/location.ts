/**
 * Location API
 *
 * Maps to the Location endpoints from the backend:
 * - POST /api/v1/location/update (Update Location)
 * - GET /api/v1/location/last-known (Get Last Known Location)
 * - POST /api/v1/location/live/start (Start Live Location)
 * - POST /api/v1/location/live/:liveSessionId/update (Update Live Location)
 * - POST /api/v1/location/live/:liveSessionId/stop (Stop Live Location)
 */

import { createApiClient } from './client';

export interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: string;
  isLive?: boolean;
  device?: {
    deviceId: string;
    deviceModel: string;
  };
}

export interface UpdateLocationRequest {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface StartLiveLocationRequest {
  chatId?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface LiveLocationSession {
  liveSessionId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
  isLive: boolean;
}

export interface LocationResponse {
  success: boolean;
  data: Location;
  message?: string;
}

export interface LiveLocationResponse {
  success: boolean;
  data: LiveLocationSession;
  message?: string;
}

/**
 * Update last known location
 * POST /api/v1/location/update
 * Requires: Bearer token
 */
export const updateLocation = async (
  token: string,
  location: UpdateLocationRequest
): Promise<Location> => {
  const client = createApiClient(token);
  const response = await client.post<LocationResponse>(
    '/api/v1/location/update',
    location
  );
  return response.data.data;
};

/**
 * Get last known location
 * GET /api/v1/location/last-known
 * Requires: Bearer token
 */
export const getLastKnownLocation = async (
  token: string
): Promise<Location | null> => {
  const client = createApiClient(token);
  const response = await client.get<LocationResponse>(
    '/api/v1/location/last-known'
  );
  // Backend returns null in data if no location found
  return response.data.data || null;
};

/**
 * Start sharing live location
 * POST /api/v1/location/live/start
 * Requires: Bearer token
 */
export const startLiveLocation = async (
  token: string,
  locationData: StartLiveLocationRequest
): Promise<LiveLocationSession> => {
  const client = createApiClient(token);
  const response = await client.post<LiveLocationResponse>(
    '/api/v1/location/live/start',
    locationData
  );
  return response.data.data;
};

/**
 * Update live location
 * POST /api/v1/location/live/:liveSessionId/update
 * Requires: Bearer token
 */
export const updateLiveLocation = async (
  token: string,
  liveSessionId: string,
  location: UpdateLocationRequest
): Promise<Location> => {
  const client = createApiClient(token);
  const response = await client.post<LocationResponse>(
    `/api/v1/location/live/${liveSessionId}/update`,
    location
  );
  return response.data.data;
};

/**
 * Stop sharing live location
 * POST /api/v1/location/live/:liveSessionId/stop
 * Requires: Bearer token
 */
export const stopLiveLocation = async (
  token: string,
  liveSessionId: string
): Promise<void> => {
  const client = createApiClient(token);
  await client.post(`/api/v1/location/live/${liveSessionId}/stop`);
};
