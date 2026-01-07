/**
 * Contacts API
 *
 * Maps to the Contact endpoints from the backend:
 * - POST /api/v1/contacts/sync (Sync Contacts)
 * - GET /api/v1/contacts (Get Contacts)
 */

import { createApiClient } from './client';

export interface Contact {
  userId: string;
  phone: string;
  username?: string;
  isOnline?: boolean;
  lastSeen?: string;
}

export interface SyncContactsRequest {
  phoneHashes: string[];
}

export interface SyncContactsResponse {
  success: boolean;
  data: {
    contacts: Contact[];
  };
}

export interface ContactsResponse {
  success: boolean;
  data: {
    contacts: Contact[];
  };
}

/**
 * Sync contacts by matching hashed phone numbers
 * POST /api/v1/contacts/sync
 * Requires: Bearer token
 * Note: Phone numbers should be hashed using SHA-256 before sending
 */
export const syncContacts = async (
  token: string,
  phoneHashes: string[]
): Promise<Contact[]> => {
  const client = createApiClient(token);
  const response = await client.post<SyncContactsResponse>(
    '/api/v1/contacts/sync',
    { phoneHashes }
  );
  return response.data.data.contacts || [];
};

/**
 * Get all contacts for the current user
 * GET /api/v1/contacts
 * Requires: Bearer token
 */
export const getContacts = async (token: string): Promise<Contact[]> => {
  const client = createApiClient(token);
  const response = await client.get<ContactsResponse>('/api/v1/contacts');
  return response.data.data.contacts || [];
};
