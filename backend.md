<!-- FOR_FRONTEND_GUIDE_OF_BACKEND.MD -->


# Complete Frontend Integration Guide - Chat App Backend API

## Table of Contents

1. [Introduction](#introduction)
2. [Base Configuration](#base-configuration)
3. [Authentication & Authorization](#authentication--authorization)
4. [API Endpoints - Complete Reference](#api-endpoints---complete-reference)
5. [Socket.IO Real-time Communication](#socketio-real-time-communication)
6. [Complete Workflows](#complete-workflows)
7. [Error Handling](#error-handling)
8. [Best Practices](#best-practices)
9. [Code Examples](#code-examples)

---

## Introduction

This guide provides **complete documentation** for integrating the Chat App Backend API into your frontend application. It covers every endpoint, payload structure, response format, error codes, and real-time communication patterns.

### Base URL

```
Development: http://localhost:3000
Production: https://your-api-domain.com
```

### API Version

All endpoints are prefixed with `/api/v1`

### Content Type

All requests (except file uploads) use:
```
Content-Type: application/json
```

### Response Format

All API responses follow this structure:

```typescript
{
  success: boolean;
  data?: any;           // Present when success is true
  message?: string;     // Human-readable message
  error?: string;       // Present when success is false
}
```

---

## Base Configuration

### Environment Variables

Set these in your frontend environment:

```javascript
const API_CONFIG = {
  BASE_URL: process.env.REACT_APP_API_URL || 'http://localhost:3000',
  API_PREFIX: '/api/v1',
  SOCKET_URL: process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000',
};
```

### Axios/Fetch Setup

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

---

## Authentication & Authorization

### Authentication Flow

1. **Request OTP** → Get OTP code
2. **Verify OTP** → Get JWT token + optional session
3. **OR Google OAuth** → Get JWT token + optional session
4. **Store token** → Use in all subsequent requests
5. **Register Device** → Register device information
6. **Create Session** → Create active session (if not created during auth)

### JWT Token Storage

```javascript
// Store token after successful authentication
localStorage.setItem('auth_token', token);

// Include in all authenticated requests
headers: {
  'Authorization': `Bearer ${token}`
}
```

### Token Expiry

- Default expiry: **30 days**
- Token is included in JWT payload with `exp` field
- Frontend should check expiry and refresh if needed

---

## API Endpoints - Complete Reference

### 🔐 Authentication Endpoints

#### 1. Request OTP

**Endpoint:** `POST /api/v1/auth/request-otp`

**Description:** Request a one-time password (OTP) for phone number authentication.

**Authentication:** Not required

**Rate Limiting:** 3 requests per phone number per minute

**Request Payload:**
```json
{
  "phone": "+1234567890"
}
```

**Field Validation:**
- `phone`: Required, must match pattern `^\+?[1-9]\d{1,14}$` (E.164 format)

**Success Response (200):**
```json
{
  "success": true,
  "message": "OTP sent successfully"
}
```

**Error Responses:**
- `400`: Invalid phone format
- `429`: Too many OTP requests (rate limited)
- `500`: Server error

**Frontend Implementation:**
```javascript
const requestOTP = async (phone) => {
  try {
    const response = await api.post('/auth/request-otp', { phone });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

**Notes:**
- In development, OTP is logged to server console
- In production, OTP is sent via SMS service
- OTP expires in 5 minutes (configurable)
- OTP is 6 digits by default

---

#### 2. Verify OTP

**Endpoint:** `POST /api/v1/auth/verify-otp`

**Description:** Verify OTP and authenticate user. Optionally creates session if device info is provided.

**Authentication:** Not required

**Request Payload:**
```json
{
  "phone": "+1234567890",
  "otp": "123456",
  "deviceId": "device-uuid-here",  // Optional
  "location": {                     // Optional
    "latitude": 40.7128,
    "longitude": -74.0060,
    "accuracy": 10
  }
}
```

**Field Validation:**
- `phone`: Required, E.164 format
- `otp`: Required, exactly 6 digits
- `deviceId`: Optional string
- `location`: Optional object
  - `latitude`: Required if location provided, -90 to 90
  - `longitude`: Required if location provided, -180 to 180
  - `accuracy`: Optional, >= 0

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "phone": "+1234567890",
      "username": "user_67890"
    },
    "session": {                    // Present if deviceId provided
      "sessionId": "507f1f77bcf86cd799439012",
      "deviceId": "device-uuid-here",
      "loginMethod": "phone",
      "expiresAt": "2024-02-15T10:30:00.000Z",
      "isActive": true
    }
  },
  "message": "OTP verified successfully"
}
```

**Error Responses:**
- `400`: Invalid OTP, expired OTP, or validation error
- `429`: Too many failed attempts (5 attempts max)
- `500`: Server error

**Frontend Implementation:**
```javascript
const verifyOTP = async (phone, otp, deviceInfo = null) => {
  try {
    const payload = { phone, otp };

    // Add device info if available
    if (deviceInfo) {
      payload.deviceId = deviceInfo.deviceId;
      if (deviceInfo.location) {
        payload.location = deviceInfo.location;
      }
    }

    const response = await api.post('/auth/verify-otp', payload);

    // Store token
    if (response.data.data?.token) {
      localStorage.setItem('auth_token', response.data.data.token);
    }

    // Store session ID if present
    if (response.data.data?.session?.sessionId) {
      localStorage.setItem('session_id', response.data.data.session.sessionId);
    }

    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

**Complete Flow:**
```javascript
// Step 1: Request OTP
await requestOTP('+1234567890');

// Step 2: User enters OTP
const otp = '123456';

// Step 3: Get device info (if available)
const deviceInfo = {
  deviceId: await getDeviceId(), // Generate or retrieve UUID
  location: await getCurrentLocation(), // Optional
};

// Step 4: Verify OTP
const result = await verifyOTP('+1234567890', otp, deviceInfo);

// Step 5: User is now authenticated
console.log('User:', result.data.user);
console.log('Token:', result.data.token);
```

---

#### 3. Google OAuth

**Endpoint:** `POST /api/v1/auth/google`

**Description:** Authenticate using Google OAuth. Phone number is **mandatory** even for Google users.

**Authentication:** Not required

**Prerequisites:**
- User must have completed Google OAuth flow on frontend
- Frontend must have Google ID token from Google Sign-In

**Request Payload:**
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...",
  "phone": "+1234567890",
  "deviceId": "device-uuid-here",  // Optional
  "location": {                     // Optional
    "latitude": 40.7128,
    "longitude": -74.0060,
    "accuracy": 10
  }
}
```

**Field Validation:**
- `idToken`: Required, valid Google ID token
- `phone`: Required, E.164 format (mandatory even for Google users)
- `deviceId`: Optional string
- `location`: Optional object (same as Verify OTP)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "phone": "+1234567890",
      "email": "user@gmail.com",
      "username": "user_gmail",
      "authMethod": "google"
    },
    "session": {                    // Present if deviceId provided
      "sessionId": "507f1f77bcf86cd799439012",
      "deviceId": "device-uuid-here",
      "loginMethod": "google",
      "expiresAt": "2024-02-15T10:30:00.000Z",
      "isActive": true
    }
  },
  "message": "Google authentication successful"
}
```

**Error Responses:**
- `400`: Invalid Google token, invalid phone format, or validation error
- `500`: Server error or Google OAuth not configured

**Frontend Implementation:**
```javascript
// Using Google Sign-In JavaScript SDK
const googleOAuth = async (googleIdToken, phone, deviceInfo = null) => {
  try {
    const payload = {
      idToken: googleIdToken,
      phone, // Mandatory
    };

    if (deviceInfo) {
      payload.deviceId = deviceInfo.deviceId;
      if (deviceInfo.location) {
        payload.location = deviceInfo.location;
      }
    }

    const response = await api.post('/auth/google', payload);

    // Store token
    if (response.data.data?.token) {
      localStorage.setItem('auth_token', response.data.data.token);
    }

    // Store session ID if present
    if (response.data.data?.session?.sessionId) {
      localStorage.setItem('session_id', response.data.data.session.sessionId);
    }

    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Complete Google OAuth flow
const handleGoogleSignIn = async () => {
  try {
    // Step 1: Get Google ID token (using Google Sign-In SDK)
    const googleUser = await signInWithGoogle();
    const idToken = googleUser.getAuthResponse().id_token;

    // Step 2: Get phone number from user (mandatory)
    const phone = await promptForPhoneNumber();

    // Step 3: Get device info
    const deviceInfo = {
      deviceId: await getDeviceId(),
      location: await getCurrentLocation(),
    };

    // Step 4: Authenticate with backend
    const result = await googleOAuth(idToken, phone, deviceInfo);

    console.log('Authenticated:', result.data.user);
  } catch (error) {
    console.error('Google OAuth failed:', error);
  }
};
```

**Notes:**
- Phone number is **mandatory** even for Google OAuth users
- If user exists with same email, account is linked
- If user exists with same phone, account is linked
- `authMethod` can be: `'phone'`, `'google'`, or `'phone+google'`

---

### 👤 User Endpoints

All user endpoints require authentication.

#### 4. Get Profile

**Endpoint:** `GET /api/v1/users/profile`

**Description:** Get current authenticated user's profile.

**Authentication:** Required (Bearer token)

**Request Payload:** None

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "phone": "+1234567890",
    "email": "user@gmail.com",        // Present if Google OAuth used
    "username": "user_67890",
    "authMethod": "phone",             // "phone", "google", or "phone+google"
    "isOnline": true,
    "lastSeen": "2024-01-15T10:30:00.000Z",
    "contacts": [],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `401`: Unauthorized (invalid/missing token)
- `500`: Server error

**Frontend Implementation:**
```javascript
const getProfile = async () => {
  try {
    const response = await api.get('/users/profile');
    return response.data.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

---

#### 5. Update Username

**Endpoint:** `PUT /api/v1/users/username`

**Description:** Update current user's username.

**Authentication:** Required (Bearer token)

**Request Payload:**
```json
{
  "username": "newusername"
}
```

**Field Validation:**
- `username`: Required, 3-30 characters, alphanumeric and underscores only

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "phone": "+1234567890",
    "username": "newusername",
    "updatedAt": "2024-01-15T10:35:00.000Z"
  },
  "message": "Username updated successfully"
}
```

**Error Responses:**
- `400`: Invalid username format or username already taken
- `401`: Unauthorized
- `500`: Server error

**Frontend Implementation:**
```javascript
const updateUsername = async (username) => {
  try {
    const response = await api.put('/users/username', { username });
    return response.data.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

---

#### 6. Search Users

**Endpoint:** `GET /api/v1/users/search?q=searchterm`

**Description:** Search users by phone number or username.

**Authentication:** Required (Bearer token)

**Query Parameters:**
- `q`: Required, search term (1-100 characters)

**Request Payload:** None

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "507f1f77bcf86cd799439011",
      "phone": "+1234567890",
      "username": "user_67890",
      "isOnline": true,
      "lastSeen": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

**Notes:**
- Returns up to 20 results
- Current user is excluded from results
- Case-insensitive partial match
- Searches both phone and username

**Error Responses:**
- `400`: Invalid search query
- `401`: Unauthorized
- `500`: Server error

**Frontend Implementation:**
```javascript
const searchUsers = async (query) => {
  try {
    const response = await api.get(`/users/search?q=${encodeURIComponent(query)}`);
    return response.data.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

---

#### 7. Get User By ID

**Endpoint:** `GET /api/v1/users/:userId`

**Description:** Get user details by user ID.

**Authentication:** Required (Bearer token)

**Path Parameters:**
- `userId`: Required, MongoDB ObjectId (24 hex characters)

**Request Payload:** None

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "phone": "+1234567890",
    "username": "user_67890",
    "isOnline": true,
    "lastSeen": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `400`: Invalid user ID format
- `401`: Unauthorized
- `404`: User not found
- `500`: Server error

**Frontend Implementation:**
```javascript
const getUserById = async (userId) => {
  try {
    const response = await api.get(`/users/${userId}`);
    return response.data.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

---

### 📱 Device Endpoints

All device endpoints require authentication.

#### 8. Register Device

**Endpoint:** `POST /api/v1/devices/register`

**Description:** Register or update a device for the current user. Required for session management and device tracking.

**Authentication:** Required (Bearer token)

**Request Payload:**
```json
{
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",  // Optional, auto-generated if not provided
  "deviceModel": "iPhone 14 Pro",
  "manufacturer": "Apple",
  "osName": "iOS",
  "osVersion": "17.0",
  "appVersion": "1.0.0",
  "platform": "iOS",                                    // "Android" or "iOS"
  "imei": "123456789012345"                            // Optional, exactly 15 digits
}
```

**Field Validation:**
- `deviceId`: Optional, UUID format (auto-generated if not provided)
- `deviceModel`: Required string
- `manufacturer`: Required string
- `osName`: Required string
- `osVersion`: Required string
- `appVersion`: Required string
- `platform`: Required, must be "Android" or "iOS"
- `imei`: Optional, exactly 15 digits (if provided)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "message": "Device registered successfully"
  },
  "message": "Device registered successfully"
}
```

**Error Responses:**
- `400`: Validation error (invalid IMEI format, etc.)
- `401`: Unauthorized
- `500`: Server error

**Frontend Implementation:**
```javascript
import { v4 as uuidv4 } from 'uuid';
import DeviceInfo from 'react-native-device-info'; // For React Native

const registerDevice = async () => {
  try {
    // Get device info (example for React Native)
    const deviceId = await DeviceInfo.getUniqueId() || uuidv4();
    const deviceModel = await DeviceInfo.getModel();
    const manufacturer = await DeviceInfo.getManufacturer();
    const osName = await DeviceInfo.getSystemName();
    const osVersion = await DeviceInfo.getSystemVersion();
    const appVersion = await DeviceInfo.getVersion();
    const platform = Platform.OS === 'ios' ? 'iOS' : 'Android';
    const imei = await DeviceInfo.getImei(); // Optional, may be null

    const payload = {
      deviceId,
      deviceModel,
      manufacturer,
      osName,
      osVersion,
      appVersion,
      platform,
    };

    if (imei) {
      payload.imei = imei;
    }

    const response = await api.post('/devices/register', payload);

    // Store device ID
    localStorage.setItem('device_id', response.data.data.deviceId);

    return response.data.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// For web browsers
const registerWebDevice = async () => {
  const deviceId = localStorage.getItem('device_id') || uuidv4();
  localStorage.setItem('device_id', deviceId);

  const payload = {
    deviceId,
    deviceModel: navigator.userAgentData?.model || 'Unknown',
    manufacturer: navigator.userAgentData?.brand || 'Unknown',
    osName: navigator.platform,
    osVersion: navigator.userAgent,
    appVersion: '1.0.0',
    platform: /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'iOS' : 'Android',
  };

  const response = await api.post('/devices/register', payload);
  return response.data.data;
};
```

**When to Call:**
- After user authentication
- When app starts (check if device is registered)
- When device info changes (OS update, app update)

---

#### 9. Get User Devices

**Endpoint:** `GET /api/v1/devices`

**Description:** Get all devices registered for the current user.

**Authentication:** Required (Bearer token)

**Request Payload:** None

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "507f1f77bcf86cd799439011",
      "deviceId": "550e8400-e29b-41d4-a716-446655440000",
      "deviceModel": "iPhone 14 Pro",
      "manufacturer": "Apple",
      "osName": "iOS",
      "osVersion": "17.0",
      "appVersion": "1.0.0",
      "platform": "iOS",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "message": "Devices retrieved successfully"
}
```

**Frontend Implementation:**
```javascript
const getUserDevices = async () => {
  try {
    const response = await api.get('/devices');
    return response.data.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

---

#### 10. Get Device By ID

**Endpoint:** `GET /api/v1/devices/:deviceId`

**Description:** Get specific device details by device ID.

**Authentication:** Required (Bearer token)

**Path Parameters:**
- `deviceId`: Required, device UUID

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "deviceModel": "iPhone 14 Pro",
    "manufacturer": "Apple",
    "osName": "iOS",
    "osVersion": "17.0",
    "appVersion": "1.0.0",
    "platform": "iOS",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Frontend Implementation:**
```javascript
const getDeviceById = async (deviceId) => {
  try {
    const response = await api.get(`/devices/${deviceId}`);
    return response.data.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

---

### 🔑 Session Endpoints

All session endpoints require authentication.

#### 11. Create Session

**Endpoint:** `POST /api/v1/sessions`

**Description:** Create a new active session. Device must be registered first.

**Authentication:** Required (Bearer token)

**Request Payload:**
```json
{
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "loginMethod": "phone",                              // "phone" or "google"
  "location": {                                        // Optional
    "latitude": 40.7128,
    "longitude": -74.0060,
    "accuracy": 10
  }
}
```

**Field Validation:**
- `deviceId`: Required, must be registered device
- `loginMethod`: Required, "phone" or "google"
- `location`: Optional object
  - `latitude`: Required if location provided, -90 to 90
  - `longitude`: Required if location provided, -180 to 180
  - `accuracy`: Optional, >= 0

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "sessionId": "507f1f77bcf86cd799439012",
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "loginMethod": "phone",
    "expiresAt": "2024-02-15T10:30:00.000Z",
    "isActive": true
  },
  "message": "Session created successfully"
}
```

**Error Responses:**
- `400`: Validation error or device not found
- `401`: Unauthorized
- `404`: Device not found (must register device first)
- `500`: Server error

**Frontend Implementation:**
```javascript
const createSession = async (deviceId, loginMethod, location = null) => {
  try {
    const payload = {
      deviceId,
      loginMethod, // "phone" or "google"
    };

    if (location) {
      payload.location = location;
    }

    const response = await api.post('/sessions', payload);

    // Store session ID
    if (response.data.data?.sessionId) {
      localStorage.setItem('session_id', response.data.data.sessionId);
    }

    return response.data.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Complete flow
const initializeSession = async () => {
  // Step 1: Register device (if not already registered)
  const deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    await registerDevice();
  }

  // Step 2: Get current location (optional)
  const location = await getCurrentLocation();

  // Step 3: Create session
  const session = await createSession(
    localStorage.getItem('device_id'),
    'phone', // or 'google' if used Google OAuth
    location
  );

  return session;
};
```

**Notes:**
- Session is automatically created during OTP verification or Google OAuth if deviceId is provided
- Session expires in 30 days by default (configurable)
- Multiple sessions can be active (multi-device support)
- IP address is automatically captured from request

---

#### 12. Get User Sessions

**Endpoint:** `GET /api/v1/sessions`

**Description:** Get all active sessions for the current user.

**Authentication:** Required (Bearer token)

**Request Payload:** None

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "sessionId": "507f1f77bcf86cd799439012",
      "deviceId": "550e8400-e29b-41d4-a716-446655440000",
      "loginMethod": "phone",
      "expiresAt": "2024-02-15T10:30:00.000Z",
      "isActive": true
    }
  ],
  "message": "Sessions retrieved successfully"
}
```

**Frontend Implementation:**
```javascript
const getUserSessions = async () => {
  try {
    const response = await api.get('/sessions');
    return response.data.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

---

#### 13. Deactivate Session

**Endpoint:** `DELETE /api/v1/sessions/:sessionId`

**Description:** Deactivate (logout) a specific session.

**Authentication:** Required (Bearer token)

**Path Parameters:**
- `sessionId`: Required, session ID

**Request Payload:** None

**Success Response (200):**
```json
{
  "success": true,
  "message": "Session deactivated successfully"
}
```

**Error Responses:**
- `401`: Unauthorized
- `404`: Session not found
- `500`: Server error

**Frontend Implementation:**
```javascript
const deactivateSession = async (sessionId) => {
  try {
    const response = await api.delete(`/sessions/${sessionId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Logout from current device
const logout = async () => {
  const sessionId = localStorage.getItem('session_id');
  if (sessionId) {
    await deactivateSession(sessionId);
  }
  localStorage.removeItem('auth_token');
  localStorage.removeItem('session_id');
};
```

---

#### 14. Deactivate All Sessions

**Endpoint:** `DELETE /api/v1/sessions`

**Description:** Deactivate (logout) all sessions for the current user (logout from all devices).

**Authentication:** Required (Bearer token)

**Request Payload:** None

**Success Response (200):**
```json
{
  "success": true,
  "message": "All sessions deactivated successfully"
}
```

**Frontend Implementation:**
```javascript
const logoutAllDevices = async () => {
  try {
    await api.delete('/sessions');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('session_id');
    return true;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

---

### 📍 Location Endpoints

All location endpoints require authentication. Device ID and Session ID should be available (set via middleware or headers).

#### 15. Update Location

**Endpoint:** `POST /api/v1/location/update`

**Description:** Update last known location for the current user/device/session.

**Authentication:** Required (Bearer token)

**Note:** Device ID and Session ID are expected to be available (from device registration and session creation).

**Request Payload:**
```json
{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "accuracy": 10
}
```

**Field Validation:**
- `latitude`: Required, -90 to 90
- `longitude`: Required, -180 to 180
- `accuracy`: Optional, >= 0 (in meters)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "accuracy": 10,
    "timestamp": "2024-01-15T10:30:00.000Z",
    "isLive": false
  },
  "message": "Location updated successfully"
}
```

**Error Responses:**
- `400`: Validation error
- `401`: Unauthorized
- `404`: Device or session not found
- `500`: Server error

**Frontend Implementation:**
```javascript
const updateLocation = async (latitude, longitude, accuracy = null) => {
  try {
    const payload = {
      latitude,
      longitude,
    };

    if (accuracy !== null) {
      payload.accuracy = accuracy;
    }

    const response = await api.post('/location/update', payload);
    return response.data.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Get current location and update
const updateCurrentLocation = async () => {
  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject);
    });

    const { latitude, longitude, accuracy } = position.coords;
    return await updateLocation(latitude, longitude, accuracy);
  } catch (error) {
    console.error('Location update failed:', error);
    throw error;
  }
};
```

---

#### 16. Get Last Known Location

**Endpoint:** `GET /api/v1/location/last-known`

**Description:** Get the last known location for the current user.

**Authentication:** Required (Bearer token)

**Request Payload:** None

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "accuracy": 10,
    "timestamp": "2024-01-15T10:30:00.000Z",
    "isLive": false,
    "device": {
      "deviceId": "550e8400-e29b-41d4-a716-446655440000",
      "deviceModel": "iPhone 14 Pro"
    }
  },
  "message": "Last known location retrieved successfully"
}
```

**Or if no location found:**
```json
{
  "success": true,
  "data": null,
  "message": "No location found"
}
```

**Frontend Implementation:**
```javascript
const getLastKnownLocation = async () => {
  try {
    const response = await api.get('/location/last-known');
    return response.data.data; // null if no location found
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

---

#### 17. Start Live Location

**Endpoint:** `POST /api/v1/location/live/start`

**Description:** Start sharing live location. Updates should be sent every 10-15 seconds.

**Authentication:** Required (Bearer token)

**Request Payload:**
```json
{
  "chatId": "chat-id-here",                           // Optional, for sharing in specific chat
  "latitude": 40.7128,
  "longitude": -74.0060,
  "accuracy": 10
}
```

**Field Validation:**
- `chatId`: Optional string
- `latitude`: Required, -90 to 90
- `longitude`: Required, -180 to 180
- `accuracy`: Optional, >= 0

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "liveSessionId": "507f1f77bcf86cd799439013",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "accuracy": 10,
    "timestamp": "2024-01-15T10:30:00.000Z",
    "isLive": true
  },
  "message": "Live location started successfully"
}
```

**Error Responses:**
- `400`: Validation error
- `401`: Unauthorized
- `404`: Device or session not found
- `500`: Server error

**Frontend Implementation:**
```javascript
let liveLocationInterval = null;
let liveSessionId = null;

const startLiveLocation = async (chatId = null) => {
  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject);
    });

    const payload = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
    };

    if (chatId) {
      payload.chatId = chatId;
    }

    const response = await api.post('/location/live/start', payload);
    liveSessionId = response.data.data.liveSessionId;

    // Start periodic updates (every 12 seconds)
    liveLocationInterval = setInterval(async () => {
      try {
        const currentPosition = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });

        await updateLiveLocation(
          liveSessionId,
          currentPosition.coords.latitude,
          currentPosition.coords.longitude,
          currentPosition.coords.accuracy
        );
      } catch (error) {
        console.error('Live location update failed:', error);
      }
    }, 12000); // 12 seconds

    return response.data.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

---

#### 18. Update Live Location

**Endpoint:** `POST /api/v1/location/live/:liveSessionId/update`

**Description:** Update live location. Should be called every 10-15 seconds while sharing live location.

**Authentication:** Required (Bearer token)

**Path Parameters:**
- `liveSessionId`: Required, live location session ID

**Request Payload:**
```json
{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "accuracy": 10
}
```

**Field Validation:**
- `latitude`: Required, -90 to 90
- `longitude`: Required, -180 to 180
- `accuracy`: Optional, >= 0

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "accuracy": 10,
    "timestamp": "2024-01-15T10:30:15.000Z",
    "isLive": true
  },
  "message": "Live location updated successfully"
}
```

**Error Responses:**
- `400`: Validation error or live session expired
- `401`: Unauthorized
- `404`: Live location session not found or inactive
- `500`: Server error

**Frontend Implementation:**
```javascript
const updateLiveLocation = async (liveSessionId, latitude, longitude, accuracy = null) => {
  try {
    const payload = {
      latitude,
      longitude,
    };

    if (accuracy !== null) {
      payload.accuracy = accuracy;
    }

    const response = await api.post(
      `/location/live/${liveSessionId}/update`,
      payload
    );
    return response.data.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

---

#### 19. Stop Live Location

**Endpoint:** `POST /api/v1/location/live/:liveSessionId/stop`

**Description:** Stop sharing live location.

**Authentication:** Required (Bearer token)

**Path Parameters:**
- `liveSessionId`: Required, live location session ID

**Request Payload:** None

**Success Response (200):**
```json
{
  "success": true,
  "message": "Live location stopped successfully"
}
```

**Error Responses:**
- `401`: Unauthorized
- `404`: Live location session not found or already stopped
- `500`: Server error

**Frontend Implementation:**
```javascript
const stopLiveLocation = async (liveSessionId) => {
  try {
    // Clear interval if running
    if (liveLocationInterval) {
      clearInterval(liveLocationInterval);
      liveLocationInterval = null;
    }

    const response = await api.post(`/location/live/${liveSessionId}/stop`);
    liveSessionId = null;
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

---

### 📇 Contact Endpoints

All contact endpoints require authentication.

#### 20. Sync Contacts

**Endpoint:** `POST /api/v1/contacts/sync`

**Description:** Sync contacts by matching hashed phone numbers. Frontend should hash phone numbers before sending.

**Authentication:** Required (Bearer token)

**Request Payload:**
```json
{
  "phoneHashes": [
    "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
    "b3a8e0e1f9ab1bfe3a36f231f676f78fb30a519d2b21e6c530c0eee8ebb4a5d0"
  ]
}
```

**Field Validation:**
- `phoneHashes`: Required array of strings, each must be exactly 64 characters (SHA-256 hash)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "contacts": [
      {
        "userId": "507f1f77bcf86cd799439011",
        "phone": "+1234567890",
        "username": "user_67890",
        "isOnline": true,
        "lastSeen": "2024-01-15T10:30:00.000Z"
      }
    ]
  }
}
```

**Frontend Implementation:**
```javascript
import crypto from 'crypto'; // Node.js
// Or use crypto-js for browser: import CryptoJS from 'crypto-js';

const hashPhoneNumber = (phone) => {
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  // Hash using SHA-256
  return crypto.createHash('sha256').update(cleaned).digest('hex');
  // For browser: return CryptoJS.SHA256(cleaned).toString();
};

const syncContacts = async (phoneNumbers) => {
  try {
    // Hash all phone numbers
    const phoneHashes = phoneNumbers.map(hashPhoneNumber);

    const response = await api.post('/contacts/sync', { phoneHashes });
    return response.data.data.contacts;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Example usage
const phoneNumbers = ['+1234567890', '+0987654321'];
const contacts = await syncContacts(phoneNumbers);
```

**Notes:**
- Phone numbers are hashed for privacy
- Only returns users who are registered in the app
- Contacts are automatically added to user's contact list

---

#### 21. Get Contacts

**Endpoint:** `GET /api/v1/contacts`

**Description:** Get all contacts for the current user.

**Authentication:** Required (Bearer token)

**Request Payload:** None

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "contacts": [
      {
        "userId": "507f1f77bcf86cd799439011",
        "phone": "+1234567890",
        "username": "user_67890",
        "isOnline": true,
        "lastSeen": "2024-01-15T10:30:00.000Z"
      }
    ]
  }
}
```

**Frontend Implementation:**
```javascript
const getContacts = async () => {
  try {
    const response = await api.get('/contacts');
    return response.data.data.contacts;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

---

### 💬 Chat Endpoints

All chat endpoints require authentication.

#### 22. Create or Get Chat

**Endpoint:** `POST /api/v1/chats`

**Description:** Create a new chat with another user or get existing chat if it already exists.

**Authentication:** Required (Bearer token)

**Request Payload:**
```json
{
  "otherUserId": "507f1f77bcf86cd799439011"
}
```

**Field Validation:**
- `otherUserId`: Required, MongoDB ObjectId (24 hex characters)

**Success Response (200 or 201):**
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439020",
    "chatId": "unique-chat-id-string",
    "participants": [
      {
        "id": "507f1f77bcf86cd799439010",
        "phone": "+1111111111",
        "username": "current_user",
        "isOnline": true,
        "lastSeen": "2024-01-15T10:30:00.000Z"
      },
      {
        "id": "507f1f77bcf86cd799439011",
        "phone": "+1234567890",
        "username": "other_user",
        "isOnline": false,
        "lastSeen": "2024-01-15T09:00:00.000Z"
      }
    ],
    "lastMessage": null,
    "lastMessageAt": null,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `400`: Invalid user ID or cannot chat with yourself
- `401`: Unauthorized
- `404`: Other user not found
- `500`: Server error

**Frontend Implementation:**
```javascript
const createOrGetChat = async (otherUserId) => {
  try {
    const response = await api.post('/chats', { otherUserId });
    return response.data.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

---

#### 23. Get User Chats

**Endpoint:** `GET /api/v1/chats`

**Description:** Get all chats for the current user, sorted by last message time.

**Authentication:** Required (Bearer token)

**Request Payload:** None

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "chats": [
      {
        "id": "507f1f77bcf86cd799439020",
        "chatId": "unique-chat-id-string",
        "otherParticipant": {
          "id": "507f1f77bcf86cd799439011",
          "phone": "+1234567890",
          "username": "other_user",
          "isOnline": true,
          "lastSeen": "2024-01-15T10:30:00.000Z"
        },
        "lastMessage": {
          "id": "507f1f77bcf86cd799439030",
          "content": "Hello!",
          "type": "text",
          "status": "read"
        },
        "lastMessageAt": "2024-01-15T10:35:00.000Z",
        "createdAt": "2024-01-15T10:30:00.000Z"
      }
    ]
  }
}
```

**Frontend Implementation:**
```javascript
const getUserChats = async () => {
  try {
    const response = await api.get('/chats');
    return response.data.data.chats;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

---

#### 24. Get Chat By ID

**Endpoint:** `GET /api/v1/chats/:chatId`

**Description:** Get chat details by chat ID.

**Authentication:** Required (Bearer token)

**Path Parameters:**
- `chatId`: Required, chat ID string

**Request Payload:** None

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439020",
    "chatId": "unique-chat-id-string",
    "participants": [
      {
        "id": "507f1f77bcf86cd799439010",
        "phone": "+1111111111",
        "username": "current_user",
        "isOnline": true,
        "lastSeen": "2024-01-15T10:30:00.000Z"
      },
      {
        "id": "507f1f77bcf86cd799439011",
        "phone": "+1234567890",
        "username": "other_user",
        "isOnline": false,
        "lastSeen": "2024-01-15T09:00:00.000Z"
      }
    ],
    "lastMessage": {
      "id": "507f1f77bcf86cd799439030",
      "content": "Hello!",
      "type": "text",
      "status": "read"
    },
    "lastMessageAt": "2024-01-15T10:35:00.000Z",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:35:00.000Z"
  }
}
```

**Error Responses:**
- `400`: Invalid chat ID format
- `401`: Unauthorized
- `403`: Not a participant of this chat
- `404`: Chat not found
- `500`: Server error

**Frontend Implementation:**
```javascript
const getChatById = async (chatId) => {
  try {
    const response = await api.get(`/chats/${chatId}`);
    return response.data.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

---

### 📨 Message Endpoints

All message endpoints require authentication.

#### 25. Send Message

**Endpoint:** `POST /api/v1/messages`

**Description:** Send a new message in a chat. Device ID is automatically captured if available.

**Authentication:** Required (Bearer token)

**Request Payload:**
```json
{
  "chatId": "unique-chat-id-string",
  "type": "text",                                      // "text", "image", "video", "voice", or "file"
  "content": "Hello, this is a test message"
}
```

**Field Validation:**
- `chatId`: Required string
- `type`: Required, must be one of: "text", "image", "video", "voice", "file"
- `content`: Required string (for media types, this is the file URL)

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439030",
    "chatId": "unique-chat-id-string",
    "sender": {
      "id": "507f1f77bcf86cd799439010",
      "phone": "+1111111111",
      "username": "current_user"
    },
    "type": "text",
    "content": "Hello, this is a test message",
    "status": "sent",
    "createdAt": "2024-01-15T10:35:00.000Z"
  },
  "message": "Message sent successfully"
}
```

**Error Responses:**
- `400`: Validation error
- `401`: Unauthorized
- `403`: Not a participant of this chat
- `404`: Chat not found
- `500`: Server error

**Frontend Implementation:**
```javascript
const sendMessage = async (chatId, type, content) => {
  try {
    const response = await api.post('/messages', {
      chatId,
      type,
      content,
    });
    return response.data.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Example: Send text message
await sendMessage('chat-id', 'text', 'Hello!');

// Example: Send image (content is file URL from media upload)
await sendMessage('chat-id', 'image', 'https://example.com/image.jpg');
```

**Notes:**
- Message is automatically delivered via Socket.IO to receiver
- Device ID is captured automatically if available
- IP address is logged automatically

---

#### 26. Get Chat Messages

**Endpoint:** `GET /api/v1/messages/chat/:chatId?limit=50&before=messageId`

**Description:** Get messages for a chat with pagination support.

**Authentication:** Required (Bearer token)

**Path Parameters:**
- `chatId`: Required, chat ID string

**Query Parameters:**
- `limit`: Optional, number of messages (1-100, default: 50)
- `before`: Optional, message ID to fetch messages before (for pagination)

**Request Payload:** None

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "507f1f77bcf86cd799439030",
        "chatId": "unique-chat-id-string",
        "sender": {
          "id": "507f1f77bcf86cd799439010",
          "phone": "+1111111111",
          "username": "current_user"
        },
        "type": "text",
        "content": "Hello!",
        "status": "read",
        "editedAt": null,
        "createdAt": "2024-01-15T10:35:00.000Z"
      }
    ]
  }
}
```

**Frontend Implementation:**
```javascript
const getChatMessages = async (chatId, limit = 50, before = null) => {
  try {
    let url = `/messages/chat/${chatId}?limit=${limit}`;
    if (before) {
      url += `&before=${before}`;
    }

    const response = await api.get(url);
    return response.data.data.messages;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Load initial messages
const messages = await getChatMessages('chat-id', 50);

// Load older messages (pagination)
const olderMessages = await getChatMessages(
  'chat-id',
  50,
  messages[messages.length - 1].id
);
```

---

#### 27. Mark Messages as Read

**Endpoint:** `PUT /api/v1/messages/:chatId/read`

**Description:** Mark all unread messages in a chat as read.

**Authentication:** Required (Bearer token)

**Path Parameters:**
- `chatId`: Required, chat ID string

**Request Payload:** None

**Success Response (200):**
```json
{
  "success": true,
  "message": "Messages marked as read"
}
```

**Frontend Implementation:**
```javascript
const markAsRead = async (chatId) => {
  try {
    const response = await api.put(`/messages/${chatId}/read`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

---

#### 28. Mark Messages as Delivered

**Endpoint:** `PUT /api/v1/messages/:chatId/delivered`

**Description:** Mark all undelivered messages in a chat as delivered.

**Authentication:** Required (Bearer token)

**Path Parameters:**
- `chatId`: Required, chat ID string

**Request Payload:** None

**Success Response (200):**
```json
{
  "success": true,
  "message": "Messages marked as delivered"
}
```

**Frontend Implementation:**
```javascript
const markAsDelivered = async (chatId) => {
  try {
    const response = await api.put(`/messages/${chatId}/delivered`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

---

#### 29. Edit Message

**Endpoint:** `PUT /api/v1/messages/:messageId/edit`

**Description:** Edit a message. Only allowed within 30 minutes and if message hasn't been read.

**Authentication:** Required (Bearer token)

**Path Parameters:**
- `messageId`: Required, MongoDB ObjectId

**Request Payload:**
```json
{
  "content": "Edited message content"
}
```

**Field Validation:**
- `content`: Required string

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439030",
    "chatId": "unique-chat-id-string",
    "sender": {
      "id": "507f1f77bcf86cd799439010",
      "phone": "+1111111111",
      "username": "current_user"
    },
    "type": "text",
    "content": "Edited message content",
    "status": "sent",
    "editedAt": "2024-01-15T10:40:00.000Z",
    "createdAt": "2024-01-15T10:35:00.000Z"
  },
  "message": "Message edited successfully"
}
```

**Error Responses:**
- `400`: Validation error, message already read, or time limit exceeded (30 minutes)
- `401`: Unauthorized
- `403`: Not the message sender
- `404`: Message not found
- `500`: Server error

**Frontend Implementation:**
```javascript
const editMessage = async (messageId, newContent) => {
  try {
    const response = await api.put(`/messages/${messageId}/edit`, {
      content: newContent
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

**Important Notes:**
- Message can only be edited within 30 minutes of creation
- Message cannot be edited if it has been read by the receiver
- Only the message sender can edit their own messages
- The `editedAt` timestamp is automatically set when message is edited

---

#### 30. Delete Message

**Endpoint:** `DELETE /api/v1/messages/:messageId`

**Description:** Delete a message. Can delete for yourself only or for everyone (if not read).

**Authentication:** Required (Bearer token)

**Path Parameters:**
- `messageId`: Required, MongoDB ObjectId

**Query Parameters:**
- `deleteForEveryone`: Optional, boolean string ("true" or "false"), default: "false"
  - `true`: Delete message for both participants (only if message hasn't been read)
  - `false`: Delete message only for yourself

**Request Payload:** None

**Success Response (200):**
```json
{
  "success": true,
  "message": "Message deleted successfully"
}
```

**Error Responses:**
- `400`: Validation error or trying to delete read message for everyone
- `401`: Unauthorized
- `403`: Not the message sender
- `404`: Message not found
- `500`: Server error

**Frontend Implementation:**
```javascript
const deleteMessage = async (messageId, deleteForEveryone = false) => {
  try {
    const response = await api.delete(`/messages/${messageId}`, {
      params: {
        deleteForEveryone: deleteForEveryone.toString()
      }
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

**Important Notes:**
- Only the message sender can delete messages
- "Delete for everyone" is only allowed if message hasn't been read
- "Delete for me" is always allowed regardless of read status
- When deleted for everyone, message is permanently removed from database
- When deleted for me, message remains but is hidden from your view

---

### 📞 Call Endpoints

#### 31. Initiate Call

**Endpoint:** `POST /api/v1/calls`

**Description:** Initiate a voice call to another user.

**Authentication:** Required (Bearer token)

**Request Payload:**
```json
{
  "receiverId": "507f1f77bcf86cd799439020"
}
```

**Field Validation:**
- `receiverId`: Required, MongoDB ObjectId of the user to call

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439040",
    "caller": {
      "id": "507f1f77bcf86cd799439010",
      "phone": "+1111111111",
      "username": "caller_user"
    },
    "receiver": {
      "id": "507f1f77bcf86cd799439020",
      "phone": "+2222222222",
      "username": "receiver_user"
    },
    "status": "ringing",
    "createdAt": "2024-01-15T10:45:00.000Z"
  },
  "message": "Call initiated"
}
```

**Error Responses:**
- `400`: Validation error or trying to call yourself
- `401`: Unauthorized
- `404`: Receiver not found
- `500`: Server error

**Frontend Implementation:**
```javascript
const initiateCall = async (receiverId) => {
  try {
    const response = await api.post('/calls', {
      receiverId
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

**Socket.IO Event:**
After initiating call via REST API, the receiver will receive a `call:incoming` event via Socket.IO:
```javascript
socket.on('call:incoming', (data) => {
  // data.callId - Call ID
  // data.callerId - Caller user ID
  // data.rtcConfig - WebRTC configuration (STUN/TURN servers)
});
```

---

#### 32. Answer Call

**Endpoint:** `POST /api/v1/calls/:callId/answer`

**Description:** Answer an incoming call.

**Authentication:** Required (Bearer token)

**Path Parameters:**
- `callId`: Required, MongoDB ObjectId of the call

**Request Payload:** None

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439040",
    "caller": {
      "id": "507f1f77bcf86cd799439010",
      "phone": "+1111111111",
      "username": "caller_user"
    },
    "receiver": {
      "id": "507f1f77bcf86cd799439020",
      "phone": "+2222222222",
      "username": "receiver_user"
    },
    "status": "answered",
    "startedAt": "2024-01-15T10:45:30.000Z",
    "createdAt": "2024-01-15T10:45:00.000Z"
  },
  "message": "Call answered"
}
```

**Error Responses:**
- `400`: Call cannot be answered in current state
- `401`: Unauthorized
- `403`: Only the receiver can answer the call
- `404`: Call not found
- `500`: Server error

**Frontend Implementation:**
```javascript
const answerCall = async (callId) => {
  try {
    const response = await api.post(`/calls/${callId}/answer`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

**Socket.IO Events:**
- Caller receives: `call:answered` event
- Receiver receives: `call:connected` event

---

#### 33. Reject Call

**Endpoint:** `POST /api/v1/calls/:callId/reject`

**Description:** Reject an incoming call.

**Authentication:** Required (Bearer token)

**Path Parameters:**
- `callId`: Required, MongoDB ObjectId of the call

**Request Payload:** None

**Success Response (200):**
```json
{
  "success": true,
  "message": "Call rejected"
}
```

**Error Responses:**
- `401`: Unauthorized
- `403`: Only the receiver can reject the call
- `404`: Call not found
- `500`: Server error

**Frontend Implementation:**
```javascript
const rejectCall = async (callId) => {
  try {
    const response = await api.post(`/calls/${callId}/reject`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

**Socket.IO Event:**
Caller receives: `call:rejected` event

---

#### 34. End Call

**Endpoint:** `POST /api/v1/calls/:callId/end`

**Description:** End an ongoing call. Can be called by either participant.

**Authentication:** Required (Bearer token)

**Path Parameters:**
- `callId`: Required, MongoDB ObjectId of the call

**Request Payload:** None

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439040",
    "caller": {
      "id": "507f1f77bcf86cd799439010",
      "phone": "+1111111111",
      "username": "caller_user"
    },
    "receiver": {
      "id": "507f1f77bcf86cd799439020",
      "phone": "+2222222222",
      "username": "receiver_user"
    },
    "status": "ended",
    "startedAt": "2024-01-15T10:45:30.000Z",
    "endedAt": "2024-01-15T10:50:00.000Z",
    "duration": 270,
    "createdAt": "2024-01-15T10:45:00.000Z"
  },
  "message": "Call ended"
}
```

**Error Responses:**
- `401`: Unauthorized
- `403`: Not a participant of this call
- `404`: Call not found
- `500`: Server error

**Frontend Implementation:**
```javascript
const endCall = async (callId) => {
  try {
    const response = await api.post(`/calls/${callId}/end`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

**Socket.IO Event:**
Both participants receive: `call:ended` event with `endedBy` field indicating who ended the call

---

#### 35. Get Call History

**Endpoint:** `GET /api/v1/calls/history`

**Description:** Get call history for the current user.

**Authentication:** Required (Bearer token)

**Query Parameters:**
- `limit`: Optional, number (1-100), default: 50

**Request Payload:** None

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "calls": [
      {
        "id": "507f1f77bcf86cd799439040",
        "caller": {
          "id": "507f1f77bcf86cd799439010",
          "phone": "+1111111111",
          "username": "caller_user"
        },
        "receiver": {
          "id": "507f1f77bcf86cd799439020",
          "phone": "+2222222222",
          "username": "receiver_user"
        },
        "status": "ended",
        "startedAt": "2024-01-15T10:45:30.000Z",
        "endedAt": "2024-01-15T10:50:00.000Z",
        "duration": 270,
        "createdAt": "2024-01-15T10:45:00.000Z"
      }
    ]
  }
}
```

**Frontend Implementation:**
```javascript
const getCallHistory = async (limit = 50) => {
  try {
    const response = await api.get('/calls/history', {
      params: { limit }
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

---

### 📁 Media Endpoints

#### 36. Upload File

**Endpoint:** `POST /api/v1/media/upload`

**Description:** Upload a media file (image, video, audio, or document).

**Authentication:** Required (Bearer token)

**Content Type:** `multipart/form-data`

**Request Payload:**
- Form field: `file` (File object)
  - Max file size: 10MB (configurable)
  - Supported types: All file types

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "url": "https://example.com/uploads/files/filename.jpg",
    "filename": "original-filename.jpg",
    "size": 1024000,
    "mimetype": "image/jpeg"
  },
  "message": "File uploaded successfully"
}
```

**Error Responses:**
- `400`: File too large or invalid
- `401`: Unauthorized
- `500`: Server error or storage provider error

**Frontend Implementation:**
```javascript
const uploadFile = async (file) => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

**Important Notes:**
- File is stored either locally or on Cloudinary (based on configuration)
- URL returned can be used in message content
- For images/videos, use the URL as message content with appropriate type

---

#### 37. Delete File

**Endpoint:** `DELETE /api/v1/media`

**Description:** Delete a previously uploaded file.

**Authentication:** Required (Bearer token)

**Request Payload:**
```json
{
  "url": "https://example.com/uploads/files/filename.jpg"
}
```

**Field Validation:**
- `url`: Required, valid URI string

**Success Response (200):**
```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

**Error Responses:**
- `400`: Invalid URL
- `401`: Unauthorized
- `404`: File not found
- `500`: Server error

**Frontend Implementation:**
```javascript
const deleteFile = async (fileUrl) => {
  try {
    const response = await api.delete('/media', {
      data: { url: fileUrl }
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

---

### ❤️ Health Check

#### 38. Health Check

**Endpoint:** `GET /health`

**Description:** Check if the server is running and healthy.

**Authentication:** Not required

**Request Payload:** None

**Success Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

**Frontend Implementation:**
```javascript
const checkHealth = async () => {
  try {
    const response = await api.get('/health');
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

---

## Socket.IO Real-time Communication

### Connection Setup

**Base URL:** Same as API base URL

**Connection:**
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: 'your-jwt-token-here'
  },
  transports: ['websocket', 'polling']
});
```

**Authentication:**
- Token must be provided in `auth.token` or `Authorization` header
- Token is validated on connection
- Connection will fail if token is invalid or expired

---

### Client → Server Events

#### 1. message:send

**Event:** `message:send`

**Description:** Send a message via Socket.IO (alternative to REST API).

**Payload:**
```json
{
  "chatId": "unique-chat-id-string",
  "type": "text",
  "content": "Hello, this is a message"
}
```

**Response Events:**
- `message:sent` - Confirmation to sender
- `message:new` - Broadcast to all chat participants

**Frontend Implementation:**
```javascript
socket.emit('message:send', {
  chatId: 'chat-id-here',
  type: 'text',
  content: 'Hello!'
});

socket.on('message:sent', (message) => {
  console.log('Message sent:', message);
});

socket.on('message:new', (message) => {
  console.log('New message received:', message);
});
```

---

#### 2. message:read

**Event:** `message:read`

**Description:** Mark messages in a chat as read.

**Payload:**
```json
{
  "chatId": "unique-chat-id-string"
}
```

**Response Events:**
- `message:read` - Broadcast to chat participants with read receipt

**Frontend Implementation:**
```javascript
socket.emit('message:read', {
  chatId: 'chat-id-here'
});

socket.on('message:read', (data) => {
  console.log('Messages read by:', data.readBy);
  console.log('Timestamp:', data.timestamp);
});
```

---

#### 3. message:delivered

**Event:** `message:delivered`

**Description:** Mark messages in a chat as delivered.

**Payload:**
```json
{
  "chatId": "unique-chat-id-string"
}
```

**Response Events:**
- `message:delivered` - Broadcast to chat participants with delivery receipt

**Frontend Implementation:**
```javascript
socket.emit('message:delivered', {
  chatId: 'chat-id-here'
});

socket.on('message:delivered', (data) => {
  console.log('Messages delivered to:', data.deliveredTo);
  console.log('Timestamp:', data.timestamp);
});
```

---

#### 4. chat:join

**Event:** `chat:join`

**Description:** Join a chat room to receive real-time updates.

**Payload:**
```json
{
  "chatId": "unique-chat-id-string"
}
```

**Response Events:**
- `chat:joined` - Confirmation that you joined the room
- `error` - If chat not found or not a participant

**Frontend Implementation:**
```javascript
socket.emit('chat:join', {
  chatId: 'chat-id-here'
});

socket.on('chat:joined', (data) => {
  console.log('Joined chat:', data.chatId);
});
```

---

#### 5. chat:leave

**Event:** `chat:leave`

**Description:** Leave a chat room.

**Payload:**
```json
{
  "chatId": "unique-chat-id-string"
}
```

**Response Events:**
- `chat:left` - Confirmation that you left the room

**Frontend Implementation:**
```javascript
socket.emit('chat:leave', {
  chatId: 'chat-id-here'
});

socket.on('chat:left', (data) => {
  console.log('Left chat:', data.chatId);
});
```

---

#### 6. call:initiate

**Event:** `call:initiate`

**Description:** Initiate a call via Socket.IO.

**Payload:**
```json
{
  "receiverId": "507f1f77bcf86cd799439020"
}
```

**Response Events:**
- `call:initiated` - Confirmation to caller with RTC config
- `call:incoming` - Sent to receiver

**Frontend Implementation:**
```javascript
socket.emit('call:initiate', {
  receiverId: 'user-id-here'
});

socket.on('call:initiated', (data) => {
  console.log('Call initiated:', data.callId);
  console.log('RTC Config:', data.rtcConfig);
});
```

---

#### 7. call:answer

**Event:** `call:answer`

**Description:** Answer an incoming call.

**Payload:**
```json
{
  "callId": "507f1f77bcf86cd799439040"
}
```

**Response Events:**
- `call:connected` - Confirmation to receiver
- `call:answered` - Sent to caller

**Frontend Implementation:**
```javascript
socket.emit('call:answer', {
  callId: 'call-id-here'
});

socket.on('call:connected', (data) => {
  console.log('Call connected:', data.callId);
});
```

---

#### 8. call:reject

**Event:** `call:reject`

**Description:** Reject an incoming call.

**Payload:**
```json
{
  "callId": "507f1f77bcf86cd799439040"
}
```

**Response Events:**
- `call:rejected` - Confirmation to receiver
- `call:rejected` - Sent to caller

**Frontend Implementation:**
```javascript
socket.emit('call:reject', {
  callId: 'call-id-here'
});

socket.on('call:rejected', (data) => {
  console.log('Call rejected:', data.callId);
});
```

---

#### 9. call:end

**Event:** `call:end`

**Description:** End an ongoing call.

**Payload:**
```json
{
  "callId": "507f1f77bcf86cd799439040"
}
```

**Response Events:**
- `call:ended` - Broadcast to both participants

**Frontend Implementation:**
```javascript
socket.emit('call:end', {
  callId: 'call-id-here'
});

socket.on('call:ended', (data) => {
  console.log('Call ended:', data.callId);
  console.log('Ended by:', data.endedBy);
});
```

---

#### 10. call:webrtc-offer

**Event:** `call:webrtc-offer`

**Description:** Send WebRTC offer to establish peer connection.

**Payload:**
```json
{
  "callId": "507f1f77bcf86cd799439040",
  "offer": { /* RTCSessionDescriptionInit object */ },
  "receiverId": "507f1f77bcf86cd799439020"
}
```

**Response Events:**
- `call:webrtc-offer` - Forwarded to receiver

**Frontend Implementation:**
```javascript
socket.emit('call:webrtc-offer', {
  callId: 'call-id-here',
  offer: rtcOffer,
  receiverId: 'receiver-id-here'
});

socket.on('call:webrtc-offer', (data) => {
  console.log('Received offer:', data.offer);
  // Handle WebRTC offer
});
```

---

#### 11. call:webrtc-answer

**Event:** `call:webrtc-answer`

**Description:** Send WebRTC answer in response to offer.

**Payload:**
```json
{
  "callId": "507f1f77bcf86cd799439040",
  "answer": { /* RTCSessionDescriptionInit object */ },
  "callerId": "507f1f77bcf86cd799439010"
}
```

**Response Events:**
- `call:webrtc-answer` - Forwarded to caller

**Frontend Implementation:**
```javascript
socket.emit('call:webrtc-answer', {
  callId: 'call-id-here',
  answer: rtcAnswer,
  callerId: 'caller-id-here'
});

socket.on('call:webrtc-answer', (data) => {
  console.log('Received answer:', data.answer);
  // Handle WebRTC answer
});
```

---

#### 12. call:webrtc-ice-candidate

**Event:** `call:webrtc-ice-candidate`

**Description:** Send WebRTC ICE candidate for peer connection.

**Payload:**
```json
{
  "callId": "507f1f77bcf86cd799439040",
  "candidate": { /* RTCIceCandidate object */ },
  "receiverId": "507f1f77bcf86cd799439020"
}
```

**Response Events:**
- `call:webrtc-ice-candidate` - Forwarded to receiver

**Frontend Implementation:**
```javascript
socket.emit('call:webrtc-ice-candidate', {
  callId: 'call-id-here',
  candidate: iceCandidate,
  receiverId: 'receiver-id-here'
});

socket.on('call:webrtc-ice-candidate', (data) => {
  console.log('Received ICE candidate:', data.candidate);
  // Handle ICE candidate
});
```

---

### Server → Client Events

#### 1. message:new

**Event:** `message:new`

**Description:** New message received in a chat.

**Payload:**
```json
{
  "id": "507f1f77bcf86cd799439030",
  "chatId": "unique-chat-id-string",
  "sender": {
    "id": "507f1f77bcf86cd799439010",
    "phone": "+1111111111",
    "username": "sender_user"
  },
  "type": "text",
  "content": "Hello!",
  "status": "sent",
  "createdAt": "2024-01-15T10:35:00.000Z"
}
```

**Frontend Implementation:**
```javascript
socket.on('message:new', (message) => {
  // Add message to chat UI
  addMessageToChat(message);

  // Mark as delivered
  socket.emit('message:delivered', { chatId: message.chatId });
});
```

---

#### 2. message:sent

**Event:** `message:sent`

**Description:** Confirmation that your message was sent.

**Payload:** Same as `message:new`

**Frontend Implementation:**
```javascript
socket.on('message:sent', (message) => {
  // Update message in UI with sent confirmation
  updateMessageStatus(message.id, 'sent');
});
```

---

#### 3. message:read

**Event:** `message:read`

**Description:** Read receipt notification.

**Payload:**
```json
{
  "chatId": "unique-chat-id-string",
  "readBy": "507f1f77bcf86cd799439020",
  "timestamp": "2024-01-15T10:36:00.000Z"
}
```

**Frontend Implementation:**
```javascript
socket.on('message:read', (data) => {
  // Update message status to read in UI
  updateMessagesStatus(data.chatId, 'read', data.readBy);
});
```

---

#### 4. message:delivered

**Event:** `message:delivered`

**Description:** Delivery receipt notification.

**Payload:**
```json
{
  "chatId": "unique-chat-id-string",
  "deliveredTo": "507f1f77bcf86cd799439020",
  "timestamp": "2024-01-15T10:35:30.000Z"
}
```

**Frontend Implementation:**
```javascript
socket.on('message:delivered', (data) => {
  // Update message status to delivered in UI
  updateMessagesStatus(data.chatId, 'delivered', data.deliveredTo);
});
```

---

#### 5. chat:updated

**Event:** `chat:updated`

**Description:** Chat list update (e.g., new last message).

**Payload:**
```json
{
  "id": "507f1f77bcf86cd799439025",
  "chatId": "unique-chat-id-string",
  "otherParticipant": {
    "id": "507f1f77bcf86cd799439020",
    "phone": "+2222222222",
    "username": "other_user",
    "isOnline": true,
    "lastSeen": "2024-01-15T10:30:00.000Z"
  },
  "lastMessage": { /* Message object */ },
  "lastMessageAt": "2024-01-15T10:35:00.000Z",
  "createdAt": "2024-01-15T09:00:00.000Z"
}
```

**Frontend Implementation:**
```javascript
socket.on('chat:updated', (chat) => {
  // Update chat in chat list
  updateChatInList(chat);
});
```

---

#### 6. call:incoming

**Event:** `call:incoming`

**Description:** Incoming call notification.

**Payload:**
```json
{
  "callId": "507f1f77bcf86cd799439040",
  "callerId": "507f1f77bcf86cd799439010",
  "rtcConfig": {
    "iceServers": [
      { "urls": "stun:stun.l.google.com:19302" }
    ]
  }
}
```

**Frontend Implementation:**
```javascript
socket.on('call:incoming', (data) => {
  // Show incoming call UI
  showIncomingCall(data);

  // Store RTC config for WebRTC setup
  rtcConfig = data.rtcConfig;
});
```

---

#### 7. call:initiated

**Event:** `call:initiated`

**Description:** Call initiation confirmation.

**Payload:**
```json
{
  "callId": "507f1f77bcf86cd799439040",
  "receiverId": "507f1f77bcf86cd799439020",
  "rtcConfig": {
    "iceServers": [
      { "urls": "stun:stun.l.google.com:19302" }
    ]
  }
}
```

**Frontend Implementation:**
```javascript
socket.on('call:initiated', (data) => {
  // Show calling UI
  showCallingUI(data);

  // Store RTC config
  rtcConfig = data.rtcConfig;
});
```

---

#### 8. call:answered

**Event:** `call:answered`

**Description:** Call answered notification (sent to caller).

**Payload:**
```json
{
  "callId": "507f1f77bcf86cd799439040",
  "receiverId": "507f1f77bcf86cd799439020"
}
```

**Frontend Implementation:**
```javascript
socket.on('call:answered', (data) => {
  // Start WebRTC connection
  startWebRTC(data.callId);
});
```

---

#### 9. call:connected

**Event:** `call:connected`

**Description:** Call connected confirmation (sent to receiver).

**Payload:**
```json
{
  "callId": "507f1f77bcf86cd799439040",
  "callerId": "507f1f77bcf86cd799439010"
}
```

**Frontend Implementation:**
```javascript
socket.on('call:connected', (data) => {
  // Start WebRTC connection
  startWebRTC(data.callId);
});
```

---

#### 10. call:rejected

**Event:** `call:rejected`

**Description:** Call rejected notification.

**Payload:**
```json
{
  "callId": "507f1f77bcf86cd799439040",
  "receiverId": "507f1f77bcf86cd799439020"
}
```

**Frontend Implementation:**
```javascript
socket.on('call:rejected', (data) => {
  // Show call rejected message
  showCallRejected();
});
```

---

#### 11. call:ended

**Event:** `call:ended`

**Description:** Call ended notification.

**Payload:**
```json
{
  "callId": "507f1f77bcf86cd799439040",
  "endedBy": "507f1f77bcf86cd799439010"
}
```

**Frontend Implementation:**
```javascript
socket.on('call:ended', (data) => {
  // Cleanup WebRTC
  cleanupWebRTC();

  // Hide call UI
  hideCallUI();
});
```

---

#### 12. user:online

**Event:** `user:online`

**Description:** User came online notification.

**Payload:**
```json
{
  "userId": "507f1f77bcf86cd799439020",
  "timestamp": "2024-01-15T10:40:00.000Z"
}
```

**Frontend Implementation:**
```javascript
socket.on('user:online', (data) => {
  // Update user online status in UI
  updateUserStatus(data.userId, true);
});
```

---

#### 13. user:offline

**Event:** `user:offline`

**Description:** User went offline notification.

**Payload:**
```json
{
  "userId": "507f1f77bcf86cd799439020",
  "timestamp": "2024-01-15T10:45:00.000Z"
}
```

**Frontend Implementation:**
```javascript
socket.on('user:offline', (data) => {
  // Update user offline status in UI
  updateUserStatus(data.userId, false);
});
```

---

#### 14. call:error

**Event:** `call:error`

**Description:** Call error notification.

**Payload:**
```json
{
  "message": "Failed to initiate call"
}
```

**Frontend Implementation:**
```javascript
socket.on('call:error', (data) => {
  // Show error message
  showError(data.message);
});
```

---

#### 15. error

**Event:** `error`

**Description:** General error notification.

**Payload:**
```json
{
  "message": "Error description"
}
```

**Frontend Implementation:**
```javascript
socket.on('error', (data) => {
  // Show error message
  showError(data.message);
});
```

---

## Complete Workflows

### Workflow 1: User Registration & Login (Phone OTP)

**Step 1: Request OTP**
```javascript
const phone = '+1234567890';
const response = await api.post('/auth/request-otp', { phone });
// OTP is sent to phone (in production) or logged (in development)
```

**Step 2: Verify OTP & Register Device**
```javascript
const otp = '123456';
const deviceInfo = {
  deviceId: generateDeviceId(), // UUID
  deviceModel: 'iPhone 14 Pro',
  manufacturer: 'Apple',
  osName: 'iOS',
  osVersion: '17.0',
  appVersion: '1.0.0',
  platform: 'iOS',
  imei: '123456789012345' // Optional, 15 digits
};

const response = await api.post('/auth/verify-otp', {
  phone,
  otp,
  deviceId: deviceInfo.deviceId,
  location: {
    latitude: 40.7128,
    longitude: -74.0060,
    accuracy: 10
  }
});

// Save token
const { token, user, session } = response.data.data;
localStorage.setItem('auth_token', token);
localStorage.setItem('user_id', user.id);
localStorage.setItem('session_id', session?.sessionId);

// Register device with full info
await api.post('/devices/register', deviceInfo);
```

**Step 3: Setup Socket.IO Connection**
```javascript
const socket = io(API_BASE_URL, {
  auth: { token }
});

socket.on('connect', () => {
  console.log('Connected to server');
});
```

---

### Workflow 2: User Registration & Login (Google OAuth)

**Step 1: Get Google ID Token**
```javascript
// Use Google Sign-In SDK to get idToken
const { idToken } = await googleSignIn();
```

**Step 2: Authenticate with Google**
```javascript
const phone = '+1234567890'; // Still required!
const deviceInfo = { /* same as above */ };

const response = await api.post('/auth/google', {
  idToken,
  phone,
  deviceId: deviceInfo.deviceId,
  location: {
    latitude: 40.7128,
    longitude: -74.0060,
    accuracy: 10
  }
});

const { token, user, session } = response.data.data;
// Save tokens and setup socket same as phone OTP
```

---

### Workflow 3: Complete Chat Flow

**Step 1: Sync Contacts**
```javascript
// Hash phone numbers on client side
const phoneHashes = contacts.map(contact => hashPhone(contact.phone));

const response = await api.post('/contacts/sync', {
  phoneHashes
});

const contacts = response.data.data.contacts;
```

**Step 2: Create or Get Chat**
```javascript
const otherUserId = contacts[0].userId;

const response = await api.post('/chats', {
  otherUserId
});

const chat = response.data.data;
const chatId = chat.chatId;
```

**Step 3: Join Chat Room (Socket.IO)**
```javascript
socket.emit('chat:join', { chatId });

socket.on('chat:joined', (data) => {
  console.log('Joined chat:', data.chatId);
});
```

**Step 4: Send Message**
```javascript
// Via REST API
const message = await api.post('/messages', {
  chatId,
  type: 'text',
  content: 'Hello!'
});

// Or via Socket.IO
socket.emit('message:send', {
  chatId,
  type: 'text',
  content: 'Hello!'
});
```

**Step 5: Listen for New Messages**
```javascript
socket.on('message:new', (message) => {
  // Add message to chat UI
  addMessageToChat(message);

  // Mark as delivered
  socket.emit('message:delivered', { chatId: message.chatId });
});
```

**Step 6: Mark as Read**
```javascript
// When user opens chat
socket.emit('message:read', { chatId });

// Or via REST API
await api.put(`/messages/${chatId}/read`);
```

---

### Workflow 4: Complete Call Flow

**Step 1: Initiate Call**
```javascript
const call = await api.post('/calls', {
  receiverId: 'user-id-here'
});

const callId = call.data.data.id;
```

**Step 2: Listen for Call Events**
```javascript
// Caller side
socket.on('call:answered', (data) => {
  console.log('Call answered, start WebRTC');
  startWebRTC(data.callId);
});

socket.on('call:rejected', (data) => {
  console.log('Call rejected');
  showCallRejected();
});

// Receiver side
socket.on('call:incoming', (data) => {
  showIncomingCall(data);
  // User can answer or reject
});
```

**Step 3: Answer Call**
```javascript
// Receiver answers
await api.post(`/calls/${callId}/answer`);

// Or via Socket.IO
socket.emit('call:answer', { callId });
```

**Step 4: WebRTC Signaling**
```javascript
// Caller creates offer
const offer = await peerConnection.createOffer();
await peerConnection.setLocalDescription(offer);

socket.emit('call:webrtc-offer', {
  callId,
  offer,
  receiverId: 'receiver-id'
});

// Receiver receives offer
socket.on('call:webrtc-offer', async (data) => {
  await peerConnection.setRemoteDescription(data.offer);

  // Create answer
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  socket.emit('call:webrtc-answer', {
    callId: data.callId,
    answer,
    callerId: data.callerId
  });
});

// Handle ICE candidates
peerConnection.onicecandidate = (event) => {
  if (event.candidate) {
    socket.emit('call:webrtc-ice-candidate', {
      callId,
      candidate: event.candidate,
      receiverId: 'receiver-id'
    });
  }
};

socket.on('call:webrtc-ice-candidate', async (data) => {
  await peerConnection.addIceCandidate(data.candidate);
});
```

**Step 5: End Call**
```javascript
await api.post(`/calls/${callId}/end`);

socket.on('call:ended', (data) => {
  console.log('Call ended');
  cleanupWebRTC();
});
```

---

### Workflow 5: Live Location Sharing

**Step 1: Start Live Location**
```javascript
const response = await api.post('/location/live/start', {
  chatId: 'chat-id-here', // Optional
  latitude: 40.7128,
  longitude: -74.0060,
  accuracy: 10
});

const liveSessionId = response.data.data.liveSessionId;
```

**Step 2: Update Location Every 10-15 Seconds**
```javascript
const locationInterval = setInterval(async () => {
  const position = await getCurrentPosition();

  await api.post(`/location/live/${liveSessionId}/update`, {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy
  });
}, 12000); // 12 seconds
```

**Step 3: Stop Live Location**
```javascript
clearInterval(locationInterval);

await api.post(`/location/live/${liveSessionId}/stop`);
```

---

## Error Handling

### Standard Error Response Format

All errors follow this structure:

```json
{
  "success": false,
  "error": "Error type",
  "message": "Human-readable error message"
}
```

### HTTP Status Codes

- `200`: Success
- `201`: Created
- `400`: Bad Request (validation error, invalid input)
- `401`: Unauthorized (missing or invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found (resource doesn't exist)
- `429`: Too Many Requests (rate limit exceeded)
- `500`: Internal Server Error

### Common Error Scenarios

**1. Invalid Token:**
```json
{
  "success": false,
  "error": "UnauthorizedError",
  "message": "Invalid or expired token"
}
```

**Solution:** Redirect to login, request new token

**2. Validation Error:**
```json
{
  "success": false,
  "error": "ValidationError",
  "message": "Phone number must be in E.164 format"
}
```

**Solution:** Show validation message to user, fix input

**3. Rate Limit Exceeded:**
```json
{
  "success": false,
  "error": "AppError",
  "message": "Too many OTP requests. Please try again later."
}
```

**Solution:** Show message, disable button temporarily

**4. Resource Not Found:**
```json
{
  "success": false,
  "error": "NotFoundError",
  "message": "Chat not found"
}
```

**Solution:** Show error, redirect or refresh

### Error Handling Implementation

```javascript
// Global error handler
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const { status, data } = error.response || {};

    switch (status) {
      case 401:
        // Token expired or invalid
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
        break;

      case 403:
        // Permission denied
        showError(data.message || 'Permission denied');
        break;

      case 404:
        // Resource not found
        showError(data.message || 'Resource not found');
        break;

      case 429:
        // Rate limited
        showError('Rate limit exceeded. Please try again later.');
        break;

      case 500:
        // Server error
        showError('Server error. Please try again later.');
        break;

      default:
        showError(data?.message || 'An error occurred');
    }

    return Promise.reject(error);
  }
);
```

---

## Best Practices

### 1. Token Management

- **Store securely:** Use secure storage (httpOnly cookies in web, Keychain in iOS, Keystore in Android)
- **Refresh before expiry:** Check token expiry and refresh proactively
- **Handle expiry:** Implement automatic logout and redirect on 401

### 2. Device Registration

- **Register on first launch:** Register device immediately after authentication
- **Update on app update:** Re-register device when app version changes
- **Handle IMEI carefully:** Only collect IMEI if user grants permission

### 3. Session Management

- **Create session on login:** Always create session after successful authentication
- **Track active sessions:** Show user their active sessions in settings
- **Logout properly:** Call deactivate session endpoint on logout

### 4. Location Tracking

- **Request permissions:** Request location permission before using location features
- **Handle accuracy:** Use accuracy value to show location confidence
- **Update intervals:** For live location, update every 10-15 seconds (not more frequent)
- **Stop properly:** Always stop live location when user closes app or stops sharing

### 5. Message Handling

- **Use Socket.IO for real-time:** Prefer Socket.IO for sending/receiving messages
- **Use REST for history:** Use REST API for loading message history
- **Handle delivery receipts:** Mark messages as delivered when received
- **Handle read receipts:** Mark messages as read when user views chat
- **Optimistic updates:** Show messages immediately, sync with server

### 6. Call Handling

- **Use REST for initiation:** Use REST API to create call record
- **Use Socket.IO for signaling:** Use Socket.IO for WebRTC signaling
- **Handle all states:** Handle all call states (ringing, answered, rejected, ended)
- **Cleanup on disconnect:** Clean up WebRTC connections properly

### 7. Error Handling

- **Show user-friendly messages:** Don't show technical error messages
- **Retry logic:** Implement retry for network errors
- **Offline handling:** Handle offline scenarios gracefully
- **Logging:** Log errors for debugging but don't expose to users

### 8. Performance

- **Pagination:** Always use pagination for lists (messages, calls, chats)
- **Caching:** Cache user data, chat lists, etc.
- **Lazy loading:** Load messages on demand, not all at once
- **Debouncing:** Debounce search and typing indicators

### 9. Security

- **Never expose tokens:** Don't log or expose JWT tokens
- **Validate inputs:** Validate all inputs on client side before sending
- **HTTPS only:** Always use HTTPS in production
- **Secure storage:** Use secure storage for sensitive data

### 10. Socket.IO Best Practices

- **Reconnect logic:** Implement automatic reconnection
- **Connection state:** Track connection state and show to user
- **Event cleanup:** Remove event listeners on component unmount
- **Room management:** Join/leave rooms as user navigates

---

## Code Examples

### Complete API Client Setup

```javascript
// api.js
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

### Complete Socket.IO Setup

```javascript
// socket.js
import io from 'socket.io-client';

let socket = null;

export const connectSocket = (token) => {
  socket = io(API_BASE_URL, {
    auth: { token },
    transports: ['websocket', 'polling']
  });

  socket.on('connect', () => {
    console.log('Socket connected');
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
```

### Complete Authentication Hook

```javascript
// useAuth.js
import { useState, useEffect } from 'react';
import api from './api';
import { connectSocket } from './socket';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('auth_token'));

  useEffect(() => {
    if (token) {
      // Verify token and get user
      api.get('/users/profile')
        .then((response) => {
          setUser(response.data.data);
          connectSocket(token);
        })
        .catch(() => {
          localStorage.removeItem('auth_token');
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (phone, otp, deviceInfo, location) => {
    const response = await api.post('/auth/verify-otp', {
      phone,
      otp,
      deviceId: deviceInfo.deviceId,
      location
    });

    const { token: newToken, user: newUser, session } = response.data.data;
    localStorage.setItem('auth_token', newToken);
    setToken(newToken);
    setUser(newUser);

    // Register device
    await api.post('/devices/register', deviceInfo);

    // Connect socket
    connectSocket(newToken);

    return { user: newUser, session };
  };

  const logout = async () => {
    try {
      await api.delete('/sessions'); // Deactivate all sessions
    } catch (error) {
      console.error('Logout error:', error);
    }

    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
    disconnectSocket();
  };

  return { user, loading, login, logout, isAuthenticated: !!token };
};
```

---

## Summary

This guide covers **every endpoint, payload, response, and workflow** for integrating with the Chat App Backend API. Key points:

1. **38 REST API endpoints** covering authentication, users, devices, sessions, location, contacts, chats, messages, calls, and media
2. **15 Socket.IO events** for real-time communication
3. **Complete workflows** for common use cases
4. **Error handling** patterns and best practices
5. **Code examples** for quick integration

For questions or issues, refer to the API responses and error messages, which provide detailed information about what went wrong and how to fix it.

**Happy coding! 🚀**
