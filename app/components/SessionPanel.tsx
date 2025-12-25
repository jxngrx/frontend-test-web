/**
 * Chat Application Component
 *
 * Single-user chat application with:
 * - Authentication (OTP-based)
 * - Multiple chats
 * - Real-time messaging via Socket.IO
 * - User search
 * - Message status (read/delivered)
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { requestOTP, verifyOTP } from '../api/auth';
import { getProfile, searchUsers, User } from '../api/users';
import { getUserChats, createOrGetChat, Chat } from '../api/chats';
import { getChatMessages, sendMessage, Message } from '../api/messages';
import { getCallHistory, Call } from '../api/calls';
import { ChatSocket } from '../sockets/chatSocket';
import ChatWindow from './ChatWindow';
import VoiceCallComponent from './VoiceCallComponent';
import { useVoiceCall } from '../hooks/useVoiceCall';

export default function ChatApp() {
  // Session storage key
  const storageKey = 'chat_session';

  // Authentication state (isolated per session)
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [authStep, setAuthStep] = useState<'phone' | 'otp' | 'authenticated'>('phone');
  const [authError, setAuthError] = useState<string | null>(null);

  // Load session from localStorage on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedSession = localStorage.getItem(storageKey);
        if (savedSession) {
          const session = JSON.parse(savedSession);
          console.log('🔄 [COMPONENT] Restoring session from localStorage:', {
            hasToken: !!session.token,
            userId: session.userId,
          });

          if (session.token && session.userId) {
            setToken(session.token);
            setUserId(session.userId);
            setUsername(session.username || null);
            setPhone(session.phone || '');
            setAuthStep('authenticated');
          }
        }
      } catch (error) {
        console.error('Failed to restore session:', error);
        localStorage.removeItem(storageKey);
      }
    };

    restoreSession();
  }, []); // Only run on mount

  // Save session to localStorage whenever it changes
  useEffect(() => {
    if (token && userId) {
      const session = {
        token,
        userId,
        username,
        phone,
      };
      localStorage.setItem(storageKey, JSON.stringify(session));
      console.log('💾 [COMPONENT] Session saved to localStorage:', { userId });
    }
  }, [token, userId, username, phone, storageKey]);

  // Chat state (isolated per session)
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const selectedChatIdRef = useRef<string | null>(null);
  const socketRef = useRef<ChatSocket | null>(null);
  const socketInitializedRef = useRef(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [callHistory, setCallHistory] = useState<Call[]>([]);
  const [otherUserName, setOtherUserName] = useState<string | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    selectedChatIdRef.current = selectedChatId;
  }, [selectedChatId]);

  // Search state (isolated per session)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Socket connection (isolated per session)
  const [socket, setSocket] = useState<ChatSocket | null>(null);

  // Request state to prevent duplicate rapid requests
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Voice call state
  const {
    callState,
    initiateCall: initiateCallHandler,
    answerCall: answerCallHandler,
    rejectCall: rejectCallHandler,
    endCall: endCallHandler,
  } = useVoiceCall(socket, token);

  /**
   * Step 1: Request OTP
   */
  const handleRequestOTP = async () => {
    if (!phone.trim()) {
      setAuthError('Please enter a phone number');
      return;
    }

    try {
      setAuthError(null);
      await requestOTP(phone);
      setAuthStep('otp');
    } catch (error: any) {
      setAuthError(error.response?.data?.message || 'Failed to request OTP');
    }
  };

  /**
   * Step 2: Verify OTP and initialize session
   */
  const handleVerifyOTP = async () => {
    if (!otp.trim()) {
      setAuthError('Please enter OTP');
      return;
    }

    try {
      setAuthError(null);
      const response = await verifyOTP(phone, otp);
      const newToken = response.data.token;
      setToken(newToken);

      // Get user profile
      const profile = await getProfile(newToken);
      setUserId(profile.id);
      setUsername(profile.username || null);
      setAuthStep('authenticated');

      // Save session to localStorage
      const session = {
        token: newToken,
        userId: profile.id,
        username: profile.username || null,
        phone: phone,
      };
      localStorage.setItem(storageKey, JSON.stringify(session));
      console.log('💾 [COMPONENT] Session saved after login:', { userId: profile.id });

      // Socket will be initialized by the useEffect hook
    } catch (error: any) {
      setAuthError(error.response?.data?.message || 'Failed to verify OTP');
    }
  };

  /**
   * Load all chats for the current user
   * Includes rate limiting error handling
   */
  const loadChats = useCallback(async () => {
    if (!token) return;

    try {
      const userChats = await getUserChats(token);

      // Ensure we have an array before setting state
      if (Array.isArray(userChats)) {
        setChats(userChats);
      } else {
        console.warn('getUserChats did not return an array:', userChats);
        setChats([]);
      }
    } catch (error: any) {
      console.error('Failed to load chats:', error);

      // Don't show error for rate limiting on background refresh
      // Only log it
      if (error.response?.status === 429) {
        console.warn('Rate limited while loading chats. Will retry later.');
      }

      // Keep existing chats if load fails (don't clear them)
      // setChats([]);
    }
  }, [token]);

  /**
   * Search users by phone number or username
   * API features:
   * - Case-insensitive partial match
   * - Searches both phone and username simultaneously
   * - Excludes current user from results (handled by backend)
   * - Limited to 20 results
   * - Results sorted alphabetically by username
   */
  const handleSearchUsers = useCallback(
    async (query: string) => {
      if (!token || !query.trim() || query.length < 1) {
        setSearchResults([]);
        setShowSearchResults(false);
        return;
      }

      if (query.length > 100) {
        // API limit: max 100 characters
        setSearchResults([]);
        setShowSearchResults(false);
        return;
      }

      try {
        setIsSearching(true);
        const results = await searchUsers(token, query);

        // Ensure we have an array before filtering
        if (Array.isArray(results)) {
          // Backend already excludes current user, but filter as safety measure
          setSearchResults(results.filter((user) => user.id !== userId));
          setShowSearchResults(true);
        } else {
          console.warn('searchUsers did not return an array:', results);
          setSearchResults([]);
          setShowSearchResults(false);
        }
      } catch (error: any) {
        console.error('Failed to search users:', error);
        setSearchResults([]);
        setShowSearchResults(false);
      } finally {
        setIsSearching(false);
      }
    },
    [token, userId]
  );

  /**
   * Handle search input change with debounce
   */
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const timer = setTimeout(() => {
      handleSearchUsers(searchQuery);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery, handleSearchUsers]);

  /**
   * Handle selecting a user from search results
   */
  const handleSelectUserFromSearch = async (user: User) => {
    if (!token) return;

    // Close search results
    setShowSearchResults(false);
    setSearchQuery('');

    // Create or get chat with selected user
    await handleCreateOrSelectChat(user.id);

    // Chat list will be updated via socket event (chat:new)
    // No need to call loadChats() here
  };

  /**
   * Create or get chat with the other user (for new chats)
   */
  const handleCreateOrSelectChat = useCallback(
    async (targetUserId: string) => {
      if (!token) return;

      try {
        const chat = await createOrGetChat(token, targetUserId);
        const chatIdToUse = chat.chatId || chat.id;
        setSelectedChatId(chatIdToUse);

        // Find other user's name (handle both old and new API formats)
        const otherUser = chat.otherParticipant ||
          (chat.participants ? chat.participants.find((p) => p.id !== userId) : null);
        setOtherUserName(otherUser?.username || otherUser?.phone || 'Unknown');

        // Load messages and call history for this chat
        if (token && userId) {
          try {
            const chatMessages = await getChatMessages(token, chatIdToUse);
            if (Array.isArray(chatMessages)) {
              const sorted = chatMessages.sort(
                (a, b) =>
                  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
              );
              setMessages(sorted);
            }

            // Load call history using the function
            await loadCallHistory(chatIdToUse, otherUser?.id);
          } catch (error: any) {
            console.error('Failed to load messages/call history:', error);
          }
        }
      } catch (error: any) {
        console.error('Failed to create/get chat:', error);
      }
    },
    [token, userId]
  );

  /**
   * Load call history for the selected chat
   */
  const loadCallHistory = useCallback(
    async (chatId: string, otherUserId?: string) => {
      if (!token || !userId) {
        console.warn('⚠️ [COMPONENT] Cannot load call history: Missing token or userId');
        return;
      }

      try {
        console.log('📞 [COMPONENT] Loading call history for chat:', {
          chatId,
          userId,
          otherUserId,
        });

        const calls = await getCallHistory(token, 100);
        console.log('📞 [COMPONENT] All calls received from API:', calls.length);

        // Get otherUserId from parameter or find from chats
        let targetOtherUserId = otherUserId;
        if (!targetOtherUserId) {
          const selectedChat = chats.find(c => (c.chatId || c.id) === chatId);
          targetOtherUserId = selectedChat?.otherParticipant?.id;
        }

        console.log('📞 [COMPONENT] Filtering calls:', {
          userId,
          targetOtherUserId,
          chatId,
        });

        if (targetOtherUserId) {
          const relevantCalls = calls.filter(
            call => {
              // Handle both new format (caller/receiver objects) and legacy format (callerId/receiverId)
              const callerId = call.caller?.id || call.callerId;
              const receiverId = call.receiver?.id || call.receiverId;

              const isRelevant = (
                (callerId === userId && receiverId === targetOtherUserId) ||
                (callerId === targetOtherUserId && receiverId === userId)
              );

              return isRelevant;
            }
          );

          setCallHistory(relevantCalls);
          console.log('✅ [COMPONENT] Call history loaded and set:', {
            totalCalls: calls.length,
            relevantCalls: relevantCalls.length,
            callIds: relevantCalls.map(c => c.id),
          });
        } else {
          console.warn('⚠️ [COMPONENT] No otherUserId found for chat:', chatId);
          setCallHistory([]);
        }
      } catch (error) {
        console.error('❌ [COMPONENT] Failed to load call history:', error);
        setCallHistory([]);
      }
    },
    [token, userId, chats]
  );

  /**
   * Load messages for the selected chat
   */
  const loadChatMessages = useCallback(
    async (chatId: string) => {
      if (!token) {
        console.warn('⚠️ [COMPONENT] Cannot load messages: No token');
        return;
      }

      console.log('📥 [COMPONENT] Loading messages for chat:', {
        chatId,
        currentUserId: userId,
        timestamp: new Date().toISOString(),
      });

      try {
        const chatMessages = await getChatMessages(token, chatId);

        // Ensure we have an array before sorting
        if (Array.isArray(chatMessages)) {
          const sorted = chatMessages.sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );

          console.log('✅ [COMPONENT] Messages loaded and sorted:', {
            count: sorted.length,
            messageIds: sorted.map(m => m.id),
            senders: sorted.map(m => ({ id: m.senderId, isMe: m.senderId === userId })),
          });

          setMessages(sorted);

          // Mark messages as delivered when loading chat
          if (socket?.isConnected() && sorted.length > 0) {
            console.log('📬 [COMPONENT] Marking messages as delivered for chat:', chatId);
            socket.markAsDelivered(chatId);
          }
        } else {
          console.warn('⚠️ [COMPONENT] getChatMessages did not return an array:', chatMessages);
          setMessages([]);
        }
      } catch (error: any) {
        console.error('❌ [COMPONENT] Failed to load messages:', {
          error: error.message,
          chatId,
          response: error.response?.data,
        });
        setMessages([]);
      }
    },
    [token, userId, socket]
  );

  /**
   * Select an existing chat from the list
   */
  const handleSelectExistingChat = useCallback(
    async (chat: Chat) => {
      if (!token) return;

      try {
        const chatIdToUse = chat.chatId || chat.id;
        setSelectedChatId(chatIdToUse);

        // Find other user's name (handle both old and new API formats)
        const otherUser = chat.otherParticipant ||
          (chat.participants ? chat.participants.find((p) => p.id !== userId) : null);
        setOtherUserName(otherUser?.username || otherUser?.phone || 'Unknown');

        // Load messages and call history for this chat
        await loadChatMessages(chatIdToUse);
        // Pass otherUserId to ensure it's available even if chats array hasn't updated yet
        await loadCallHistory(chatIdToUse, otherUser?.id);
      } catch (error: any) {
        console.error('Failed to select chat:', error);
      }
    },
    [token, userId, loadChatMessages, loadCallHistory]
  );

  /**
   * Send a message
   * Includes rate limiting protection and user-friendly error handling
   */
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!token || !selectedChatId || isSendingMessage) return;

      setIsSendingMessage(true);
      setErrorMessage(null);

      try {
        console.log('💬 [COMPONENT] Sending message:', {
          content: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
          chatId: selectedChatId,
          userId,
          timestamp: new Date().toISOString(),
        });

        // Send via REST API
        const newMessage = await sendMessage(token, selectedChatId, 'text', content);

        console.log('✅ [COMPONENT] Message sent via API:', {
          messageId: newMessage.id,
          chatId: newMessage.chatId,
          senderId: newMessage.senderId,
          isRead: newMessage.isRead,
          isDelivered: newMessage.isDelivered,
        });

        // Optimistically add to local state (message already persisted on server)
        // The backend will emit this message via socket, which will also update the UI
        // We add it here for immediate feedback, but socket event will handle real-time sync
        setMessages((prev) => {
          // Avoid duplicates (socket event might arrive first)
          if (prev.some((m) => m.id === newMessage.id)) {
            console.warn('⚠️ [COMPONENT] Message already exists, skipping duplicate:', newMessage.id);
            return prev;
          }

          const updated = [...prev, newMessage].sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );

          console.log('📝 [COMPONENT] Updated messages state (optimistic):', {
            previousCount: prev.length,
            newCount: updated.length,
            addedMessageId: newMessage.id,
          });

          return updated;
        });

        // Note: Backend will emit message:new event via socket after REST API call
        // No need to send via socket separately - the socket event will handle real-time sync

        // Chat list will be updated via socket events (chat:updated or message:new)
        // No need to call loadChats() here to avoid API spam
      } catch (error: any) {
        console.error('Failed to send message:', error);

        // Extract user-friendly error message
        let errorMsg = 'Failed to send message. Please try again.';
        if (error.response?.status === 429) {
          errorMsg = error.message || 'Too many requests. Please wait a moment and try again.';
        } else if (error.response?.data?.message) {
          errorMsg = error.response.data.message;
        } else if (error.message) {
          errorMsg = error.message;
        }

        setErrorMessage(errorMsg);

        // Auto-clear error message after 5 seconds
        setTimeout(() => setErrorMessage(null), 5000);
      } finally {
        setIsSendingMessage(false);
      }
    },
    [token, selectedChatId, socket, isSendingMessage, loadChats]
  );

  // Initialize socket and load chats when authenticated (including restored sessions)
  useEffect(() => {
    if (authStep === 'authenticated' && token && userId && !socket) {
      console.log('🔌 [COMPONENT] Initializing socket connection:', { userId });

      // Initialize socket connection for this session
      const newSocket = new ChatSocket(token, {
        onMessageNew: (message) => {
          console.log('📨 [COMPONENT] Socket callback received message:', {
            messageId: message.id,
            chatId: message.chatId,
            senderId: message.senderId,
            currentUserId: userId,
            currentChatId: selectedChatIdRef.current,
            content: message.content.substring(0, 50),
            timestamp: new Date().toISOString(),
          });

          // Add new message to current chat if it matches (use ref for current value)
          setMessages((prev) => {
            // Check if message belongs to currently selected chat (use ref for latest value)
            const currentChatId = selectedChatIdRef.current;
            const isForCurrentChat = message.chatId === currentChatId;

            console.log('🔍 [COMPONENT] Checking if message belongs to current chat:', {
              messageChatId: message.chatId,
              currentChatId,
              isForCurrentChat,
              previousMessageCount: prev.length,
            });

            // Avoid duplicates
            if (prev.some((m) => m.id === message.id)) {
              console.warn('⚠️ [COMPONENT] Duplicate message detected, skipping:', message.id);
              return prev;
            }

            // If it's for current chat, add it; otherwise just return prev
            if (isForCurrentChat) {
              const updated = [...prev, message].sort(
                (a, b) =>
                  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
              );

              console.log('✅ [COMPONENT] Added message to current chat:', {
                newCount: updated.length,
                messageId: message.id,
              });

              // Mark as delivered and read if it's for current chat
              if (newSocket.isConnected()) {
                newSocket.markAsDelivered(message.chatId);
                newSocket.markAsRead(message.chatId);
              }

              return updated;
            } else {
              console.log('ℹ️ [COMPONENT] Message not for current chat, ignoring');
            }

            return prev;
          });

          // Update chat list to reflect new last message
          setChats((prevChats) => {
            const chatIdToUpdate = message.chatId;
            const chatIndex = prevChats.findIndex(
              (c) => (c.chatId || c.id) === chatIdToUpdate
            );

            if (chatIndex >= 0) {
              // Update existing chat's last message
              const updatedChats = [...prevChats];
              updatedChats[chatIndex] = {
                ...updatedChats[chatIndex],
                lastMessage: {
                  _id: message.id,
                  id: message.id,
                  content: message.content,
                  type: message.type || 'text',
                  status: message.isRead ? 'read' : message.isDelivered ? 'delivered' : 'sent',
                  createdAt: message.createdAt,
                },
                lastMessageAt: message.createdAt,
              };
              // Move updated chat to top (most recent first)
              const [updatedChat] = updatedChats.splice(chatIndex, 1);
              return [updatedChat, ...updatedChats];
            } else {
              // Chat not in list yet, might need to load it
              // But don't call loadChats here to avoid API spam
              console.log('ℹ️ [COMPONENT] Message for chat not in list, will be added via chat:new event');
              return prevChats;
            }
          });
        },
        onChatNew: (chat) => {
          console.log('✅ [COMPONENT] New chat received via socket:', {
            chatId: chat.chatId || chat.id,
            otherParticipant: chat.otherParticipant?.username || chat.otherParticipant?.phone,
          });
          // Add new chat to the list
          setChats((prevChats) => {
            // Check if chat already exists
            const exists = prevChats.some(
              (c) => (c.chatId || c.id) === (chat.chatId || chat.id)
            );
            if (exists) {
              return prevChats;
            }
            // Add to beginning of list
            return [chat, ...prevChats];
          });
        },
        onChatUpdated: (chat) => {
          console.log('✅ [COMPONENT] Chat updated via socket:', {
            chatId: chat.chatId || chat.id,
            hasLastMessage: !!chat.lastMessage,
          });
          // Update existing chat in the list
          setChats((prevChats) => {
            const chatIdToUpdate = chat.chatId || chat.id;
            const chatIndex = prevChats.findIndex(
              (c) => (c.chatId || c.id) === chatIdToUpdate
            );

            if (chatIndex >= 0) {
              // Update existing chat
              const updatedChats = [...prevChats];
              updatedChats[chatIndex] = {
                ...updatedChats[chatIndex],
                ...chat,
                // Preserve otherParticipant if not provided in update
                otherParticipant: chat.otherParticipant || updatedChats[chatIndex].otherParticipant,
              };
              // Move updated chat to top (most recent first)
              const [updatedChat] = updatedChats.splice(chatIndex, 1);
              return [updatedChat, ...updatedChats];
            } else {
              // Chat not in list, add it
              return [chat, ...prevChats];
            }
          });
        },
        onMessageRead: (data) => {
          console.log('📖 [COMPONENT] Message read receipt received:', data);
          // Update message status in current chat
          if (data.chatId === selectedChatIdRef.current) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.chatId === data.chatId && msg.senderId !== userId
                  ? { ...msg, isRead: true, isDelivered: true }
                  : msg
              )
            );
          }
        },
        onMessageDelivered: (data) => {
          console.log('📬 [COMPONENT] Message delivered receipt received:', data);
          // Update message status in current chat
          if (data.chatId === selectedChatIdRef.current) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.chatId === data.chatId && msg.senderId !== userId
                  ? { ...msg, isDelivered: true }
                  : msg
              )
            );
          }
        },
        onChatJoined: (data) => {
          console.log('✅ [COMPONENT] Successfully joined chat room:', data.chatId);
        },
        onChatLeft: (data) => {
          console.log('✅ [COMPONENT] Successfully left chat room:', data.chatId);
        },
        onUserOnline: (userId) => {
          console.log('✅ [COMPONENT] User came online:', userId);
          // Update online status in chat list
          setChats((prevChats) =>
            prevChats.map((chat) => {
              const otherParticipant = chat.otherParticipant;
              if (otherParticipant && otherParticipant.id === userId) {
                return {
                  ...chat,
                  otherParticipant: {
                    ...otherParticipant,
                    isOnline: true,
                  },
                };
              }
              return chat;
            })
          );
        },
        onUserOffline: (userId) => {
          console.log('✅ [COMPONENT] User went offline:', userId);
          // Update online status in chat list
          setChats((prevChats) =>
            prevChats.map((chat) => {
              const otherParticipant = chat.otherParticipant;
              if (otherParticipant && otherParticipant.id === userId) {
                return {
                  ...chat,
                  otherParticipant: {
                    ...otherParticipant,
                    isOnline: false,
                    lastSeen: new Date().toISOString(),
                  },
                };
              }
              return chat;
            })
          );
        },
        onConnect: () => {
          console.log('Socket connected');
        },
        onDisconnect: () => {
          console.log('Socket disconnected');
        },
      });
      newSocket.connect();
      setSocket(newSocket);
      socketRef.current = newSocket; // Store in ref for cleanup

      // Load user's chats
      loadChats();
    }

    // Cleanup: reset ref if auth state changes (user logs out)
    return () => {
      if (authStep !== 'authenticated') {
        socketInitializedRef.current = false;
      }
    };
  }, [authStep, token, userId, socket, loadChats]);

  // Cleanup socket ONLY on component unmount (not on dependency changes)
  useEffect(() => {
    return () => {
      // Only cleanup on actual unmount
      const socketToCleanup = socketRef.current;
      if (socketToCleanup) {
        console.log('🧹 [COMPONENT] Cleaning up socket on unmount');
        // Leave chat room if connected
        const currentChatId = selectedChatIdRef.current;
        if (currentChatId && socketToCleanup.isConnected()) {
          console.log('🚪 [COMPONENT] Leaving chat room on unmount:', currentChatId);
          socketToCleanup.leaveChat(currentChatId);
        }
        socketToCleanup.disconnect();
        socketRef.current = null;
      }
    };
    // Empty dependency array = only run on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Fixed Header with user identity, call button, and connection status */}
      <div className="fixed top-0 left-0 right-0 z-50 p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Chat App</h2>
            {authStep === 'authenticated' && (
              <div className="text-sm text-gray-400">
                {username || phone} ({userId?.substring(0, 8)}...)
              </div>
            )}
          </div>
          {authStep === 'authenticated' && (
            <div className="flex items-center gap-3">
              {/* Call button - show when chat is selected */}
              {selectedChatId && (() => {
                const currentChat = chats.find(
                  (c) => (c.chatId || c.id) === selectedChatId
                );
                const otherUser = currentChat?.otherParticipant;
                const otherUserId = otherUser?.id;

                if (otherUserId && callState.status === 'idle') {
                  return (
                    <button
                      onClick={() => initiateCallHandler(otherUserId)}
                      className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors flex items-center gap-1"
                      title="Call user"
                    >
                      📞 Call
                    </button>
                  );
                }
                return null;
              })()}
              {/* Connection status */}
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${socket?.isConnected() ? 'bg-green-500' : 'bg-red-500'}`}
                     title={socket?.isConnected() ? 'Socket Connected' : 'Socket Disconnected'} />
                <span className="text-xs text-gray-400">
                  {socket?.isConnected() ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Authentication UI */}
      {authStep === 'phone' && (
        <div className="p-4 space-y-2 mt-[80px]">
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number (e.g., +1234567890)"
            className="w-full px-3 py-2 border border-gray-600 rounded bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleRequestOTP}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Request OTP
          </button>
          {authError && <div className="text-red-400 text-sm">{authError}</div>}
        </div>
      )}

      {authStep === 'otp' && (
        <div className="p-4 space-y-2 mt-[80px]">
          <div className="text-sm text-gray-400">OTP sent to {phone}</div>
          <input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="Enter OTP"
            className="w-full px-3 py-2 border border-gray-600 rounded bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleVerifyOTP}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Verify OTP
          </button>
          {authError && <div className="text-red-400 text-sm">{authError}</div>}
        </div>
      )}

      {/* Main chat interface */}
      {authStep === 'authenticated' && (
        <div className="flex flex-1 overflow-hidden mt-[80px]">
          {/* Chat list sidebar */}
          <div className="w-64 border-r border-gray-700 bg-gray-800 overflow-y-auto flex flex-col">
            <div className="p-2 font-semibold border-b border-gray-700 text-white">
              Chats
            </div>

            {/* Search bar */}
            <div className="p-2 border-b border-gray-700">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  const value = e.target.value;
                  // Limit to 100 characters (API requirement)
                  if (value.length <= 100) {
                    setSearchQuery(value);
                  }
                }}
                placeholder="Search by phone or username..."
                maxLength={100}
                className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              {searchQuery.length > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  {searchQuery.length}/100 characters
                </div>
              )}
            </div>

            {/* Search results */}
            {showSearchResults && (
              <div className="border-b border-gray-700">
                <div className="p-2 text-xs text-gray-400 font-semibold">
                  Search Results
                </div>
                {isSearching ? (
                  <div className="p-3 text-center text-gray-400 text-sm">
                    Searching...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-3 text-center text-gray-400 text-sm">
                    No users found
                    {searchQuery.length >= 1 && (
                      <div className="text-xs text-gray-500 mt-1">
                        Try a different search term
                      </div>
                    )}
                  </div>
                ) : (
                  searchResults.map((user) => (
                    <div
                      key={user.id}
                      onClick={() => handleSelectUserFromSearch(user)}
                      className="p-3 cursor-pointer hover:bg-gray-700 transition-colors border-b border-gray-700"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-white">
                          {user.username || user.phone}
                        </div>
                        {user.isOnline && (
                          <div className="w-2 h-2 bg-green-500 rounded-full" title="Online" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {user.username && (
                          <div className="text-xs text-gray-400">{user.phone}</div>
                        )}
                        {!user.isOnline && user.lastSeen && (
                          <div className="text-xs text-gray-500">
                            • Last seen {new Date(user.lastSeen).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Previous chats */}
            <div className="flex-1 overflow-y-auto">
              {(!Array.isArray(chats) || chats.length === 0) && !showSearchResults ? (
                <div className="p-3 text-center text-gray-400 text-sm">
                  No chats yet. Search for users to start a conversation.
                </div>
              ) : Array.isArray(chats) ? (
                chats
                  .map((chat) => {
                    // Handle new API format with otherParticipant
                    const otherUser = chat.otherParticipant ||
                      (chat.participants ? chat.participants.find((p) => p.id !== userId) : null);

                    if (!otherUser) {
                      console.warn('⚠️ [COMPONENT] Chat has no other participant:', chat);
                      return null;
                    }

                    const chatName = otherUser.username || otherUser.phone || 'Unknown';
                    const chatIdToUse = chat.chatId || chat.id;

                    return (
                      <div
                        key={chat.id}
                        onClick={() => handleSelectExistingChat(chat)}
                        className={`p-3 cursor-pointer hover:bg-gray-700 transition-colors ${
                          selectedChatId === chatIdToUse ? 'bg-blue-900' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-white">{chatName}</div>
                          {chat.otherParticipant?.isOnline && (
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          )}
                        </div>
                        {chat.lastMessage && (
                          <div className="text-sm text-gray-400 truncate mt-1">
                            {chat.lastMessage.content}
                          </div>
                        )}
                        {chat.lastMessageAt && (
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(chat.lastMessageAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                  .filter(Boolean) // Remove null values
              ) : null}
            </div>
          </div>

          {/* Chat window */}
          <div className="flex-1 flex flex-col">
            {selectedChatId ? (
              <>
                {errorMessage && (
                  <div className="p-2 bg-red-900/50 border-b border-red-700 text-red-200 text-sm text-center">
                    {errorMessage}
                  </div>
                )}
                <ChatWindow
                  messages={messages}
                  callHistory={callHistory}
                  currentUserId={userId!}
                  otherUserName={otherUserName || undefined}
                  onSendMessage={handleSendMessage}
                  disabled={!socket?.isConnected() || isSendingMessage}
                />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                Select a chat to start messaging
              </div>
            )}
          </div>
        </div>
      )}

      {/* Voice Call Component */}
      {authStep === 'authenticated' && (
        <VoiceCallComponent
          callState={callState}
          onInitiateCall={initiateCallHandler}
          onAnswerCall={answerCallHandler}
          onRejectCall={rejectCallHandler}
          onEndCall={async () => {
            await endCallHandler();
            // Refresh call history after ending call
            if (selectedChatId) {
              await loadCallHistory(selectedChatId);
            }
          }}
          callerName={(() => {
            if (callState.callerId) {
              const callerChat = chats.find(
                (c) => c.otherParticipant?.id === callState.callerId
              );
              return callerChat?.otherParticipant?.username ||
                     callerChat?.otherParticipant?.phone ||
                     'Unknown User';
            }
            return undefined;
          })()}
          receiverName={otherUserName || undefined}
        />
      )}
    </div>
  );
}
