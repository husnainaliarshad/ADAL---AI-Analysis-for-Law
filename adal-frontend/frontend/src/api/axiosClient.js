// Reusable Axios client for ADAL frontend
// - creates an axios instance with a configured baseURL
// - attaches JWT access token from localStorage to requests
// - logs requests/responses in development for easier debugging
// - handles 401 Unauthorized in a centralized place

import axios from 'axios'
import { getAccessToken, getRefreshToken, setAccessToken, setRefreshToken, clearTokens } from '../utils/tokenStorage'
import { API_URL } from '../config/runtimeConfig'
import logger from '../utils/logger'

// Base URL for API requests (change as required)
// Create an axios instance with default JSON headers
const axiosClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 30000, // 30 seconds timeout for all requests (default)
  // Note: Per-request timeout can be overridden in request config
  // e.g., { timeout: 120000 } for file uploads
})

// Helper: detect if a request targets documents/files endpoints
const isDocumentsRequest = (cfg) => {
  if (!cfg || !cfg.url) return false
  try {
    const url = String(cfg.url)
    return url.includes('/documents') || url.includes('/files')
  } catch {
    return false
  }
}

// Request interceptor: attach Authorization header when token exists
axiosClient.interceptors.request.use(
  (config) => {
    try {
      // Read token from localStorage (key used by the app)
      const token = getAccessToken()
      if (token) {
        config.headers = config.headers || {}
        config.headers.Authorization = `Bearer ${token}`
      }

      logger.debug('[axios] Request:', {
        method: config.method,
        url: config.baseURL ? `${config.baseURL}${config.url}` : config.url,
        headers: config.headers,
        params: config.params,
        data: config.data,
      })

      return config
    } catch (err) {
      // If anything goes wrong in the interceptor, forward the error
      logger.error('[axios] Request interceptor error', err)
      return Promise.reject(err)
    }
  },
  (error) => {
    // Always log concise errors for document requests
    if (isDocumentsRequest(error?.config)) {
      const method = error?.config?.method?.toUpperCase?.() || 'REQUEST'
      const url = error?.config?.url
      logger.error(`[documents] ${method} ${url} request error`, { message: error?.message })
    }
    logger.error('[axios] Request error', error)
    return Promise.reject(error)
  }
)

// Internal helpers for refresh handling
let isRefreshing = false
let pendingQueue = [] // queue of { resolve, reject }

const processQueue = (error, token = null) => {
  pendingQueue.forEach(({ resolve, reject, originalRequest }) => {
    if (error) {
      reject(error)
    } else {
      // attach new token and retry
      if (token) {
        originalRequest.headers = originalRequest.headers || {}
        originalRequest.headers.Authorization = `Bearer ${token}`
      }
      resolve(axiosClient(originalRequest))
    }
  })
  pendingQueue = []
}

// Response interceptor: log and centralize error handling
axiosClient.interceptors.response.use(
  (response) => {
    logger.debug('[axios] Response:', {
      status: response.status,
      url: response.config && response.config.url,
      data: response.data,
    })
    return response
  },
  async (error) => {
    // Log a readable error for debugging
    // Always log concise errors for document requests
    if (isDocumentsRequest(error?.config)) {
      const method = error?.config?.method?.toUpperCase?.() || 'REQUEST'
      const url = error?.config?.url
      const status = error?.response?.status || null
      const data = error?.response?.data || null
      logger.error(`[documents] ${method} ${url} failed`, { status, data })
    }
    logger.error('[axios] Response error:', {
      message: error.message,
      status: error.response ? error.response.status : null,
      url: error.config ? error.config.url : null,
      data: error.response ? error.response.data : null,
    })

    // Handle 401 Unauthorized centrally with refresh logic
    const { response, config } = error || {}
    const isRefreshReq = config && typeof config.url === 'string' && (
      config.url.includes('/auth/refresh') ||
      config.url.includes('/auth/refresh-token') ||
      config.url.includes('/auth/token/refresh')
    )
    if (response && response.status === 401 && config && !config.__isRetryRequest && !isRefreshReq) {
      const originalRequest = { ...config, __isRetryRequest: true }

      if (isRefreshing) {
        // Queue the request until refresh is done
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject, originalRequest })
        })
      }

      isRefreshing = true
      try {
        const storedRefreshToken = getRefreshToken()
        if (!storedRefreshToken) {
          logger.warn('[axios] No refresh token available; clearing tokens')
          clearTokens()
          processQueue(error, null)
          return Promise.reject(error)
        }

        // Dynamic import to avoid circular dependency
        const { default: authApi } = await import('./authApi')
        const refreshRes = await authApi.refreshToken(storedRefreshToken)
        const newAccessToken = refreshRes?.data?.token || refreshRes?.data?.accessToken
        const newRefreshToken = refreshRes?.data?.refreshToken || refreshRes?.data?.refresh_token

        if (newAccessToken) {
          setAccessToken(newAccessToken)
        }
        if (newRefreshToken) {
          setRefreshToken(newRefreshToken)
        }

        // Retry original and resolve queued requests
        originalRequest.headers = originalRequest.headers || {}
        if (newAccessToken) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        }
        const retryPromise = axiosClient(originalRequest)

        processQueue(null, newAccessToken)
        return retryPromise
      } catch (refreshErr) {
        logger.warn('[axios] Token refresh failed; clearing tokens')
        // Clear tokens and reject queued
        clearTokens()
        processQueue(refreshErr, null)
        return Promise.reject(refreshErr)
      } finally {
        isRefreshing = false
      }
    }

    // Re-throw the error so callers can handle it as needed
    return Promise.reject(error)
  }
)

export default axiosClient
