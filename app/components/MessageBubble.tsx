/**
 * MessageBubble Component
 *
 * Displays a single message with:
 * - Visual differentiation for sent vs received
 * - Timestamp
 * - Delivery/read status indicators
 * - Edit/Delete buttons (for sent messages)
 */

import { useState } from 'react';
import { Message } from '../api/messages';

interface MessageBubbleProps {
  message: Message;
  isSent: boolean; // true if sent by current user, false if received
  otherUserName?: string;
  currentUserId: string;
  onEdit?: (messageId: string, newContent: string) => void;
  onDelete?: (messageId: string, deleteForEveryone: boolean) => void;
}

export default function MessageBubble({
  message,
  isSent,
  otherUserName,
  currentUserId,
  onEdit,
  onDelete,
}: MessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Check if message can be edited (within 30 minutes and not read)
  const canEdit = () => {
    if (!isSent || message.isRead) return false;
    const messageTime = new Date(message.createdAt).getTime();
    const now = Date.now();
    const thirtyMinutes = 30 * 60 * 1000;
    return now - messageTime < thirtyMinutes;
  };

  const handleEdit = () => {
    if (onEdit && editContent.trim() && editContent !== message.content) {
      onEdit(message.id, editContent);
      setIsEditing(false);
      setShowMenu(false);
    }
  };

  const handleDelete = (deleteForEveryone: boolean) => {
    if (onDelete) {
      onDelete(message.id, deleteForEveryone);
      setShowDeleteConfirm(false);
      setShowMenu(false);
    }
  };

  const isEdited = message.editedAt || (message.updatedAt && message.updatedAt !== message.createdAt);

  return (
    <div
      className={`flex mb-2 ${isSent ? 'justify-end' : 'justify-start'} group`}
    >
      <div
        className={`max-w-[70%] rounded-lg px-3 py-2 relative ${
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

        {isEditing ? (
          <div className="space-y-2">
            <input
              type="text"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full px-2 py-1 bg-gray-800 text-white rounded text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleEdit();
                } else if (e.key === 'Escape') {
                  setIsEditing(false);
                  setEditContent(message.content);
                }
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={handleEdit}
                className="text-xs px-2 py-1 bg-blue-500 hover:bg-blue-600 rounded"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditContent(message.content);
                }}
                className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {message.type === 'image' || message.type === 'video' ? (
              <div>
                <img
                  src={message.content}
                  alt="Media"
                  className="max-w-full h-auto rounded"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            ) : (
              <div className="text-sm">{message.content}</div>
            )}
            {isEdited && (
              <div className="text-xs italic opacity-70 mt-1">(edited)</div>
            )}
          </>
        )}

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

        {/* Edit/Delete Menu (for sent messages) */}
        {isSent && !isEditing && (
          <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 hover:bg-gray-800 rounded"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                />
              </svg>
            </button>
            {showMenu && (
              <div className="absolute right-0 mt-1 bg-gray-800 rounded shadow-lg z-10 min-w-[120px]">
                {canEdit() && (
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-700 text-sm"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowDeleteConfirm(true);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-700 text-sm text-red-400"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        )}

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="absolute top-0 left-0 right-0 bottom-0 bg-gray-900 bg-opacity-90 rounded flex items-center justify-center z-20">
            <div className="bg-gray-800 rounded p-4 max-w-xs">
              <div className="mb-3 text-sm">Delete message?</div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDelete(false)}
                  className="flex-1 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                >
                  Delete for me
                </button>
                {!message.isRead && (
                  <button
                    onClick={() => handleDelete(true)}
                    className="flex-1 px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                  >
                    Delete for everyone
                  </button>
                )}
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
