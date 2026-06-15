# ADAL Chat API Documentation

This document explains the flow of the Chat feature in the ADAL application, covering the connection between the frontend, backend, and database.

## Architecture Overview

The chat feature uses a standard client-server architecture:
- **Frontend**: React (Vite) application that provides the chat interface.
- **Backend**: FastAPI server that handles logic, authentication, and LLM integration.
- **Database**: PostgreSQL (via SQLAlchemy) for persisting conversations and messages.
- **LLM**: DeepSeek API (OpenAI-compatible) for generating legal assistance responses.

---

## 1. Data Models & Database

The system tracks chats using two primary tables in the `adal_local` database:

### Conversations Table
Stores the metadata for a chat session.
- `id` (Integer, PK): Unique identifier.
- `user_id` (Integer, FK): The user who owns this chat.
- `title` (String): Display name for the chat (e.g., "Property Law Inquiry").
- `total_messages` (Integer): Counter for messages in this session.
- `updated_at` (DateTime): Used to sort the sidebar (newest first).

### Messages Table
Stores every individual exchange in a conversation.
- `id` (Integer, PK): Unique identifier.
- `conversation_id` (Integer, FK): The parent conversation.
- `role` (String): Either `user` or `assistant`.
- `content` (Text): The actual text of the message.
- `msg_metadata` (JSONB): Stores token usage, model info, or other technical details.

---

## 2. Backend API Endpoints

The chat router is available at the `/chat` prefix (e.g., `http://localhost:9006/api/chat/...`).

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **POST** | `/send` | The core endpoint. Sends a user message and gets an AI response. |
| **GET** | `/conversations` | Lists the user's past chats (for the sidebar). |
| **GET** | `/conversations/{id}/messages` | Fetches the history of a specific chat session. |
| **PUT** | `/conversations/{id}/title` | Renames a conversation (manually or auto-generated). |
| **DELETE** | `/conversations/{id}` | Deletes the chat and its associated messages. |

### The `/send` Request Payload
```json
{
  "message": "What are the requirements for a valid gift under Pakistani law?",
  "conversation_id": 123 // Omit or send null to start a new chat
}
```

### The `/send` Response Payload
```json
{
  "conversation_id": 123,
  "message_id": 456,
  "response": "Under Pakistani law, specifically the Transfer of Property Act...",
  "role": "assistant",
  "metadata": {
    "model": "deepseek-chat",
    "total_tokens": 150
  }
}
```

---

## 3. Frontend Implementation

### Axios Client (`axiosClient.js`)
All calls go through a centralized `axiosClient`. It automatically:
1. Attaches the **JWT Access Token** from `localStorage` to the `Authorization: Bearer <token>` header.
2. Handles common errors (like 401 Unauthorized for token refresh).

### Chat API Wrapper (`chatApi.js`)
This file exports functions that components use to talk to the backend.
- `sendMessage(message, conversationId)`
- `getConversations()`
- `getMessages(conversationId)`

---

## 4. Typical Message Flow

1. **User Input**: User types a message in the UI and hits Enter.
2. **Frontend Call**: The `Chat` component calls `chatApi.sendMessage(content, activeConvoId)`.
3. **Backend Routing**: 
   - The FastAPI `send_message` endpoint receives the request.
   - It identifies the user via the JWT token.
4. **Service Logic** (`chat_service.py`):
   - **Step A**: If `conversation_id` is null, it creates a new `Conversation` in the DB.
   - **Step B**: It saves the user's message to the `Messages` table.
   - **Step C**: It loads the conversation history (last 50 messages) to provide context to the AI.
   - **Step D**: It sends the history + current message + **System Prompt** (rules for the AI) to DeepSeek.
   - **Step E**: DeepSeek returns a response.
   - **Step F**: The response is saved to the `Messages` table as an `assistant` message.
   - **Step G**: If it's a new chat, it generates a title based on the first message.
5. **UI Update**: The frontend receives the JSON response, updates its local `messages` state, and the new message appears on screen.

---

## 5. Critical Notes for Development

- **Auth Required**: All chat endpoints require a valid JWT. If you get a 401, ensure you are logged in.
- **Local DB**: The chat history is stored locally in the PostgreSQL database specified in `LOCAL_DATABASE_URL`.
- **System Prompt**: The AI's behavior (its "personality" and knowledge) is defined by `LEGAL_SYSTEM_PROMPT` in `chat_service.py`. Modify this if you want the bot to behave differently.
- **Port**: By default, the backend runs on `9006`. Ensure the frontend `.env` matches: `VITE_API_BASE_URL=http://localhost:9006/api`.
