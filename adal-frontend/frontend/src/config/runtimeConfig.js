const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {}

const parseBoolean = (value, defaultValue = false) => {
  if (value == null) return defaultValue
  const normalized = String(value).trim().toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on'
}

const trimTrailingSlash = (value) => String(value || '').replace(/\/+$/, '')

const resolveApiUrl = () => {
  const explicitApiUrl = String(env.VITE_API_URL || '').trim()
  if (explicitApiUrl) return trimTrailingSlash(explicitApiUrl)

  // Backward-compatible fallback during migration.
  const deprecatedBaseUrl = String(env.VITE_API_BASE_URL || '').trim()
  if (deprecatedBaseUrl) {
    return `${trimTrailingSlash(deprecatedBaseUrl)}/api`
  }
  return 'http://13.53.135.100:9006/api'
}

export const API_URL = resolveApiUrl()
export const ENABLE_DEV_ROUTES = parseBoolean(env.VITE_ENABLE_DEV_ROUTES, false)
export const ENABLE_NOTIFICATIONS_API = parseBoolean(env.VITE_ENABLE_NOTIFICATIONS_API, false)
export const DEBUG_LOGS = parseBoolean(env.VITE_DEBUG, false)

export default {
  API_URL,
  ENABLE_DEV_ROUTES,
  ENABLE_NOTIFICATIONS_API,
  DEBUG_LOGS,
}
