import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from './tokenStorage'

export const migrateLegacyTokens = () => {
  try {
    const currentAccess = localStorage.getItem(ACCESS_TOKEN_KEY)
    const currentRefresh = localStorage.getItem(REFRESH_TOKEN_KEY)
    const legacyAccess = localStorage.getItem('token')
    const legacyRefresh = localStorage.getItem('refresh_token')

    if (!currentAccess && legacyAccess) {
      localStorage.setItem(ACCESS_TOKEN_KEY, legacyAccess)
    }

    if (!currentRefresh && legacyRefresh) {
      localStorage.setItem(REFRESH_TOKEN_KEY, legacyRefresh)
    }

    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
  } catch {
    // ignore storage errors
  }
}

export default migrateLegacyTokens
