// Canonical token storage keys used across the app.
export const ACCESS_TOKEN_KEY = 'accessToken'
export const REFRESH_TOKEN_KEY = 'refreshToken'

export const getAccessToken = () => {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY)
  } catch {
    return null
  }
}

export const setAccessToken = (value) => {
  try {
    if (value == null) return
    localStorage.setItem(ACCESS_TOKEN_KEY, value)
  } catch {
    // ignore storage errors
  }
}

export const getRefreshToken = () => {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY)
  } catch {
    return null
  }
}

export const setRefreshToken = (value) => {
  try {
    if (value == null) return
    localStorage.setItem(REFRESH_TOKEN_KEY, value)
  } catch {
    // ignore storage errors
  }
}

export const clearTokens = () => {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  } catch {
    // ignore storage errors
  }
}

export default {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  getAccessToken,
  setAccessToken,
  getRefreshToken,
  setRefreshToken,
  clearTokens,
}
