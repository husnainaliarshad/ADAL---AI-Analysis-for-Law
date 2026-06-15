import axiosClient from './axiosClient'
import logger from '../utils/logger'

const logAndRethrow = (label, error) => {
  const status = error?.response?.status || null
  const data = error?.response?.data || null
  const url = error?.config?.url || null
  logger.error(`[summaryApi] ${label} error:`, { message: error?.message, status, url, data })
  throw error
}

const generateSummary = ({ documentId, short = false }) =>
  axiosClient
    .post('/summary', { document_id: documentId, short })
    .catch((err) => logAndRethrow('generateSummary', err))

const summaryApi = {
  generateSummary,
}

export default summaryApi

