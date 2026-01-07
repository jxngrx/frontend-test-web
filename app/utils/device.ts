/**
 * Device Utility Functions
 *
 * Helper functions for device registration and device information
 */

import { v4 as uuidv4 } from 'uuid';
import { RegisterDeviceRequest } from '../api/devices';

const DEVICE_ID_KEY = 'device_id';

/**
 * Generate or retrieve device ID
 * Stores in localStorage for persistence
 */
export const generateDeviceId = (): string => {
  if (typeof window === 'undefined') {
    // Server-side: generate new ID
    return uuidv4();
  }

  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = uuidv4();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
};

/**
 * Get mock IMEI number (15 digits)
 * For web apps, we use a mock IMEI since browsers don't provide real IMEI
 */
export const getMockIMEI = (): string => {
  // Return a mock 15-digit IMEI
  return '123456789012345';
};

/**
 * Get device information from browser
 * Extracts device info from user agent and browser APIs
 */
export const getDeviceInfo = (): RegisterDeviceRequest => {
  if (typeof window === 'undefined') {
    // Server-side: return default values
    return {
      deviceModel: 'Unknown',
      manufacturer: 'Unknown',
      osName: 'Unknown',
      osVersion: 'Unknown',
      appVersion: '1.0.0',
      platform: 'Web',
    };
  }

  const userAgent = navigator.userAgent;
  const platform = navigator.platform;

  // Detect device model from user agent
  let deviceModel = 'Unknown';
  let manufacturer = 'Unknown';
  let osName = platform || 'Unknown';
  let osVersion = userAgent;

  // Try to extract more specific info from user agent
  if (userAgent.includes('iPhone')) {
    deviceModel = 'iPhone';
    manufacturer = 'Apple';
    osName = 'iOS';
    // Try to extract iOS version
    const iosMatch = userAgent.match(/OS (\d+)_(\d+)/);
    if (iosMatch) {
      osVersion = `${iosMatch[1]}.${iosMatch[2]}`;
    }
  } else if (userAgent.includes('iPad')) {
    deviceModel = 'iPad';
    manufacturer = 'Apple';
    osName = 'iOS';
    const iosMatch = userAgent.match(/OS (\d+)_(\d+)/);
    if (iosMatch) {
      osVersion = `${iosMatch[1]}.${iosMatch[2]}`;
    }
  } else if (userAgent.includes('Android')) {
    manufacturer = 'Google';
    osName = 'Android';
    // Try to extract Android version
    const androidMatch = userAgent.match(/Android (\d+(\.\d+)?)/);
    if (androidMatch) {
      osVersion = androidMatch[1];
    }
    // Try to extract device model
    const modelMatch = userAgent.match(/\(([^)]+)\)/);
    if (modelMatch) {
      deviceModel = modelMatch[1].split(';')[0] || 'Android Device';
    }
  } else if (userAgent.includes('Windows')) {
    manufacturer = 'Microsoft';
    osName = 'Windows';
    const winMatch = userAgent.match(/Windows NT (\d+\.\d+)/);
    if (winMatch) {
      osVersion = winMatch[1];
    }
  } else if (userAgent.includes('Mac OS X')) {
    manufacturer = 'Apple';
    osName = 'macOS';
    const macMatch = userAgent.match(/Mac OS X (\d+[._]\d+)/);
    if (macMatch) {
      osVersion = macMatch[1].replace('_', '.');
    }
  } else if (userAgent.includes('Linux')) {
    manufacturer = 'Unknown';
    osName = 'Linux';
    osVersion = 'Unknown';
  }

  // Use user agent data API if available (newer browsers)
  if ('userAgentData' in navigator) {
    const uaData = (navigator as any).userAgentData;
    if (uaData.brands && uaData.brands.length > 0) {
      manufacturer = uaData.brands[0].brand || manufacturer;
    }
    if (uaData.platform) {
      osName = uaData.platform || osName;
    }
  }

  return {
    deviceId: generateDeviceId(),
    deviceModel,
    manufacturer,
    osName,
    osVersion: osVersion.substring(0, 100), // Limit length
    appVersion: '1.0.0',
    platform: 'Web',
    imei: getMockIMEI(),
  };
};
