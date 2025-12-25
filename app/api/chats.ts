/**
 * Chats API
 *
 * Maps exactly to the Chats endpoints from Postman collection:
 * - POST /api/v1/chats (Create or Get Chat)
 * - GET /api/v1/chats (Get User Chats)
 * - GET /api/v1/chats/:chatId (Get Chat By ID)
 */

import { createApiClient } from './client';

export interface Chat {
  id: string;
  chatId: string;
  otherParticipant?: {
    id: string;
    phone: string;
    username?: string;
    isOnline?: boolean;
    lastSeen?: string;
  };
  participants?: Array<{
    id: string;
    phone: string;
    username?: string;
  }>;
  lastMessage?: {
    _id?: string;
    id?: string;
    content: string;
    type: string;
    status?: string;
    createdAt: string;
  };
  lastMessageAt?: string;
  unreadCount?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateChatRequest {
  otherUserId: string;
}

export interface ChatResponse {
  data: Chat;
}

export interface ChatsListResponse {
  success?: boolean;
  data: {
    chats: Chat[];
  };
}

/**
 * Create a new chat or get existing chat with another user
 * POST /api/v1/chats
 * Requires: Bearer token
 */
export const createOrGetChat = async (
  token: string,
  otherUserId: string
): Promise<Chat> => {
  console.log('💬 [API] Creating/getting chat:', {
    otherUserId,
    timestamp: new Date().toISOString(),
  });

  const client = createApiClient(token);
  const response = await client.post<ChatResponse>('/api/v1/chats', {
    otherUserId,
  });

  console.log('✅ [API] Chat created/retrieved:', {
    chatId: response.data.data.id,
    participants: response.data.data.participants.map(p => ({ id: p.id, phone: p.phone })),
    hasLastMessage: !!response.data.data.lastMessage,
    response: response.data,
  });

  return response.data.data;
};

/**
 * Get all chats for current user
 * GET /api/v1/chats
 * Requires: Bearer token
 *
 * Response structure: { success: true, data: { chats: [...] } }
 */
export const getUserChats = async (token: string): Promise<Chat[]> => {
  const client = createApiClient(token);
  const response = await client.get<ChatsListResponse>('/api/v1/chats');

  console.log('📋 [API] Raw chats response:', {
    hasData: !!response.data,
    hasDataData: !!response.data?.data,
    hasChats: !!response.data?.data?.chats,
    responseKeys: response.data ? Object.keys(response.data) : [],
    dataKeys: response.data?.data ? Object.keys(response.data.data) : [],
  });

  // Handle response structure: { success: true, data: { chats: [...] } }
  let chats: Chat[] = [];

  if (response.data) {
    // Case 1: response.data.data.chats (most common)
    if (response.data.data?.chats && Array.isArray(response.data.data.chats)) {
      chats = response.data.data.chats;
      console.log('✅ [API] Chats found in response.data.data.chats:', chats.length);
    }
    // Case 2: response.data.data is directly an array (fallback)
    else if (Array.isArray(response.data.data)) {
      chats = response.data.data;
      console.log('✅ [API] Chats found in response.data.data (array):', chats.length);
    }
    // Case 3: response.data is directly an array (fallback)
    else if (Array.isArray(response.data)) {
      chats = response.data;
      console.log('✅ [API] Chats found in response.data (array):', chats.length);
    }
    else {
      console.warn('⚠️ [API] Unexpected chats response structure:', response.data);
    }
  }

  console.log('📋 [API] Parsed chats:', {
    count: chats.length,
    chatIds: chats.map(c => c.chatId || c.id),
  });

  return chats;
};

/**
 * Get chat details by chat ID
 * GET /api/v1/chats/:chatId
 * Requires: Bearer token
 */
export const getChatById = async (
  token: string,
  chatId: string
): Promise<Chat> => {
  const client = createApiClient(token);
  const response = await client.get<ChatResponse>(`/api/v1/chats/${chatId}`);
  return response.data.data;
};
