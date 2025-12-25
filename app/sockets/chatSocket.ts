/**
 * Socket.IO Client Wrapper for Chat
 *
 * Manages Socket.IO connections for real-time chat features.
 * Each session maintains its own socket connection with its own auth token.
 *
 * Socket events based on POSTMAN_COLLECTION.md:
 *
 * Client → Server:
 * - message:send
 * - message:read
 * - message:delivered
 *
 * Server → Client:
 * - message:new
 * - message:sent
 * - message:read
 * - message:delivered
 * - user:online
 * - user:offline
 */

import { io, Socket } from 'socket.io-client';
import { Message, MessageApiResponse, transformMessage } from '../api/messages';

// Base URL for Socket.IO (same as REST API)
const SOCKET_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

export interface ChatSocketCallbacks {
  onMessageNew?: (message: Message) => void;
  onMessageSent?: (message: Message) => void;
  onMessageRead?: (data: { chatId: string; readBy?: string; timestamp?: string }) => void;
  onMessageDelivered?: (data: { chatId: string; deliveredTo?: string; timestamp?: string }) => void;
  onChatJoined?: (data: { chatId: string }) => void;
  onChatLeft?: (data: { chatId: string }) => void;
  onUserOnline?: (userId: string) => void;
  onUserOffline?: (userId: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Creates and manages a Socket.IO connection for a chat session
 * Each session gets its own isolated socket connection
 */
export class ChatSocket {
  private socket: Socket | null = null;
  private token: string;
  private callbacks: ChatSocketCallbacks;

  constructor(token: string, callbacks: ChatSocketCallbacks = {}) {
    this.token = token;
    this.callbacks = callbacks;
  }

  /**
   * Connect to Socket.IO server with authentication
   * Connection is isolated per session via unique token
   */
  connect(): void {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(SOCKET_BASE_URL, {
      auth: {
        token: this.token,
      },
      transports: ['websocket', 'polling'],
    });

    // Connection events
    this.socket.on('connect', () => {
      console.log('🔌 [SOCKET] Connected to server:', {
        socketId: this.socket?.id,
        timestamp: new Date().toISOString(),
      });
      this.callbacks.onConnect?.();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 [SOCKET] Disconnected from server:', {
        reason,
        timestamp: new Date().toISOString(),
      });
      this.callbacks.onDisconnect?.();
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ [SOCKET] Connection error:', {
        error: error.message,
        type: error.type,
        timestamp: new Date().toISOString(),
      });
      this.callbacks.onError?.(error);
    });

    // Message events (Server → Client)
    // Socket may send API format, so we need to transform it
    this.socket.on('message:new', (message: Message | MessageApiResponse) => {
      console.log('📨 [SOCKET] Received message:new event:', {
        rawMessage: message,
        hasSenderId: 'senderId' in message,
        hasSender: 'sender' in message,
        timestamp: new Date().toISOString(),
      });

      // Transform if it's in API format
      const transformedMessage = 'senderId' in message
        ? message
        : transformMessage(message as MessageApiResponse);

      console.log('🔄 [SOCKET] Transformed message:', {
        id: transformedMessage.id,
        chatId: transformedMessage.chatId,
        senderId: transformedMessage.senderId,
        content: transformedMessage.content.substring(0, 50),
        isRead: transformedMessage.isRead,
        isDelivered: transformedMessage.isDelivered,
      });

      this.callbacks.onMessageNew?.(transformedMessage);
    });

    this.socket.on('message:sent', (message: Message | MessageApiResponse) => {
      console.log('✅ [SOCKET] Received message:sent confirmation:', {
        rawMessage: message,
        timestamp: new Date().toISOString(),
      });

      // Transform if it's in API format
      const transformedMessage = 'senderId' in message
        ? message
        : transformMessage(message as MessageApiResponse);

      this.callbacks.onMessageSent?.(transformedMessage);
    });

    // Message status events (Server → Client)
    this.socket.on('message:read', (data: { chatId: string; readBy?: string; timestamp?: string }) => {
      console.log('✅ [SOCKET] Received message:read event:', {
        chatId: data.chatId,
        readBy: data.readBy,
        timestamp: data.timestamp,
      });
      this.callbacks.onMessageRead?.(data);
    });

    this.socket.on('message:delivered', (data: { chatId: string; deliveredTo?: string; timestamp?: string }) => {
      console.log('✅ [SOCKET] Received message:delivered event:', {
        chatId: data.chatId,
        deliveredTo: data.deliveredTo,
        timestamp: data.timestamp,
      });
      this.callbacks.onMessageDelivered?.(data);
    });

    // Chat room events (Server → Client)
    this.socket.on('chat:joined', (data: { chatId: string }) => {
      console.log('✅ [SOCKET] Joined chat room:', data.chatId);
      this.callbacks.onChatJoined?.(data);
    });

    this.socket.on('chat:left', (data: { chatId: string }) => {
      console.log('✅ [SOCKET] Left chat room:', data.chatId);
      this.callbacks.onChatLeft?.(data);
    });

    // Error events
    this.socket.on('error', (error: any) => {
      console.error('❌ [SOCKET] Socket error:', error);
      this.callbacks.onError?.(new Error(error.message || 'Socket error'));
    });

    // Presence events
    this.socket.on('user:online', (userId: string) => {
      console.log('User online:', userId);
      this.callbacks.onUserOnline?.(userId);
    });

    this.socket.on('user:offline', (userId: string) => {
      console.log('User offline:', userId);
      this.callbacks.onUserOffline?.(userId);
    });
  }

  /**
   * Send message via Socket.IO
   * Client → Server: message:send
   */
  sendMessage(chatId: string, type: string, content: string): void {
    if (!this.socket?.connected) {
      console.error('❌ [SOCKET] Cannot send message: Socket not connected');
      return;
    }

    const payload = { chatId, type, content };
    console.log('📤 [SOCKET] Emitting message:send:', {
      ...payload,
      content: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
      socketId: this.socket.id,
      timestamp: new Date().toISOString(),
    });

    this.socket.emit('message:send', payload);
  }

  /**
   * Join a chat room
   * Client → Server: chat:join
   */
  joinChat(chatId: string): void {
    if (!this.socket?.connected) {
      console.error('❌ [SOCKET] Cannot join chat: Socket not connected');
      return;
    }

    console.log('🚪 [SOCKET] Joining chat room:', {
      chatId,
      socketId: this.socket.id,
      timestamp: new Date().toISOString(),
    });

    this.socket.emit('chat:join', { chatId });
  }

  /**
   * Leave a chat room
   * Client → Server: chat:leave
   */
  leaveChat(chatId: string): void {
    if (!this.socket?.connected) {
      console.error('❌ [SOCKET] Cannot leave chat: Socket not connected');
      return;
    }

    console.log('🚪 [SOCKET] Leaving chat room:', {
      chatId,
      socketId: this.socket.id,
      timestamp: new Date().toISOString(),
    });

    this.socket.emit('chat:leave', { chatId });
  }

  /**
   * Mark messages as read via Socket.IO
   * Client → Server: message:read
   */
  markAsRead(chatId: string): void {
    if (!this.socket?.connected) {
      console.error('❌ [SOCKET] Cannot mark as read: Socket not connected');
      return;
    }

    console.log('📖 [SOCKET] Marking messages as read:', {
      chatId,
      timestamp: new Date().toISOString(),
    });

    this.socket.emit('message:read', { chatId });
  }

  /**
   * Mark messages as delivered via Socket.IO
   * Client → Server: message:delivered
   */
  markAsDelivered(chatId: string): void {
    if (!this.socket?.connected) {
      console.error('❌ [SOCKET] Cannot mark as delivered: Socket not connected');
      return;
    }

    console.log('📬 [SOCKET] Marking messages as delivered:', {
      chatId,
      timestamp: new Date().toISOString(),
    });

    this.socket.emit('message:delivered', { chatId });
  }

  /**
   * Disconnect socket
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Check if socket is connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}
