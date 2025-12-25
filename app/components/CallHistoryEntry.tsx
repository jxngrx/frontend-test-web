/**
 * Call History Entry Component
 *
 * Displays a single call history entry in the chat, similar to WhatsApp/Telegram
 */

'use client';

import { Call } from '../api/calls';

interface CallHistoryEntryProps {
  call: Call;
  currentUserId: string;
  otherUserName?: string;
}

export default function CallHistoryEntry({
  call,
  currentUserId,
  otherUserName,
}: CallHistoryEntryProps) {
  // Handle both new format (caller/receiver objects) and legacy format (callerId/receiverId)
  const callerId = call.caller?.id || call.callerId;
  const receiverId = call.receiver?.id || call.receiverId;

  const isOutgoing = callerId === currentUserId;
  const isMissed = call.status === 'rejected' || (call.status === 'ringing' && !isOutgoing);
  const isAnswered = call.status === 'answered' || call.status === 'ended';

  // Format duration
  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format timestamp
  const formatTime = (dateString?: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getCallIcon = () => {
    if (isMissed) {
      return isOutgoing ? '📞❌' : '📞❌'; // Missed call
    }
    return isOutgoing ? '📞⬆️' : '📞⬇️'; // Outgoing/Incoming
  };

  const getCallText = () => {
    if (isMissed) {
      return isOutgoing ? 'Missed call' : 'Missed call';
    }
    if (isAnswered) {
      return isOutgoing ? 'Outgoing call' : 'Incoming call';
    }
    return isOutgoing ? 'Outgoing call' : 'Incoming call';
  };

  return (
    <div className="flex items-center justify-center my-2">
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-lg border border-gray-700/50 max-w-md">
        <span className="text-lg">{getCallIcon()}</span>
        <div className="flex flex-col">
          <span className="text-sm text-gray-300">
            {getCallText()}
            {call.duration && isAnswered && (
              <span className="text-gray-400 ml-1">({formatDuration(call.duration)})</span>
            )}
          </span>
          <span className="text-xs text-gray-500">{formatTime(call.endedAt || call.startedAt || call.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}
