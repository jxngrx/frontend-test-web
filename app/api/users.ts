/**
 * Users API
 *
 * Maps exactly to the Users endpoints from Postman collection:
 * - GET /api/v1/users/profile
 * - PUT /api/v1/users/username
 * - GET /api/v1/users/:userId
 * - GET /api/v1/users/search?q=searchterm
 */

import { createApiClient } from './client';

export interface User {
  id: string;
  phone: string;
  username?: string;
  isOnline?: boolean;
  lastSeen?: string;
  createdAt?: string;
}

export interface UserProfileResponse {
  data: User;
}

export interface UsersListResponse {
  data: User[];
}

export interface SearchUsersResponse {
  success: boolean;
  data: {
    users: User[];
  };
}

export interface UpdateUsernameRequest {
  username: string;
}

/**
 * Get current user profile
 * GET /api/v1/users/profile
 * Requires: Bearer token
 */
export const getProfile = async (token: string): Promise<User> => {
  const client = createApiClient(token);
  const response = await client.get<UserProfileResponse>('/api/v1/users/profile');
  return response.data.data;
};

/**
 * Update username
 * PUT /api/v1/users/username
 * Requires: Bearer token
 */
export const updateUsername = async (
  token: string,
  username: string
): Promise<void> => {
  const client = createApiClient(token);
  await client.put('/api/v1/users/username', { username });
};

/**
 * Get user by ID
 * GET /api/v1/users/:userId
 * Requires: Bearer token
 */
export const getUserById = async (
  token: string,
  userId: string
): Promise<User> => {
  const client = createApiClient(token);
  const response = await client.get<UserProfileResponse>(
    `/api/v1/users/${userId}`
  );
  return response.data.data;
};

/**
 * Search users by phone number or username
 * GET /api/v1/users/search?q=searchterm
 * Requires: Bearer token
 * Query params: q (required) - search term (1-100 characters)
 *
 * Response format:
 * {
 *   "success": true,
 *   "data": {
 *     "users": [...]
 *   }
 * }
 *
 * Features:
 * - Case-insensitive partial match
 * - Searches both phone and username simultaneously
 * - Excludes current user from results
 * - Limited to 20 results
 * - Results sorted alphabetically by username
 */
export const searchUsers = async (
  token: string,
  searchTerm: string
): Promise<User[]> => {
  if (!searchTerm.trim() || searchTerm.length < 1) {
    throw new Error('Search term must be at least 1 character');
  }

  if (searchTerm.length > 100) {
    throw new Error('Search term must be at most 100 characters');
  }

  const client = createApiClient(token);
  const response = await client.get<SearchUsersResponse>(
    `/api/v1/users/search?q=${encodeURIComponent(searchTerm.trim())}`
  );

  // Return users array from the nested data structure
  return response.data.data.users || [];
};
