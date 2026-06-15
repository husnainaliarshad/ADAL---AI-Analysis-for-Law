import axiosClient from './axiosClient'
import logger from '../utils/logger'

const logAndRethrow = (label, error) => {
  const status = error?.response?.status || null
  const data = error?.response?.data || null
  const url = error?.config?.url || null
  logger.error(`[evidenceApi] ${label} error:`, { message: error?.message, status, url, data })
  throw error
}

const getEvidenceByDocument = (documentId) =>
  axiosClient
    .get(`/evidence/documents/${encodeURIComponent(documentId)}`)
    .catch((err) => logAndRethrow('getEvidenceByDocument', err))

const deleteDocumentEvidence = (documentId) =>
  axiosClient
    .delete(`/evidence/documents/${encodeURIComponent(documentId)}`)
    .catch((err) => logAndRethrow('deleteDocumentEvidence', err))

/** Retrieve evidence from FAISS for a claim. Must be called before evidence appears in DB. */
const retrieveEvidenceForClaim = (claimId, options = {}) =>
  axiosClient
    .post(`/evidence/claims/${encodeURIComponent(claimId)}/retrieve`, {
      k: options.k ?? 10,
      threshold: options.threshold ?? 0.3,
      index_name: options.index_name ?? 'supreme_court_judgments',
    })
    .catch((err) => logAndRethrow('retrieveEvidenceForClaim', err))

const evidenceApi = {
  getEvidenceByDocument,
  deleteDocumentEvidence,
  retrieveEvidenceForClaim,
}

export default evidenceApi

