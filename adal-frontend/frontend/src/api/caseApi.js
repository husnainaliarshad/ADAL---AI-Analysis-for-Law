// Case API for ADAL Frontend
import axiosClient from './axiosClient'

export const getCases = async (status = null) => {
  const response = await axiosClient.get('/cases', { params: { status } })
  return response.data
}

export const getCase = async (caseId) => {
  const response = await axiosClient.get(`/cases/${caseId}`)
  return response.data
}

export const createCase = async (data) => {
  const response = await axiosClient.post('/cases', data)
  return response.data
}

export const updateCase = async (caseId, data) => {
  const response = await axiosClient.put(`/cases/${caseId}`, data)
  return response.data
}

export const deleteCase = async (caseId) => {
  const response = await axiosClient.delete(`/cases/${caseId}`)
  return response.data
}

export const linkDocument = async (caseId, documentId) => {
  const response = await axiosClient.post(`/cases/${caseId}/documents`, { document_id: documentId })
  return response.data
}

export const linkConversation = async (caseId, conversationId) => {
  const response = await axiosClient.post(`/cases/${caseId}/conversations`, { conversation_id: conversationId })
  return response.data
}

export const sendCaseMessage = async (message, caseId, conversationId = null) => {
  const response = await axiosClient.post('/cases/agent/send', {
    message,
    case_id: caseId,
    conversation_id: conversationId,
  }, { timeout: 120000 })
  return response.data
}
