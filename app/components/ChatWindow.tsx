/**
 * ChatWindow Component
 *
 * Displays the active chat conversation with:
 * - Message list
 * - Message input
 * - Real-time message updates
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { Message } from '../api/messages';
import MessageBubble from './MessageBubble';
import InputBox from './InputBox';

interface ChatWindowProps {
  messages: Message[];
  currentUserId: string;
  otherUserName?: string;
  onSendMessage: (content: string) => void;
  disabled?: boolean;
}

export default function ChatWindow({
  messages,
  currentUserId,
  otherUserName,
  onSendMessage,
  disabled = false,
}: ChatWindowProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    console.log('🖥️ [CHATWINDOW] Messages updated:', {
      count: messages.length,
      messageIds: messages.map(m => m.id),
      senders: messages.map(m => ({ id: m.senderId, isMe: m.senderId === currentUserId })),
      lastMessage: messages[messages.length - 1] ? {
        id: messages[messages.length - 1].id,
        content: messages[messages.length - 1].content.substring(0, 30),
        senderId: messages[messages.length - 1].senderId,
      } : null,
      timestamp: new Date().toISOString(),
    });
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentUserId]);

  const handleSend = () => {
    if (inputValue.trim() && !disabled) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-900">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 mt-8">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isSent={message.senderId === currentUserId}
              otherUserName={otherUserName}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <InputBox
        value={inputValue}
        onChange={setInputValue}
        onSend={handleSend}
        disabled={disabled}
      />
    </div>
  );
}
