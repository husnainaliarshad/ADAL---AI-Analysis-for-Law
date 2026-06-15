import axiosClient from '../api/axiosClient'
import { ENABLE_NOTIFICATIONS_API } from '../config/runtimeConfig'
import logger from '../utils/logger'

const FALLBACK_NOTIFICATIONS = Object.freeze([
  {
    id: 'local-1',
    type: 'system',
    text: 'Welcome to ADAL. Your workspace is ready.',
    read: false,
    createdAt: '2026-01-01T10:00:00.000Z',
  },
  {
    id: 'local-2',
    type: 'ocr',
    text: 'OCR complete: Sample_Contract.pdf',
    read: false,
    createdAt: '2026-01-01T09:00:00.000Z',
  },
  {
    id: 'local-3',
    type: 'doc',
    text: 'Document processed: Evidence_Photo.jpg',
    read: true,
    createdAt: '2025-12-31T16:00:00.000Z',
  },
])

const cloneFallbackNotifications = () => FALLBACK_NOTIFICATIONS.map((item) => ({ ...item }))

const normalizeNotification = (raw, index) => ({
  id: raw?.id ?? `notification-${index}`,
  type: raw?.type ?? 'system',
  text: raw?.text ?? raw?.message ?? 'Notification',
  read: Boolean(raw?.read),
  createdAt: raw?.createdAt ?? raw?.created_at ?? new Date().toISOString(),
})

export const fetchNotifications = async () => {
  if (!ENABLE_NOTIFICATIONS_API) {
    return {
      notifications: cloneFallbackNotifications(),
      usingFallback: true,
      message: 'Notifications API is disabled; showing local fallback notifications.',
    }
  }

  try {
    const res = await axiosClient.get('/notifications')
    const notifications = Array.isArray(res?.data)
      ? res.data.map(normalizeNotification)
      : []
    return {
      notifications,
      usingFallback: false,
      message: null,
    }
  } catch (error) {
    logger.warn('[notificationsService] Notifications API unavailable, using fallback', error)
    return {
      notifications: cloneFallbackNotifications(),
      usingFallback: true,
      message: 'Notifications API is unavailable; showing local fallback notifications.',
    }
  }
}

export const toggleNotificationRead = (list, id) => (
  list.map((item) => (item.id === id ? { ...item, read: !item.read } : item))
)

export const removeNotification = (list, id) => list.filter((item) => item.id !== id)

export const markAllNotificationsRead = (list) => list.map((item) => ({ ...item, read: true }))

export default {
  fetchNotifications,
  toggleNotificationRead,
  removeNotification,
  markAllNotificationsRead,
}
