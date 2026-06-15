import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('notificationsService fallback behavior', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns local fallback data when notifications API is disabled', async () => {
    const getMock = vi.fn()

    vi.doMock('../config/runtimeConfig', () => ({
      ENABLE_NOTIFICATIONS_API: false,
      DEBUG_LOGS: false,
    }))

    vi.doMock('../api/axiosClient', () => ({
      default: {
        get: getMock,
      },
    }))

    const { fetchNotifications } = await import('../services/notificationsService')
    const result = await fetchNotifications()

    expect(result.usingFallback).toBe(true)
    expect(result.notifications.length).toBeGreaterThan(0)
    expect(getMock).not.toHaveBeenCalled()
  })

  it('returns local fallback data when notifications API is enabled but unavailable', async () => {
    const getMock = vi.fn().mockRejectedValue(new Error('endpoint missing'))

    vi.doMock('../config/runtimeConfig', () => ({
      ENABLE_NOTIFICATIONS_API: true,
      DEBUG_LOGS: false,
    }))

    vi.doMock('../api/axiosClient', () => ({
      default: {
        get: getMock,
      },
    }))

    const { fetchNotifications } = await import('../services/notificationsService')
    const result = await fetchNotifications()

    expect(result.usingFallback).toBe(true)
    expect(result.notifications.length).toBeGreaterThan(0)
    expect(getMock).toHaveBeenCalledWith('/notifications')
  })
})
