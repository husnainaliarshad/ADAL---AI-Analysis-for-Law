import { beforeEach, describe, expect, it } from 'vitest'
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from '../utils/tokenStorage'
import { migrateLegacyTokens } from '../utils/legacyTokenMigration'

describe('legacy token migration', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('migrates legacy token keys to canonical keys once and removes legacy keys', () => {
    localStorage.setItem('token', 'legacy-access')
    localStorage.setItem('refresh_token', 'legacy-refresh')

    migrateLegacyTokens()

    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBe('legacy-access')
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('legacy-refresh')
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
  })

  it('does not overwrite canonical keys when already present', () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'current-access')
    localStorage.setItem(REFRESH_TOKEN_KEY, 'current-refresh')
    localStorage.setItem('token', 'legacy-access')
    localStorage.setItem('refresh_token', 'legacy-refresh')

    migrateLegacyTokens()

    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBe('current-access')
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('current-refresh')
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
  })
})
