// Citation API wrapper for ADAL frontend
// Provides methods for extracting, retrieving, and managing citations
// Uses the shared axiosClient so baseURL, headers, and tokens are handled centrally

import axiosClient from './axiosClient'
import logger from '../utils/logger'

// Helper to log useful error info then rethrow so callers can handle it
const logAndRethrow = (label, error) => {
  const status = error?.response?.status || null
  const data = error?.response?.data || null
  const url = error?.config?.url || null
  logger.error(`[citationApi] ${label} error:`, { message: error?.message, status, url, data })
  throw error
}

// Core API calls (named per integration spec)
const extractCitations = (documentId) =>
  axiosClient
    .post(
      `/citations/documents/${encodeURIComponent(documentId)}/extract`,
      undefined,
      {
        timeout: 0, // extraction can legitimately run past the default 30s client timeout
      }
    )
    .catch((err) => logAndRethrow('extractCitations', err))

const getCitationsByDocument = (documentId) =>
  axiosClient
    .get(`/citations/documents/${encodeURIComponent(documentId)}`)
    .catch((err) => logAndRethrow('getCitationsByDocument', err))

const getCitationById = (citationId) =>
  axiosClient
    .get(`/citations/${encodeURIComponent(citationId)}`)
    .catch((err) => logAndRethrow('getCitationById', err))

const deleteCitations = (documentId) =>
  axiosClient
    .delete(`/citations/documents/${encodeURIComponent(documentId)}`)
    .catch((err) => logAndRethrow('deleteCitations', err))

// Exported client with backward-compatible aliases
const citationApi = {
  extractCitations,
  getCitationsByDocument,
  getCitationById,
  deleteCitations,
  // Aliases kept for existing call sites
  getDocumentCitations: getCitationsByDocument,
  deleteDocumentCitations: deleteCitations,
}

export default citationApi
