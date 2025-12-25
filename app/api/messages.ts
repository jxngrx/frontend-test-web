/**
 * Messages API
 *
 * Maps exactly to the Messages endpoints from Postman collection:
 * - POST /api/v1/messages (Send Message)
 * - GET /api/v1/messages/chat/:chatId (Get Chat Messages)
 * - PUT /api/v1/messages/:chatId/read (Mark as Read)
 * - PUT /api/v1/messages/:chatId/delivered (Mark as Delivered)
 * - PUT /api/v1/messages/:messageId/edit (Edit Message)
 * - DELETE /api/v1/messages/:messageId (Delete Message)
 */

import { createApiClient } from './client';

export type MessageType = 'text' | 'image' | 'video' | 'voice' | 'file';
export type MessageStatus = 'sent' | 'delivered' | 'read';

// API Response format (what we receive from backend)
export interface MessageApiResponse {
  id: string;
  chatId: string;
  sender: {
    id: string;
    phone: string;
    username?: string;
  };
  type: MessageType;
  content: string;
  status: MessageStatus;
  createdAt: string;
  updatedAt?: string;
}

// Internal Message format (what we use in the app)
export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  type: MessageType;
  content: string;
  isRead: boolean;
  isDelivered: boolean;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Transform API response to internal Message format
 */
export const transformMessage = (apiMessage: MessageApiResponse): Message => {
  return {
    id: apiMessage.id,
    chatId: apiMessage.chatId,
    senderId: apiMessage.sender.id,
    type: apiMessage.type,
    content: apiMessage.content,
    isRead: apiMessage.status === 'read',
    isDelivered: apiMessage.status === 'delivered' || apiMessage.status === 'read',
    createdAt: apiMessage.createdAt,
    updatedAt: apiMessage.updatedAt,
  };
};

export interface SendMessageRequest {
  chatId: string;
  type: MessageType;
  content: string;
}

export interface MessageResponse {
  success: boolean;
  data: MessageApiResponse;
  message?: string;
}

export interface MessagesListResponse {
  success?: boolean;
  data: MessageApiResponse[] | { messages?: MessageApiResponse[] };
  message?: string;
}

export interface EditMessageRequest {
  content: string;
}

/**
 * Send a new message
 * POST /api/v1/messages
 * Requires: Bearer token
 *
 * Response format:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "...",
 *     "chatId": "...",
 *     "sender": { "id": "...", "phone": "...", "username": "..." },
 *     "type": "text",
 *     "content": "...",
 *     "status": "sent",
 *     "createdAt": "..."
 *   },
 *   "message": "Message sent successfully"
 * }
 */
export const sendMessage = async (
  token: string,
  chatId: string,
  type: MessageType,
  content: string
): Promise<Message> => {
  console.log('📤 [API] Sending message:', {
    chatId,
    type,
    content: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
    timestamp: new Date().toISOString(),
  });

  const client = createApiClient(token);
  const response = await client.post<MessageResponse>('/api/v1/messages', {
    chatId,
    type,
    content,
  });

  console.log('✅ [API] Message sent successfully:', {
    messageId: response.data.data.id,
    chatId: response.data.data.chatId,
    senderId: response.data.data.sender.id,
    status: response.data.data.status,
    response: response.data,
  });

  // Transform API response to internal format
  const transformed = transformMessage(response.data.data);

  console.log('🔄 [API] Transformed message:', {
    id: transformed.id,
    senderId: transformed.senderId,
    isRead: transformed.isRead,
    isDelivered: transformed.isDelivered,
  });

  return transformed;
};

/**
 * Get messages for a chat with pagination
 * GET /api/v1/messages/chat/:chatId?limit=50&before=messageId
 * Requires: Bearer token
 *
 * Response format can be:
 * { "data": [...] } or { "data": { "messages": [...] } }
 */
