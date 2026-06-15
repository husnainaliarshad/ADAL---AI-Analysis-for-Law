import React, { useCallback, useEffect, useState } from 'react'
import {
  Box,
  Container,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  Avatar,
  ListItemText,
  IconButton,
  Button,
  Divider,
  Grid,
  CircularProgress,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import MarkReadIcon from '@mui/icons-material/MarkEmailRead'
import MarkUnreadIcon from '@mui/icons-material/MarkEmailUnread'
import NotificationsIcon from '@mui/icons-material/Notifications'

import Sidebar from '../components/layout/Sidebar'
import TopBar from './Dashboard/components/TopBar'
import {
  fetchNotifications,
  markAllNotificationsRead,
  removeNotification,
  toggleNotificationRead,
} from '../services/notificationsService'

export default function NotificationsPage() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [statusMessage, setStatusMessage] = useState(null)
  const [notifications, setNotifications] = useState([])

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    const result = await fetchNotifications()
    setNotifications(result.notifications)
    setStatusMessage(result.message)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  const toggleRead = (id) => {
    setNotifications((prev) => toggleNotificationRead(prev, id))
  }

  const deleteNotification = (id) => {
    setNotifications((prev) => removeNotification(prev, id))
  }

  const clearAll = () => {
    setNotifications([])
  }

  const markAllRead = () => {
    setNotifications((prev) => markAllNotificationsRead(prev))
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  const renderAvatar = (type) => {
    switch (type) {
      case 'ocr':
        return <Avatar sx={{ bgcolor: 'primary.main' }}><NotificationsIcon /></Avatar>
      case 'doc':
        return <Avatar sx={{ bgcolor: 'secondary.main' }}><NotificationsIcon /></Avatar>
      default:
        return <Avatar sx={{ bgcolor: 'grey.500' }}><NotificationsIcon /></Avatar>
    }
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />

      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <TopBar
          setMobileOpen={setMobileOpen}
          notifications={notifications}
          unreadCount={unreadCount}
          notifAnchor={null}
          openNotifMenu={() => {}}
          closeNotifMenu={() => {}}
          markAllRead={markAllRead}
          profileAnchor={null}
          openProfileMenu={() => {}}
          closeProfileMenu={() => {}}
          onProfile={() => {}}
          onAccount={() => {}}
          onLogout={() => {}}
        />

        <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 3 } }}>
          <Container maxWidth="lg">
            <Box sx={{ position: 'relative' }}>
              <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <Grid item xs>
                  <Typography component="h1" variant="h4" sx={{ fontWeight: 700 }}>
                    Notifications
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Manage your notifications. Local fallback mode is automatic when API support is unavailable.
                  </Typography>
                </Grid>
                <Grid item>
                  <Button variant="outlined" color="inherit" onClick={loadNotifications} sx={{ mr: 1 }}>
                    Refresh
                  </Button>
                  <Button variant="contained" color="primary" onClick={clearAll}>
                    Clear All
                  </Button>
                </Grid>
              </Grid>

              <Divider sx={{ mb: 2 }} />

              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <Box>
                  {statusMessage && (
                    <Typography variant="body2" color="warning.main" sx={{ mb: 2 }}>
                      {statusMessage}
                    </Typography>
                  )}

                  {notifications.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 6 }}>
                      <Typography variant="h6" color="text.secondary">
                        No notifications yet
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        You will see activity and system messages here.
                      </Typography>
                    </Box>
                  ) : (
                    <List sx={{ bgcolor: 'background.paper', borderRadius: 1 }}>
                      {notifications.map((n) => (
                        <React.Fragment key={n.id}>
                          <ListItem
                            secondaryAction={(
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <IconButton edge="end" aria-label="mark-read" onClick={() => toggleRead(n.id)}>
                                  {n.read ? <MarkUnreadIcon /> : <MarkReadIcon />}
                                </IconButton>
                                <IconButton edge="end" aria-label="delete" onClick={() => deleteNotification(n.id)}>
                                  <DeleteIcon />
                                </IconButton>
                              </Box>
                            )}
                          >
                            <ListItemAvatar>{renderAvatar(n.type)}</ListItemAvatar>
                            <ListItemText
                              primary={n.text}
                              secondary={new Date(n.createdAt || Date.now()).toLocaleString()}
                              sx={{ opacity: n.read ? 0.7 : 1 }}
                            />
                          </ListItem>
                          <Divider component="li" />
                        </React.Fragment>
                      ))}
                    </List>
                  )}
                </Box>
              )}
            </Box>
          </Container>
        </Box>
      </Box>
    </Box>
  )
}
