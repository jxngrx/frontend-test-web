/**
 * ChatWindow Component
 *
 * Displays the active chat conversation with:
 * - Message list
 * - Message input
 * - Real-time message updates
 */

'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Message } from '../api/messages';
import { Call } from '../api/calls';
import MessageBubble from './MessageBubble';
import CallHistoryEntry from './CallHistoryEntry';
import InputBox from './InputBox';

interface ChatWindowProps {
  messages: Message[];
  callHistory?: Call[];
  currentUserId: string;
  otherUserName?: string;
  onSendMessage: (content: string, type?: 'text' | 'image' | 'video' | 'file') => void;
  disabled?: boolean;
  token?: string;
  chatId?: string;
}

export default function ChatWindow({
  messages,
  callHistory = [],
  currentUserId,
  otherUserName,
  onSendMessage,
  disabled = false,
  token,
  chatId,
}: ChatWindowProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Merge messages and call history, sorted by timestamp
  const mergedItems = useMemo(() => {
    const items: Array<{ type: 'message' | 'call'; data: Message | Call; timestamp: Date }> = [];

    // Add messages
    messages.forEach(msg => {
      items.push({
        type: 'message',
        data: msg,
        timestamp: new Date(msg.createdAt),
      });
    });

    // Add calls
    callHistory.forEach(call => {
      const timestamp = call.endedAt || call.startedAt || call.createdAt;
      items.push({
        type: 'call',
        data: call,
        timestamp: new Date(timestamp),
      });
    });

    // Sort by timestamp
    const sorted = items.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    console.log('🔄 [CHATWINDOW] Merged items:', {
      messages: messages.length,
      calls: callHistory.length,
      total: sorted.length,
      callIds: callHistory.map(c => c.id),
    });

    return sorted;
  }, [messages, callHistory]);

  // Auto-scroll to bottom when new messages or calls arrive
  useEffect(() => {
    console.log('🖥️ [CHATWINDOW] Items updated:', {
      messagesCount: messages.length,
      callsCount: callHistory.length,
      totalItems: mergedItems.length,
      timestamp: new Date().toISOString(),
    });
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, callHistory, mergedItems.length]);

  const handleSend = (type?: 'text' | 'image' | 'video' | 'file', content?: string) => {
    const messageContent = content || inputValue.trim();
    if (messageContent && !disabled) {
      onSendMessage(messageContent, type || 'text');
      if (!content) {
        setInputValue('');
      }
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    if (!token) return;

    try {
      const { editMessage } = await import('../api/messages');
      await editMessage(token, messageId, newContent);
      // Message will be updated via socket or refresh
    } catch (err: any) {
      console.error('Failed to edit message:', err);
      alert(err.response?.data?.message || 'Failed to edit message');
    }
  };

  const handleDeleteMessage = async (messageId: string, deleteForEveryone: boolean) => {
    if (!token) return;

    try {
      const { deleteMessage } = await import('../api/messages');
      await deleteMessage(token, messageId, deleteForEveryone);
      // Message will be removed via socket or refresh
    } catch (err: any) {
      console.error('Failed to delete message:', err);
      alert(err.response?.data?.message || 'Failed to delete message');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-900">
        {mergedItems.length === 0 ? (
          <div className="text-center text-gray-400 mt-8">
            No messages yet. Start the conversation!
          </div>
        ) : (
          mergedItems.map((item, index) => {
            if (item.type === 'message') {
              const message = item.data as Message;
              return (
                <MessageBubble
                  key={`msg-${message.id}`}
                  message={message}
                  isSent={message.senderId === currentUserId}
                  otherUserName={otherUserName}
                  currentUserId={currentUserId}
                  onEdit={handleEditMessage}
                  onDelete={handleDeleteMessage}
                />
              );
            } else {
              const call = item.data as Call;
              return (
                <CallHistoryEntry
                  key={`call-${call.id}-${index}`}
                  call={call}
                  currentUserId={currentUserId}
                  otherUserName={otherUserName}
                />
              );
            }
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <InputBox
        value={inputValue}
        onChange={setInputValue}
        onSend={handleSend}
        disabled={disabled}
        token={token}
      />
    </div>
  );
}