export const getChatMessages = async (
  token: string,
  chatId: string,
  limit: number = 50,
  before?: string
): Promise<Message[]> => {
  console.log('📥 [API] Fetching messages for chat:', {
    chatId,
    limit,
    before,
    timestamp: new Date().toISOString(),
  });

  const client = createApiClient(token);
  const params = new URLSearchParams({ limit: limit.toString() });
  if (before) {
    params.append('before', before);
  }
  const response = await client.get<MessagesListResponse>(
    `/api/v1/messages/chat/${chatId}?${params.toString()}`
  );

  console.log('📦 [API] Raw response structure:', {
    hasData: !!response.data,
    dataIsArray: Array.isArray(response.data),
    dataKeys: response.data && typeof response.data === 'object' ? Object.keys(response.data) : 'N/A',
    fullResponse: JSON.stringify(response.data, null, 2),
  });

  // Handle different response structures
  // Expected: {success: true, data: {messages: [...]}}
  let messages: MessageApiResponse[] = [];

  if (response.data) {
    // Case 1: response.data is directly an array
    if (Array.isArray(response.data)) {
      messages = response.data;
      console.log('✅ [API] Messages found in response.data (array):', messages.length);
    }
    // Case 2: response.data.data.messages (most common - {success: true, data: {messages: [...]}})
    else if (response.data.data && typeof response.data.data === 'object' && Array.isArray(response.data.data.messages)) {
      messages = response.data.data.messages;
      console.log('✅ [API] Messages found in response.data.data.messages:', messages.length);
    }
    // Case 3: response.data.messages is an array
    else if (response.data.messages && Array.isArray(response.data.messages)) {
      messages = response.data.messages;
      console.log('✅ [API] Messages found in response.data.messages:', messages.length);
    }
    // Case 4: response.data.data is an array
    else if (response.data.data && Array.isArray(response.data.data)) {
      messages = response.data.data;
      console.log('✅ [API] Messages found in response.data.data (array):', messages.length);
    }
    // Case 5: Check if response.data itself has message-like structure
    else if (typeof response.data === 'object') {
      // Try to find any array property that might contain messages
      const possibleArrays = Object.values(response.data).filter(Array.isArray);
      if (possibleArrays.length > 0) {
        messages = possibleArrays[0] as MessageApiResponse[];
        console.log('✅ [API] Messages found in nested array property:', messages.length);
      } else {
        // Deep search for messages array
        const deepSearch = (obj: any): MessageApiResponse[] | null => {
          if (Array.isArray(obj)) {
            return obj.length > 0 && obj[0]?.id && obj[0]?.chatId ? obj : null;
          }
          if (typeof obj === 'object' && obj !== null) {
            for (const value of Object.values(obj)) {
              const result = deepSearch(value);
              if (result) return result;
            }
          }
          return null;
        };

        const found = deepSearch(response.data);
        if (found) {
          messages = found;
          console.log('✅ [API] Messages found via deep search:', messages.length);
        } else {
          console.warn('⚠️ [API] Unexpected response structure, no messages found. Full response:', response.data);
        }
      }
    } else {
      console.warn('⚠️ [API] Unexpected response structure, no messages found');
    }
  }

  // Transform all messages to internal format
  const transformed = messages.map(transformMessage);

  console.log('🔄 [API] Transformed messages:', {
    count: transformed.length,
    messageIds: transformed.map(m => m.id),
    firstMessage: transformed[0] ? {
      id: transformed[0].id,
      senderId: transformed[0].senderId,
      content: transformed[0].content.substring(0, 30),
    } : null,
  });

  return transformed;
};

/**
 * Mark all messages in a chat as read
 * PUT /api/v1/messages/:chatId/read
 * Requires: Bearer token
 */
export const markMessagesAsRead = async (
  token: string,
  chatId: string
): Promise<void> => {
  const client = createApiClient(token);
  await client.put(`/api/v1/messages/${chatId}/read`);
};

/**
 * Mark all messages in a chat as delivered
 * PUT /api/v1/messages/:chatId/delivered
 * Requires: Bearer token
 */
export const markMessagesAsDelivered = async (
  token: string,
  chatId: string
): Promise<void> => {
  const client = createApiClient(token);
  await client.put(`/api/v1/messages/${chatId}/delivered`);
};

/**
 * Edit a message (within 30 minutes)
 * PUT /api/v1/messages/:messageId/edit
 * Requires: Bearer token
 */
export const editMessage = async (
  token: string,
  messageId: string,
  content: string
): Promise<Message> => {
  const client = createApiClient(token);
  const response = await client.put<MessageResponse>(
    `/api/v1/messages/${messageId}/edit`,
    { content }
  );
  // Transform API response to internal format
  return transformMessage(response.data.data);
};

/**
 * Delete a message
 * DELETE /api/v1/messages/:messageId?deleteForEveryone=false
 * Requires: Bearer token
 */
export const deleteMessage = async (
  token: string,
  messageId: string,
  deleteForEveryone: boolean = false
): Promise<void> => {
  const client = createApiClient(token);
  await client.delete(
    `/api/v1/messages/${messageId}?deleteForEveryone=${deleteForEveryone}`
  );
};
