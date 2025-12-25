/**
 * MessageBubble Component
 *
 * Displays a single message with:
 * - Visual differentiation for sent vs received
 * - Timestamp
 * - Delivery/read status indicators
 */

import { Message } from '../api/messages';

interface MessageBubbleProps {
  message: Message;
  isSent: boolean; // true if sent by current user, false if received
  otherUserName?: string;
}

export default function MessageBubble({
  message,
  isSent,
  otherUserName,
}: MessageBubbleProps) {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      className={`flex mb-2 ${isSent ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[70%] rounded-lg px-3 py-2 ${
          isSent
            ? 'bg-blue-600 text-white'
            : 'bg-gray-700 text-gray-100'
        }`}
      >
        {!isSent && otherUserName && (
          <div className="text-xs font-semibold mb-1 opacity-80 text-gray-300">
            {otherUserName}
          </div>
        )}
        <div className="text-sm">{message.content}</div>
        <div
          className={`text-xs mt-1 flex items-center gap-1 ${
            isSent ? 'text-blue-200' : 'text-gray-400'
          }`}
        >
          <span>{formatTime(message.createdAt)}</span>
          {isSent && (
            <span className="ml-1">
              {message.isRead ? '✓✓' : message.isDelivered ? '✓' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
