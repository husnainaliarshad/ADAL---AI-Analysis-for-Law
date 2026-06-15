// Document API wrapper for ADAL frontend
// Provides methods for upload, retrieval, deletion, processing, and search
// Uses the shared axiosClient so baseURL, headers, and tokens are handled centrally

import axiosClient from './axiosClient'
import logger from '../utils/logger'

// Helper to log useful error info then rethrow so callers can handle it
const logAndRethrow = (label, error) => {
  const status = error?.response?.status || null
  const data = error?.response?.data || null
  const url = error?.config?.url || null
  logger.error(`[documentApi] ${label} error:`, { message: error?.message, status, url, data })
  throw error
}

const documentApi = {
  // Upload a document file via multipart/form-data
  // Expects a FormData instance (e.g., formData.append('file', file))
  // Returns metadata (id, name, size, status)
  uploadDocument: (formData) =>
    axiosClient
      .post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .catch((err) => logAndRethrow('uploadDocument', err)),

  // Fetch all uploaded documents/files
  getAllDocuments: () =>
    axiosClient
      .get('/files/')
      .catch((err) => logAndRethrow('getAllDocuments', err)),

  // Fetch a document/file by ID (metadata + OCR text if available)
  getDocumentById: (documentId) =>
    axiosClient
      .get(`/files/${encodeURIComponent(documentId)}`)
      .catch((err) => logAndRethrow('getDocumentById', err)),

  // Get file text by filename
  getFileText: (filename) =>
    axiosClient
      .get(`/files/${encodeURIComponent(filename)}/text`)
      .catch((err) => logAndRethrow('getFileText', err)),

  // Extract text from a document (trigger OCR)
  extractText: (documentId) =>
    axiosClient
      .post(`/files/${encodeURIComponent(documentId)}/extract-text`)
      .catch((err) => logAndRethrow('extractText', err)),

  // Delete a document/file by ID
  deleteDocument: (documentId) =>
    axiosClient
      .delete(`/files/${encodeURIComponent(documentId)}`)
      .catch((err) => logAndRethrow('deleteDocument', err)),

  // Download a document/file by ID
  downloadDocument: (documentId) =>
    axiosClient
      .get(`/files/${encodeURIComponent(documentId)}/download`, {
        responseType: 'blob', // Important for file downloads
      })
      .catch((err) => logAndRethrow('downloadDocument', err)),

  // Legacy: Trigger processing (OCR/AI analysis) for a document by ID
  // Note: Use extractText instead for text extraction
  processDocument: (documentId) =>
    axiosClient
      .post(`/files/${encodeURIComponent(documentId)}/extract-text`)
      .catch((err) => logAndRethrow('processDocument', err)),
}

export default documentApi
// Document API functions placeholder
