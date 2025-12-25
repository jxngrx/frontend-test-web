# Postman Collection for Chat App Backend API

## How to Import

1. **Import the JSON file directly:**
   - Open Postman
   - Click "Import" button (top left)
   - Select `postman_collection.json` file
   - Click "Import"

2. **Or copy from this document:**
   - The complete collection JSON is in `postman_collection.json`
   - Copy the entire content and import it as "Raw text" in Postman

## Environment Variables Setup

After importing, set up environment variables in Postman:

1. Create a new environment or use the default
2. Add these variables:

| Variable | Initial Value | Current Value | Description |
|----------|---------------|---------------|-------------|
| `base_url` | `http://localhost:3000` | `http://localhost:3000` | Base URL of your API server |
| `auth_token` | (empty) | (auto-set) | JWT token (auto-set after login) |
| `user_id` | (empty) | (set manually) | Current user ID |
| `other_user_id` | (empty) | (set manually) | Other user ID for chat/call |
| `chat_id` | (empty) | (set manually) | Chat ID |
| `message_id` | (empty) | (set manually) | Message ID |
| `call_id` | (empty) | (set manually) | Call ID |
| `receiver_id` | (empty) | (set manually) | Receiver user ID |
| `file_url` | (empty) | (set manually) | Uploaded file URL |

## Collection Structure

### 🔐 Authentication
- **Request OTP** - `POST /api/v1/auth/request-otp`
  - Body: `{ "phone": "+1234567890" }`

- **Verify OTP** - `POST /api/v1/auth/verify-otp`
  - Body: `{ "phone": "+1234567890", "otp": "123456" }`
  - Automatically saves token to `auth_token` variable

### 👤 Users
- **Get Profile** - `GET /api/v1/users/profile`
  - Requires: Bearer token

- **Update Username** - `PUT /api/v1/users/username`
  - Body: `{ "username": "newusername" }`
  - Requires: Bearer token

- **Get User By ID** - `GET /api/v1/users/:userId`
  - Requires: Bearer token
  - Path variable: `userId`

### 📇 Contacts
- **Sync Contacts** - `POST /api/v1/contacts/sync`
  - Body: `{ "phoneHashes": ["hash1", "hash2", "hash3"] }`
  - Requires: Bearer token

- **Get Contacts** - `GET /api/v1/contacts`
  - Requires: Bearer token

### 💬 Chats
- **Create or Get Chat** - `POST /api/v1/chats`
  - Body: `{ "otherUserId": "user_id_here" }`
  - Requires: Bearer token

- **Get User Chats** - `GET /api/v1/chats`
  - Requires: Bearer token

- **Get Chat By ID** - `GET /api/v1/chats/:chatId`
  - Requires: Bearer token
  - Path variable: `chatId`

### 📨 Messages
- **Send Message** - `POST /api/v1/messages`
  - Body: `{ "chatId": "chat_id", "type": "text", "content": "Hello" }`
  - Types: `text`, `image`, `video`, `voice`, `file`
  - Requires: Bearer token

- **Get Chat Messages** - `GET /api/v1/messages/chat/:chatId?limit=50`
  - Query params: `limit`, `before` (for pagination)
  - Requires: Bearer token

- **Mark Messages as Read** - `PUT /api/v1/messages/:chatId/read`
  - Requires: Bearer token

- **Mark Messages as Delivered** - `PUT /api/v1/messages/:chatId/delivered`
  - Requires: Bearer token

- **Edit Message** - `PUT /api/v1/messages/:messageId/edit`
  - Body: `{ "content": "Edited message" }`
  - Requires: Bearer token
  - Only within 30 minutes

- **Delete Message** - `DELETE /api/v1/messages/:messageId?deleteForEveryone=false`
  - Query param: `deleteForEveryone` (true/false)
  - Requires: Bearer token

### 📞 Calls
- **Initiate Call** - `POST /api/v1/calls`
  - Body: `{ "receiverId": "user_id" }`
  - Requires: Bearer token

- **Answer Call** - `POST /api/v1/calls/:callId/answer`
  - Requires: Bearer token

- **Reject Call** - `POST /api/v1/calls/:callId/reject`
  - Requires: Bearer token

- **End Call** - `POST /api/v1/calls/:callId/end`
  - Requires: Bearer token

- **Get Call History** - `GET /api/v1/calls/history?limit=50`
  - Query param: `limit`
  - Requires: Bearer token

### 📁 Media
- **Upload File** - `POST /api/v1/media/upload`
  - Form data: `file` (file upload)
  - Requires: Bearer token

- **Delete File** - `DELETE /api/v1/media`
  - Body: `{ "url": "file_url" }`
  - Requires: Bearer token

### ❤️ Health
- **Health Check** - `GET /health`
  - No authentication required

## Quick Start Guide

1. **Import the collection** (see above)

2. **Set environment variables:**
   - Update `base_url` to match your server (default: `http://localhost:3000`)

3. **Authenticate:**
   - Run "Request OTP" with a phone number
   - Check server logs for OTP (in development mode)
   - Run "Verify OTP" with the OTP
   - Token is automatically saved to `auth_token`

4. **Test endpoints:**
   - All other endpoints now use the `auth_token` automatically
   - Update path variables (`userId`, `chatId`, etc.) as needed

## Example Workflow

1. **Register/Login:**
   ```
   POST /auth/request-otp → { phone: "+1234567890" }
   POST /auth/verify-otp → { phone: "+1234567890", otp: "123456" }
   ```

2. **Get Profile:**
   ```
   GET /users/profile
   ```

3. **Sync Contacts:**
   ```
   POST /contacts/sync → { phoneHashes: ["hash1", "hash2"] }
   ```

4. **Create Chat:**
   ```
   POST /chats → { otherUserId: "user_id" }
   ```

5. **Send Message:**
   ```
   POST /messages → { chatId: "chat_id", type: "text", content: "Hello" }
   ```

6. **Initiate Call:**
   ```
   POST /calls → { receiverId: "user_id" }
   ```

## Notes

- All endpoints (except `/auth/*` and `/health`) require Bearer token authentication
- Token is automatically included via the `auth_token` variable
- Update collection variables after getting IDs from responses
- For file uploads, use Postman's file upload feature in the Body tab
- WebRTC signaling happens via Socket.IO (not in this REST API collection)

## Socket.IO Events

For real-time features (chat, calls, presence), use Socket.IO client with these events:

**Client → Server:**
- `message:send`
- `message:read`
- `message:delivered`
- `call:initiate`
- `call:answer`
- `call:reject`
- `call:end`
- `call:webrtc-offer`
- `call:webrtc-answer`
- `call:webrtc-ice-candidate`

**Server → Client:**
- `message:new`
- `message:sent`
- `message:read`
- `message:delivered`
- `call:incoming`
- `call:initiated`
- `call:answered`
- `call:rejected`
- `call:ended`
- `user:online`
- `user:offline`

Connect to Socket.IO with:
```javascript
const socket = io('http://localhost:3000', {
  auth: {
    token: 'your-jwt-token'
  }
});
```
