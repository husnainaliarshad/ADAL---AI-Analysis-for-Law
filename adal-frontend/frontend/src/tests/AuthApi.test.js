import { beforeEach, describe, expect, it, vi } from 'vitest'

const postMock = vi.fn()
const getRefreshTokenMock = vi.fn()

vi.mock('../api/axiosClient', () => ({
  default: {
    post: postMock,
  },
}))

vi.mock('../utils/tokenStorage', () => ({
  getRefreshToken: getRefreshTokenMock,
}))

describe('authApi.refreshToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects before making a request when no refresh token exists', async () => {
    getRefreshTokenMock.mockReturnValue(null)
    const { default: authApi } = await import('../api/authApi')

    await expect(authApi.refreshToken()).rejects.toThrow('No refresh token available')
    expect(postMock).not.toHaveBeenCalled()
  })

  it('posts the explicit refresh token when one is provided', async () => {
    postMock.mockResolvedValueOnce({ data: { accessToken: 'next-access', refreshToken: 'next-refresh' } })
    const { default: authApi } = await import('../api/authApi')

    await authApi.refreshToken('abc123')

    expect(postMock).toHaveBeenCalledWith('/auth/refresh', { refreshToken: 'abc123' })
  })
})
