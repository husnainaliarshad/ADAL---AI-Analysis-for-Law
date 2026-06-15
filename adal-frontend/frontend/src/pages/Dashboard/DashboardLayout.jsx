import React from 'react'
import { Box } from '@mui/material'
import Sidebar from '../../components/layout/Sidebar'
import TopBar from './components/TopBar'

/**
 * DashboardLayout
 * - Provides a responsive layout with a left Sidebar and a TopBar.
 * - Handles spacing to avoid overlap between the AppBar and the main content.
 * - Uses theme-aware spacing and smooth transitions for a polished SaaS feel.
 *
 * Props:
 * - children: main content to render inside the layout
 * - topbarProps: props forwarded to TopBar (notifications, handlers, etc.)
 */
export default function DashboardLayout({ children, topbarProps = {} }) {
  const {
    notifications,
    unreadCount,
    notifAnchor,
    openNotifMenu,
    closeNotifMenu,
    markAllRead,
    profileAnchor,
    openProfileMenu,
    closeProfileMenu,
    onProfile,
    onAccount,
    onLogout,
    onViewAllNotifications,
  } = topbarProps

  const [mobileOpen, setMobileOpen] = React.useState(false)

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Sidebar (drawer) */}
      <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Main area: TopBar + content */}
      <Box 
        sx={{ 
          flexGrow: 1, 
          display: 'flex', 
          flexDirection: 'column',
          width: '100%',
        }}
      >
        <TopBar
          setMobileOpen={setMobileOpen}
          notifications={notifications}
          unreadCount={unreadCount}
          notifAnchor={notifAnchor}
          openNotifMenu={openNotifMenu}
          closeNotifMenu={closeNotifMenu}
          markAllRead={markAllRead}
          profileAnchor={profileAnchor}
          openProfileMenu={openProfileMenu}
          closeProfileMenu={closeProfileMenu}
          onProfile={onProfile}
          onAccount={onAccount}
          onLogout={onLogout}
          onViewAllNotifications={onViewAllNotifications}
        />

        {/* Content area */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            width: '100%',
            minWidth: 0, // Prevent overflow
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  )
}
