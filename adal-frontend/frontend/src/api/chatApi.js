// Chat API for ADAL Frontend
// Handles all chat-related API calls to the backend.
// When a case is active, messages are routed through the case agent.

import axiosClient from './axiosClient'

// Active case state (set by CaseContext)
let _activeCaseId = null

export function setActiveCaseId(caseId) {
  _activeCaseId = caseId
}

// Send a message (routes to case agent when a case is active)
export const sendMessage = async (message, conversationId = null) => {
  if (_activeCaseId) {
    const response = await axiosClient.post('/cases/agent/send', {
      message,
      case_id: _activeCaseId,
      conversation_id: conversationId,
    }, { timeout: 120000 })
    return response.data
  }

  const response = await axiosClient.post('/chat/send', {
    message,
    conversation_id: conversationId,
  }, { timeout: 120000 })
  return response.data
}

// Get all conversations for the current user (filtered by case if active)
export const getConversations = async (limit = 20, offset = 0) => {
  const params = { limit, offset }
  if (_activeCaseId) {
    params.case_id = _activeCaseId
  }
  const response = await axiosClient.get('/chat/conversations', { params })
  return response.data
}

// Get a single conversation by ID
export const getConversation = async (conversationId) => {
  const response = await axiosClient.get(`/chat/conversations/${conversationId}`)
  return response.data
}

// Create a new blank conversation
export const createConversation = async (title = null) => {
  const response = await axiosClient.post('/chat/conversations', { title })
  return response.data
}

// Update conversation title
export const updateConversationTitle = async (conversationId, title) => {
  const response = await axiosClient.put(`/chat/conversations/${conversationId}/title`, { title })
  return response.data
}

// Delete a conversation and all its messages
export const deleteConversation = async (conversationId) => {
  const response = await axiosClient.delete(`/chat/conversations/${conversationId}`)
  return response.data
}

// Get messages for a conversation
export const getMessages = async (conversationId, limit = 50) => {
  const response = await axiosClient.get(`/chat/conversations/${conversationId}/messages`, {
    params: { limit }
  })
  return response.data
}
