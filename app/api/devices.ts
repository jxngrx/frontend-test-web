/**
 * Devices API
 *
 * Maps to the Device endpoints from the backend:
 * - POST /api/v1/devices/register (Register Device)
 * - GET /api/v1/devices (Get User Devices)
 * - GET /api/v1/devices/:deviceId (Get Device By ID)
 */

import { createApiClient } from './client';

export interface Device {
  id: string;
  deviceId: string;
  deviceModel: string;
  manufacturer: string;
  osName: string;
  osVersion: string;
  appVersion: string;
  platform: 'Android' | 'iOS' | 'Web';
  imei?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RegisterDeviceRequest {
  deviceId?: string;
  deviceModel: string;
  manufacturer: string;
  osName: string;
  osVersion: string;
  appVersion: string;
  platform: 'Android' | 'iOS' | 'Web';
  imei?: string;
}

export interface RegisterDeviceResponse {
  success: boolean;
  data: {
    deviceId: string;
    message?: string;
  };
  message?: string;
}

export interface DevicesListResponse {
  success: boolean;
  data: Device[];
  message?: string;
}

export interface DeviceResponse {
  success: boolean;
  data: Device;
}

/**
 * Register or update a device
 * POST /api/v1/devices/register
 * Requires: Bearer token
 */
export const registerDevice = async (
  token: string,
  deviceInfo: RegisterDeviceRequest
): Promise<RegisterDeviceResponse['data']> => {
  const client = createApiClient(token);
  const response = await client.post<RegisterDeviceResponse>(
    '/api/v1/devices/register',
    deviceInfo
  );
  return response.data.data;
};

/**
 * Get all devices for the current user
 * GET /api/v1/devices
 * Requires: Bearer token
 */
export const getUserDevices = async (token: string): Promise<Device[]> => {
  const client = createApiClient(token);
  const response = await client.get<DevicesListResponse>('/api/v1/devices');
  return response.data.data || [];
};

/**
 * Get device by ID
 * GET /api/v1/devices/:deviceId
 * Requires: Bearer token
 */
export const getDeviceById = async (
  token: string,
  deviceId: string
): Promise<Device> => {
  const client = createApiClient(token);
  const response = await client.get<DeviceResponse>(
    `/api/v1/devices/${deviceId}`
  );
  return response.data.data;
};
