// Claim API wrapper for ADAL frontend
// Provides methods for segmenting, retrieving, and managing claims
// Uses the shared axiosClient so baseURL, headers, and tokens are handled centrally

import axiosClient from './axiosClient'
import logger from '../utils/logger'

// Helper to log useful error info then rethrow so callers can handle it
const logAndRethrow = (label, error) => {
  const status = error?.response?.status || null
  const data = error?.response?.data || null
  const url = error?.config?.url || null
  logger.error(`[claimApi] ${label} error:`, { message: error?.message, status, url, data })
  throw error
}

const segmentClaims = (documentId, useCitationGuidance = false) =>
  axiosClient
    .post(
      `/claims/documents/${encodeURIComponent(documentId)}/segment`,
      {
        use_citation_guidance: Boolean(useCitationGuidance),
      },
      {
        timeout: 0, // segmentation can include first-run model download/warmup; don't abort client-side
      }
    )
    .catch((err) => logAndRethrow('segmentClaims', err))

const getClaimModelStatus = () =>
  axiosClient
    .get('/claims/warmup/status')
    .catch((err) => logAndRethrow('getClaimModelStatus', err))

const warmupClaimModel = () =>
  axiosClient
    .post('/claims/warmup')
    .catch((err) => logAndRethrow('warmupClaimModel', err))

const getAllClaims = (skip = 0, limit = 50) =>
  axiosClient
    .get('/claims', { params: { skip, limit } })
    .catch((err) => logAndRethrow('getAllClaims', err))

const getClaimsByDocument = (documentId, { skip = 0, limit = 200 } = {}) =>
  axiosClient
    .get(`/claims/documents/${encodeURIComponent(documentId)}`, { params: { skip, limit } })
    .catch((err) => logAndRethrow('getClaimsByDocument', err))

const getClaimById = (claimId) =>
  axiosClient
    .get(`/claims/${encodeURIComponent(claimId)}`)
    .catch((err) => logAndRethrow('getClaimById', err))

const getClaimCitations = (claimId) =>
  axiosClient
    .get(`/claims/${encodeURIComponent(claimId)}/citations`)
    .catch((err) => logAndRethrow('getClaimCitations', err))

const deleteClaims = (documentId) =>
  axiosClient
    .delete(`/claims/documents/${encodeURIComponent(documentId)}`)
    .catch((err) => logAndRethrow('deleteClaims', err))

const claimApi = {
  segmentClaims,
  getClaimModelStatus,
  warmupClaimModel,
  getAllClaims,
  getClaimsByDocument,
  getClaimById,
  getClaimCitations,
  deleteClaims,
}

export default claimApi

