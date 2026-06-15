import React, { useEffect, useState } from 'react'
import {
  Box,
  Grid,
  Card,
  CardContent,
  Stack,
  Typography,
  Divider,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  alpha,
  useTheme,
  IconButton,
  InputAdornment,
  Alert,
  CircularProgress,
} from '@mui/material'
import { motion as Motion } from 'framer-motion'
import DashboardLayout from './Dashboard/DashboardLayout'
import authApi from '../api/authApi'
import PersonIcon from '@mui/icons-material/Person'
import SecurityIcon from '@mui/icons-material/Security'
import NotificationsIcon from '@mui/icons-material/Notifications'
import PaletteIcon from '@mui/icons-material/Palette'
import WarningIcon from '@mui/icons-material/Warning'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import SaveIcon from '@mui/icons-material/Save'
import CancelIcon from '@mui/icons-material/Cancel'
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'
import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import TwoFactorAuthIcon from '@mui/icons-material/VerifiedUser'
import LanguageIcon from '@mui/icons-material/Language'
import PrivacyTipIcon from '@mui/icons-material/PrivacyTip'
import DownloadIcon from '@mui/icons-material/Download'
import VpnKeyIcon from '@mui/icons-material/VpnKey'
import HistoryIcon from '@mui/icons-material/History'
import ComputerIcon from '@mui/icons-material/Computer'
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid'
import TabletIcon from '@mui/icons-material/Tablet'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import AtlasButton from '../components/common/AtlasButton'
import { getApiErrorMessage } from '../utils/errorMessage'
import logger from '../utils/logger'
import { getProfileAvatarSrc } from '../utils/profileAvatar'

// SettingsPage
// A modern, responsive settings page following the project's MUI theme and layout language.
// Uses dummy local state for now; wire API calls later.

export default function SettingsPage() {
  const theme = useTheme()
  // User profile state
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [user, setUser] = useState(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [emailNotif, setEmailNotif] = useState(true)
  const [pushNotif, setPushNotif] = useState(false)
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [profileError, setProfileError] = useState(null)
  const [passwordError, setPasswordError] = useState(null)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [language, setLanguage] = useState('en')
  const [timezone, setTimezone] = useState('UTC')
  const [dataSharing, setDataSharing] = useState(true)
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true)
  const [marketingEmails, setMarketingEmails] = useState(false)
  const [productUpdates, setProductUpdates] = useState(true)
  const [securityAlerts, setSecurityAlerts] = useState(true)

  // Fetch user profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoadingProfile(true)
        setProfileError(null)
        const res = await authApi.getProfile()
        const userData = res?.data || res
        setUser(userData)
        // Populate form fields
        setName(userData.first_name && userData.last_name 
          ? `${userData.first_name} ${userData.last_name}` 
          : userData.first_name || userData.last_name || userData.username || '')
        setEmail(userData.email || '')
      } catch (err) {
        logger.error('Failed to fetch user profile:', err)
        setProfileError('Failed to load profile. Please refresh the page.')
      } finally {
        setLoadingProfile(false)
      }
    }
    fetchProfile()
  }, [])

  useEffect(() => {
    document.title = 'Settings | ADAL'
  }, [])

  const onSaveProfile = async () => {
    try {
      setProfileError(null)
      setProfileSuccess(false)
      
      // Parse name into first_name and last_name
      const nameParts = name.trim().split(' ')
      const first_name = nameParts[0] || null
      const last_name = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null
      
      const updateData = {
        email: email.trim(),
        first_name,
        last_name,
      }
      
      await authApi.updateProfile(updateData)
      
      // Update local user state
      setUser(prev => ({
        ...prev,
        ...updateData,
      }))
      
      setProfileSuccess(true)
      setTimeout(() => setProfileSuccess(false), 3000)
    } catch (err) {
      logger.error('[Settings] Save profile error:', err)
      const errorMsg = getApiErrorMessage(err, 'Failed to update profile')
      setProfileError(errorMsg)
    }
  }

  const onChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }
    
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long')
      return
    }
    
    try {
      setPasswordError(null)
      setPasswordSuccess(false)
      
      await authApi.changePassword({
        currentPassword: oldPassword,
        newPassword: newPassword,
      })
      
      // Clear password fields
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      
      setPasswordSuccess(true)
      setTimeout(() => setPasswordSuccess(false), 3000)
    } catch (err) {
      logger.error('[Settings] Change password error:', err)
      const errorMsg = getApiErrorMessage(err, 'Failed to change password')
      setPasswordError(errorMsg)
    }
  }

  const onDeleteAccount = () => {
    logger.warn('[Settings] Delete account clicked')
    // TODO: Add confirmation dialog
  }

  const onExportData = () => {
    logger.debug('[Settings] Export data clicked')
    // TODO: Implement data export
  }

  const onRevokeSession = (sessionId) => {
    logger.debug('[Settings] Revoke session', sessionId)
    // TODO: Implement session revocation
  }

  const handleAvatarUpload = (event) => {
    const file = event.target.files[0]
    if (file) {
      logger.debug('[Settings] Avatar upload', file)
      // TODO: Implement avatar upload
    }
  }

  // Helper to get initials for avatar
  const getInitials = () => {
    if (!user) return 'U'
    if (user.first_name && user.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    }
    if (user.first_name) return user.first_name[0].toUpperCase()
    if (user.last_name) return user.last_name[0].toUpperCase()
    if (user.username) return user.username[0].toUpperCase()
    if (user.email) return user.email[0].toUpperCase()
    return 'U'
  }
  const avatarSrc = getProfileAvatarSrc(user)

  // Mock active sessions data
  const activeSessions = [
    { id: '1', device: 'Windows PC', location: 'New York, USA', lastActive: '2 hours ago', current: true, iconType: 'computer' },
    { id: '2', device: 'iPhone 13', location: 'New York, USA', lastActive: '1 day ago', current: false, iconType: 'phone' },
    { id: '3', device: 'iPad Pro', location: 'Boston, USA', lastActive: '3 days ago', current: false, iconType: 'tablet' },
  ]

  const getSessionIcon = (iconType) => {
    switch (iconType) {
      case 'computer':
        return <ComputerIcon />
      case 'phone':
        return <PhoneAndroidIcon />
      case 'tablet':
        return <TabletIcon />
      default:
        return <ComputerIcon />
    }
  }

  const recentActivity = [
    { action: 'Password changed', time: '2 hours ago', type: 'security' },
    { action: 'Profile updated', time: '1 day ago', type: 'profile' },
    { action: 'Email notification enabled', time: '2 days ago', type: 'settings' },
    { action: 'Login from new device', time: '3 days ago', type: 'security' },
  ]

  return (
    <DashboardLayout topbarProps={{ notifications: [], unreadCount: 0 }}>
      <Box
        sx={{
          width: '100%',
          maxWidth: '1400px',
          mx: 'auto',
          py: { xs: 3, md: 4 },
          px: { xs: 2, sm: 3, md: 4 },
          bgcolor: 'background.default',
          minHeight: 'calc(100vh - var(--adal-topbar-offset, 64px))',
        }}
      >
        {/* Header */}
        <Motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Box sx={{ mb: 5 }}>
            <Typography
              component="h1"
              variant="h4"
              sx={{
                fontWeight: 700,
                mb: 1.5,
                fontSize: { xs: '1.75rem', md: '2.25rem' },
                background: `linear-gradient(120deg, ${theme.palette.text.primary} 0%, ${alpha(
                  theme.palette.success.main,
                  0.85
                )} 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Settings
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ fontSize: { xs: '0.95rem', md: '1rem' } }}>
              Manage your profile, security, notifications, and appearance preferences.
            </Typography>
          </Box>
        </Motion.div>

        {/* Account & Profile Section */}
        <Box sx={{ mb: 5 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              mb: 3,
              fontSize: { xs: '1rem', md: '1.1rem' },
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Account & Profile
          </Typography>
          <Grid container spacing={3}>
          {/* Profile Information */}
          <Grid item xs={12} md={6}>
            <Motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <Card
                sx={{
                  borderRadius: 2,
                  border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
                  boxShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.08)}`,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: `0 4px 16px ${alpha(theme.palette.success.main, 0.15)}`,
                  },
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: `linear-gradient(90deg, ${theme.palette.success.main} 0%, ${alpha(theme.palette.success.main, 0.5)} 100%)`,
                  },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 1.5,
                        bgcolor: alpha(theme.palette.success.main, 0.1),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <PersonIcon sx={{ color: theme.palette.success.main, fontSize: 24 }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.25rem' }}>
                      Profile Information
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 3, borderColor: alpha(theme.palette.divider, 0.08) }} />
                  {loadingProfile && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                      <CircularProgress size={32} sx={{ color: theme.palette.success.main }} />
                    </Box>
                  )}
                  {profileError && (
                    <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5 }} onClose={() => setProfileError(null)}>
                      {profileError}
                    </Alert>
                  )}
                  {profileSuccess && (
                    <Alert severity="success" sx={{ mb: 2, borderRadius: 1.5 }}>
                      Profile updated successfully!
                    </Alert>
                  )}
                  {!loadingProfile && (
                    <Stack spacing={2.5}>
                      {/* Avatar Upload */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                        <Avatar
                          src={avatarSrc || undefined}
                          sx={{
                            width: 80,
                            height: 80,
                            bgcolor: theme.palette.success.main,
                            fontSize: '2rem',
                            fontWeight: 700,
                          }}
                        >
                          {user ? getInitials() : (name ? name.charAt(0).toUpperCase() : 'U')}
                        </Avatar>
                      <Box>
                        <input
                          accept="image/*"
                          style={{ display: 'none' }}
                          id="avatar-upload"
                          type="file"
                          onChange={handleAvatarUpload}
                        />
                        <label htmlFor="avatar-upload">
                          <Button
                            component="span"
                            variant="outlined"
                            startIcon={<CloudUploadIcon />}
                            sx={{
                              borderColor: alpha(theme.palette.divider, 0.3),
                              color: 'text.secondary',
                              textTransform: 'none',
                            }}
                          >
                            Upload Photo
                          </Button>
                        </label>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                          JPG, PNG or GIF. Max size 2MB
                        </Typography>
                      </Box>
                    </Box>
                    <TextField
                      label="Full Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      fullWidth
                      placeholder="Enter your full name"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: alpha(theme.palette.background.default, 0.5),
                          '&:hover': {
                            bgcolor: alpha(theme.palette.background.default, 0.7),
                          },
                          '&.Mui-focused': {
                            bgcolor: alpha(theme.palette.background.default, 0.7),
                          },
                        },
                      }}
                    />
                    <TextField
                      label="Email Address"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      fullWidth
                      placeholder="your.email@example.com"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: alpha(theme.palette.background.default, 0.5),
                          '&:hover': {
                            bgcolor: alpha(theme.palette.background.default, 0.7),
                          },
                          '&.Mui-focused': {
                            bgcolor: alpha(theme.palette.background.default, 0.7),
                          },
                        },
                      }}
                    />
                    <Stack direction="row" spacing={1.5} sx={{ mt: 1 }}>
                      <AtlasButton
                        variant="contained"
                        onClick={onSaveProfile}
                        startIcon={<SaveIcon />}
                        sx={{
                          bgcolor: theme.palette.success.main,
                          '&:hover': { bgcolor: theme.palette.success.dark },
                        }}
                      >
                        Save Changes
                      </AtlasButton>
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setName('')
                          setEmail('')
                        }}
                        startIcon={<CancelIcon />}
                        sx={{
                          borderColor: alpha(theme.palette.divider, 0.3),
                          color: 'text.secondary',
                        }}
                      >
                        Cancel
                      </Button>
                    </Stack>
                  </Stack>
                  )}
                </CardContent>
              </Card>
            </Motion.div>
          </Grid>
          </Grid>
        </Box>

        {/* Security & Authentication Section */}
        <Box sx={{ mb: 5 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              mb: 3,
              fontSize: { xs: '1rem', md: '1.1rem' },
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Security & Authentication
          </Typography>
          <Grid container spacing={3}>
            {/* Account Security */}
            <Grid item xs={12} md={6}>
            <Motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <Card
                sx={{
                  borderRadius: 2,
                  border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
                  boxShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.08)}`,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: `0 4px 16px ${alpha(theme.palette.success.main, 0.15)}`,
                  },
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: `linear-gradient(90deg, ${theme.palette.success.main} 0%, ${alpha(theme.palette.success.main, 0.5)} 100%)`,
                  },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 1.5,
                        bgcolor: alpha(theme.palette.success.main, 0.1),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <SecurityIcon sx={{ color: theme.palette.success.main, fontSize: 24 }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.25rem' }}>
                      Account Security
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 3, borderColor: alpha(theme.palette.divider, 0.08) }} />
                  {passwordError && (
                    <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5 }} onClose={() => setPasswordError(null)}>
                      {passwordError}
                    </Alert>
                  )}
                  {passwordSuccess && (
                    <Alert severity="success" sx={{ mb: 2, borderRadius: 1.5 }}>
                      Password updated successfully!
                    </Alert>
                  )}
                  <Stack spacing={2.5}>
                    <TextField
                      label="Current Password"
                      type={showOldPassword ? 'text' : 'password'}
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      fullWidth
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowOldPassword(!showOldPassword)}
                              edge="end"
                              sx={{ color: 'text.secondary' }}
                            >
                              {showOldPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: alpha(theme.palette.background.default, 0.5),
                          '&:hover': {
                            bgcolor: alpha(theme.palette.background.default, 0.7),
                          },
                          '&.Mui-focused': {
                            bgcolor: alpha(theme.palette.background.default, 0.7),
                          },
                        },
                      }}
                    />
                    <TextField
                      label="New Password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      fullWidth
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              edge="end"
                              sx={{ color: 'text.secondary' }}
                            >
                              {showNewPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: alpha(theme.palette.background.default, 0.5),
                          '&:hover': {
                            bgcolor: alpha(theme.palette.background.default, 0.7),
                          },
                          '&.Mui-focused': {
                            bgcolor: alpha(theme.palette.background.default, 0.7),
                          },
                        },
                      }}
                    />
                    <TextField
                      label="Confirm New Password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      fullWidth
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              edge="end"
                              sx={{ color: 'text.secondary' }}
                            >
                              {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: alpha(theme.palette.background.default, 0.5),
                          '&:hover': {
                            bgcolor: alpha(theme.palette.background.default, 0.7),
                          },
                          '&.Mui-focused': {
                            bgcolor: alpha(theme.palette.background.default, 0.7),
                          },
                        },
                      }}
                    />
                    <AtlasButton
                      variant="contained"
                      onClick={onChangePassword}
                      startIcon={<SecurityIcon />}
                      disabled={!oldPassword || !newPassword || !confirmPassword}
                      sx={{
                        bgcolor: theme.palette.success.main,
                        '&:hover': { bgcolor: theme.palette.success.dark },
                        mt: 1,
                      }}
                    >
                      Update Password
                    </AtlasButton>
                  </Stack>
                </CardContent>
              </Card>
            </Motion.div>
          </Grid>

          {/* Two-Factor Authentication */}
          <Grid item xs={12} md={6}>
            <Motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.25 }}
            >
              <Card
                sx={{
                  borderRadius: 2,
                  border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
                  boxShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.08)}`,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: `0 4px 16px ${alpha(theme.palette.success.main, 0.15)}`,
                  },
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: `linear-gradient(90deg, ${theme.palette.success.main} 0%, ${alpha(theme.palette.success.main, 0.5)} 100%)`,
                  },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 1.5,
                        bgcolor: alpha(theme.palette.success.main, 0.1),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <TwoFactorAuthIcon sx={{ color: theme.palette.success.main, fontSize: 24 }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.25rem' }}>
                      Two-Factor Authentication
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 3, borderColor: alpha(theme.palette.divider, 0.08) }} />
                  <Stack spacing={2.5}>
                    <Box>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={twoFactorEnabled}
                            onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                            sx={{
                              '& .MuiSwitch-switchBase.Mui-checked': {
                                color: theme.palette.success.main,
                              },
                              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                backgroundColor: theme.palette.success.main,
                              },
                            }}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                              Enable 2FA
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Add an extra layer of security to your account
                            </Typography>
                          </Box>
                        }
                        sx={{ m: 0 }}
                      />
                    </Box>
                    {twoFactorEnabled && (
                      <Alert severity="info" sx={{ borderRadius: 1.5 }}>
                        Scan the QR code with your authenticator app to complete setup.
                      </Alert>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Motion.div>
            </Grid>

            {/* Active Sessions */}
            <Grid item xs={12} md={6}>
            <Motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <Card
                sx={{
                  borderRadius: 2,
                  border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
                  boxShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.08)}`,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: `0 4px 16px ${alpha(theme.palette.success.main, 0.15)}`,
                  },
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: `linear-gradient(90deg, ${theme.palette.success.main} 0%, ${alpha(theme.palette.success.main, 0.5)} 100%)`,
                  },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 1.5,
                        bgcolor: alpha(theme.palette.success.main, 0.1),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <ComputerIcon sx={{ color: theme.palette.success.main, fontSize: 24 }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.25rem' }}>
                      Active Sessions
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 3, borderColor: alpha(theme.palette.divider, 0.08) }} />
                  <List sx={{ p: 0 }}>
                    {activeSessions.map((session) => (
                      <ListItem
                        key={session.id}
                        sx={{
                          px: 0,
                          py: 1.5,
                          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                          '&:last-child': { borderBottom: 'none' },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                          <Box
                            sx={{
                              p: 1,
                              borderRadius: 1,
                              bgcolor: alpha(theme.palette.success.main, 0.1),
                              color: theme.palette.success.main,
                            }}
                          >
                            {getSessionIcon(session.iconType)}
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                              {session.device}
                              {session.current && (
                                <Chip
                                  label="Current"
                                  size="small"
                                  sx={{
                                    ml: 1,
                                    height: 20,
                                    fontSize: '0.7rem',
                                    bgcolor: alpha(theme.palette.success.main, 0.1),
                                    color: theme.palette.success.main,
                                    fontWeight: 600,
                                  }}
                                />
                              )}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {session.location} • {session.lastActive}
                            </Typography>
                          </Box>
                        </Box>
                        <ListItemSecondaryAction>
                          {!session.current && (
                            <Button
                              size="small"
                              onClick={() => onRevokeSession(session.id)}
                              sx={{
                                color: theme.palette.error.main,
                                textTransform: 'none',
                                fontSize: '0.75rem',
                              }}
                            >
                              Revoke
                            </Button>
                          )}
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Motion.div>
            </Grid>
          </Grid>
        </Box>

        {/* Preferences & Notifications Section */}
        <Box sx={{ mb: 5 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              mb: 3,
              fontSize: { xs: '1rem', md: '1.1rem' },
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Preferences & Notifications
          </Typography>
          <Grid container spacing={3}>
            {/* Notifications */}
            <Grid item xs={12} md={6}>
            <Motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <Card
                sx={{
                  borderRadius: 2,
                  border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
                  boxShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.08)}`,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: `0 4px 16px ${alpha(theme.palette.success.main, 0.15)}`,
                  },
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: `linear-gradient(90deg, ${theme.palette.success.main} 0%, ${alpha(theme.palette.success.main, 0.5)} 100%)`,
                  },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 1.5,
                        bgcolor: alpha(theme.palette.success.main, 0.1),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <NotificationsIcon sx={{ color: theme.palette.success.main, fontSize: 24 }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.25rem' }}>
                      Notifications
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 3, borderColor: alpha(theme.palette.divider, 0.08) }} />
                  <Stack spacing={2.5}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={emailNotif}
                          onChange={(e) => setEmailNotif(e.target.checked)}
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': {
                              color: theme.palette.success.main,
                            },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                              backgroundColor: theme.palette.success.main,
                            },
                          }}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            Email notifications
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Receive updates via email
                          </Typography>
                        </Box>
                      }
                      sx={{ m: 0 }}
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={pushNotif}
                          onChange={(e) => setPushNotif(e.target.checked)}
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': {
                              color: theme.palette.success.main,
                            },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                              backgroundColor: theme.palette.success.main,
                            },
                          }}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            Push notifications
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Receive browser push notifications
                          </Typography>
                        </Box>
                      }
                      sx={{ m: 0 }}
                    />
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary', mb: 1 }}>
                      Email Preferences
                    </Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={marketingEmails}
                          onChange={(e) => setMarketingEmails(e.target.checked)}
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': {
                              color: theme.palette.success.main,
                            },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                              backgroundColor: theme.palette.success.main,
                            },
                          }}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            Marketing emails
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Receive promotional and marketing emails
                          </Typography>
                        </Box>
                      }
                      sx={{ m: 0 }}
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={productUpdates}
                          onChange={(e) => setProductUpdates(e.target.checked)}
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': {
                              color: theme.palette.success.main,
                            },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                              backgroundColor: theme.palette.success.main,
                            },
                          }}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            Product updates
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Get notified about new features and updates
                          </Typography>
                        </Box>
                      }
                      sx={{ m: 0 }}
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={securityAlerts}
                          onChange={(e) => setSecurityAlerts(e.target.checked)}
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': {
                              color: theme.palette.success.main,
                            },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                              backgroundColor: theme.palette.success.main,
                            },
                          }}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            Security alerts
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Important security notifications (recommended)
                          </Typography>
                        </Box>
                      }
                      sx={{ m: 0 }}
                    />
                  </Stack>
                </CardContent>
              </Card>
            </Motion.div>
            </Grid>

            {/* Appearance */}
            <Grid item xs={12} md={6}>
            <Motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
            >
              <Card
                sx={{
                  borderRadius: 2,
                  border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
                  boxShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.08)}`,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: `0 4px 16px ${alpha(theme.palette.success.main, 0.15)}`,
                  },
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: `linear-gradient(90deg, ${theme.palette.success.main} 0%, ${alpha(theme.palette.success.main, 0.5)} 100%)`,
                  },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 1.5,
                        bgcolor: alpha(theme.palette.success.main, 0.1),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <PaletteIcon sx={{ color: theme.palette.success.main, fontSize: 24 }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.25rem' }}>
                      Appearance
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 3, borderColor: alpha(theme.palette.divider, 0.08) }} />
                  <Stack spacing={3}>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                      Toggle dark/light mode using the theme switch in the top bar.
                    </Typography>
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, color: 'text.secondary' }}>
                        Theme Colors
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item>
                          <Stack spacing={1} alignItems="center">
                            <Box
                              sx={{
                                width: 64,
                                height: 40,
                                borderRadius: 1.5,
                                bgcolor: theme.palette.success.main,
                                boxShadow: `0 2px 8px ${alpha(theme.palette.success.main, 0.3)}`,
                                transition: 'transform 0.2s ease',
                                '&:hover': { transform: 'scale(1.05)' },
                              }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                              Success
                            </Typography>
                          </Stack>
                        </Grid>
                        <Grid item>
                          <Stack spacing={1} alignItems="center">
                            <Box
                              sx={{
                                width: 64,
                                height: 40,
                                borderRadius: 1.5,
                                bgcolor: 'background.paper',
                                border: `2px solid ${alpha(theme.palette.divider, 0.3)}`,
                                transition: 'transform 0.2s ease',
                                '&:hover': { transform: 'scale(1.05)' },
                              }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                              Surface
                            </Typography>
                          </Stack>
                        </Grid>
                      </Grid>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Motion.div>
            </Grid>

            {/* Language & Region */}
            <Grid item xs={12} md={6}>
            <Motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.35 }}
            >
              <Card
                sx={{
                  borderRadius: 2,
                  border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
                  boxShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.08)}`,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: `0 4px 16px ${alpha(theme.palette.success.main, 0.15)}`,
                  },
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: `linear-gradient(90deg, ${theme.palette.success.main} 0%, ${alpha(theme.palette.success.main, 0.5)} 100%)`,
                  },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 1.5,
                        bgcolor: alpha(theme.palette.success.main, 0.1),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <LanguageIcon sx={{ color: theme.palette.success.main, fontSize: 24 }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.25rem' }}>
                      Language & Region
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 3, borderColor: alpha(theme.palette.divider, 0.08) }} />
                  <Stack spacing={2.5}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.secondary' }}>
                        Language
                      </Typography>
                      <Select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        fullWidth
                        sx={{
                          bgcolor: alpha(theme.palette.background.default, 0.5),
                          '&:hover': {
                            bgcolor: alpha(theme.palette.background.default, 0.7),
                          },
                          '&.Mui-focused': {
                            bgcolor: alpha(theme.palette.background.default, 0.7),
                          },
                        }}
                      >
                        <MenuItem value="en">English</MenuItem>
                        <MenuItem value="es">Spanish</MenuItem>
                        <MenuItem value="fr">French</MenuItem>
                        <MenuItem value="de">German</MenuItem>
                        <MenuItem value="zh">Chinese</MenuItem>
                      </Select>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.secondary' }}>
                        Timezone
                      </Typography>
                      <Select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        fullWidth
                        sx={{
                          bgcolor: alpha(theme.palette.background.default, 0.5),
                          '&:hover': {
                            bgcolor: alpha(theme.palette.background.default, 0.7),
                          },
                          '&.Mui-focused': {
                            bgcolor: alpha(theme.palette.background.default, 0.7),
                          },
                        }}
                      >
                        <MenuItem value="UTC">UTC (Coordinated Universal Time)</MenuItem>
                        <MenuItem value="EST">EST (Eastern Standard Time)</MenuItem>
                        <MenuItem value="PST">PST (Pacific Standard Time)</MenuItem>
                        <MenuItem value="GMT">GMT (Greenwich Mean Time)</MenuItem>
                        <MenuItem value="CET">CET (Central European Time)</MenuItem>
                      </Select>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Motion.div>
            </Grid>
          </Grid>
        </Box>

        {/* Privacy & Data Section */}
        <Box sx={{ mb: 5 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              mb: 3,
              fontSize: { xs: '1rem', md: '1.1rem' },
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Privacy & Data
          </Typography>
          <Grid container spacing={3}>
            {/* Privacy Settings */}
            <Grid item xs={12} md={6}>
              <Motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
              >
              <Card
                sx={{
                  borderRadius: 2,
                  border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
                  boxShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.08)}`,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: `0 4px 16px ${alpha(theme.palette.success.main, 0.15)}`,
                  },
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: `linear-gradient(90deg, ${theme.palette.success.main} 0%, ${alpha(theme.palette.success.main, 0.5)} 100%)`,
                  },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 1.5,
                        bgcolor: alpha(theme.palette.success.main, 0.1),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <PrivacyTipIcon sx={{ color: theme.palette.success.main, fontSize: 24 }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.25rem' }}>
                      Privacy Settings
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 3, borderColor: alpha(theme.palette.divider, 0.08) }} />
                  <Stack spacing={2.5}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={dataSharing}
                          onChange={(e) => setDataSharing(e.target.checked)}
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': {
                              color: theme.palette.success.main,
                            },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                              backgroundColor: theme.palette.success.main,
                            },
                          }}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            Data sharing
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Allow sharing anonymized usage data to improve our services
                          </Typography>
                        </Box>
                      }
                      sx={{ m: 0 }}
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={analyticsEnabled}
                          onChange={(e) => setAnalyticsEnabled(e.target.checked)}
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': {
                              color: theme.palette.success.main,
                            },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                              backgroundColor: theme.palette.success.main,
                            },
                          }}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            Analytics
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Help us understand how you use ADAL
                          </Typography>
                        </Box>
                      }
                      sx={{ m: 0 }}
                    />
                  </Stack>
                </CardContent>
              </Card>
            </Motion.div>
            </Grid>

            {/* Data Export & API */}
            <Grid item xs={12} md={6}>
            <Motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.45 }}
            >
              <Card
                sx={{
                  borderRadius: 2,
                  border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
                  boxShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.08)}`,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: `0 4px 16px ${alpha(theme.palette.success.main, 0.15)}`,
                  },
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: `linear-gradient(90deg, ${theme.palette.success.main} 0%, ${alpha(theme.palette.success.main, 0.5)} 100%)`,
                  },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 1.5,
                        bgcolor: alpha(theme.palette.success.main, 0.1),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <DownloadIcon sx={{ color: theme.palette.success.main, fontSize: 24 }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.25rem' }}>
                      Data & API
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 3, borderColor: alpha(theme.palette.divider, 0.08) }} />
                  <Stack spacing={2.5}>
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                        Export Your Data
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Download a copy of your account data including documents, settings, and activity history.
                      </Typography>
                      <AtlasButton
                        variant="outlined"
                        onClick={onExportData}
                        startIcon={<DownloadIcon />}
                        sx={{
                          borderColor: alpha(theme.palette.success.main, 0.5),
                          color: theme.palette.success.main,
                          '&:hover': {
                            borderColor: theme.palette.success.main,
                            bgcolor: alpha(theme.palette.success.main, 0.1),
                          },
                        }}
                      >
                        Export Data
                      </AtlasButton>
                    </Box>
                    <Divider />
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <VpnKeyIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          API Keys
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Manage your API keys for programmatic access to ADAL services.
                      </Typography>
                      <Button
                        variant="outlined"
                        startIcon={<VpnKeyIcon />}
                        sx={{
                          borderColor: alpha(theme.palette.divider, 0.3),
                          color: 'text.secondary',
                          textTransform: 'none',
                        }}
                      >
                        Manage API Keys
                      </Button>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Motion.div>
            </Grid>
          </Grid>
        </Box>

        {/* Activity & History Section */}
        <Box sx={{ mb: 5 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              mb: 3,
              fontSize: { xs: '1rem', md: '1.1rem' },
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Activity & History
          </Typography>
          <Grid container spacing={3}>
            {/* Activity Log */}
            <Grid item xs={12}>
            <Motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}
            >
              <Card
                sx={{
                  borderRadius: 2,
                  border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
                  boxShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.08)}`,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: `0 4px 16px ${alpha(theme.palette.success.main, 0.15)}`,
                  },
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: `linear-gradient(90deg, ${theme.palette.success.main} 0%, ${alpha(theme.palette.success.main, 0.5)} 100%)`,
                  },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 1.5,
                        bgcolor: alpha(theme.palette.success.main, 0.1),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <HistoryIcon sx={{ color: theme.palette.success.main, fontSize: 24 }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.25rem' }}>
                      Recent Activity
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 3, borderColor: alpha(theme.palette.divider, 0.08) }} />
                  <List sx={{ p: 0 }}>
                    {recentActivity.map((activity, index) => (
                      <ListItem
                        key={index}
                        sx={{
                          px: 0,
                          py: 1.5,
                          borderBottom: index < recentActivity.length - 1 ? `1px solid ${alpha(theme.palette.divider, 0.08)}` : 'none',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                          <Box
                            sx={{
                              p: 0.75,
                              borderRadius: 1,
                              bgcolor:
                                activity.type === 'security'
                                  ? alpha(theme.palette.error.main, 0.1)
                                  : activity.type === 'profile'
                                  ? alpha(theme.palette.success.main, 0.1)
                                  : alpha(theme.palette.info.main, 0.1),
                              color:
                                activity.type === 'security'
                                  ? theme.palette.error.main
                                  : activity.type === 'profile'
                                  ? theme.palette.success.main
                                  : theme.palette.info.main,
                            }}
                          >
                            {activity.type === 'security' ? (
                              <SecurityIcon sx={{ fontSize: 18 }} />
                            ) : activity.type === 'profile' ? (
                              <PersonIcon sx={{ fontSize: 18 }} />
                            ) : (
                              <NotificationsIcon sx={{ fontSize: 18 }} />
                            )}
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {activity.action}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {activity.time}
                            </Typography>
                          </Box>
                        </Box>
                      </ListItem>
                    ))}
                  </List>
                  <Button
                    fullWidth
                    variant="text"
                    sx={{
                      mt: 2,
                      textTransform: 'none',
                      color: theme.palette.success.main,
                      '&:hover': {
                        bgcolor: alpha(theme.palette.success.main, 0.1),
                      },
                    }}
                  >
                    View All Activity
                  </Button>
                </CardContent>
              </Card>
            </Motion.div>
            </Grid>
          </Grid>
        </Box>

        {/* Danger Zone Section */}
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              mb: 3,
              fontSize: { xs: '1rem', md: '1.1rem' },
              color: 'error.main',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Danger Zone
          </Typography>
          <Grid container spacing={3}>
            {/* Danger Zone */}
            <Grid item xs={12}>
            <Motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}
            >
              <Card
                sx={{
                  borderRadius: 2,
                  border: `2px solid ${alpha(theme.palette.error.main, 0.3)}`,
                  bgcolor: alpha(theme.palette.error.main, 0.05),
                  boxShadow: `0 2px 8px ${alpha(theme.palette.error.main, 0.1)}`,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    borderColor: alpha(theme.palette.error.main, 0.5),
                    boxShadow: `0 4px 16px ${alpha(theme.palette.error.main, 0.2)}`,
                  },
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: `linear-gradient(90deg, ${theme.palette.error.main} 0%, ${alpha(theme.palette.error.main, 0.5)} 100%)`,
                  },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 1.5,
                        bgcolor: alpha(theme.palette.error.main, 0.1),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <WarningIcon sx={{ color: theme.palette.error.main, fontSize: 24 }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.25rem', color: 'error.main' }}>
                      Danger Zone
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 3, borderColor: alpha(theme.palette.error.main, 0.2) }} />
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={2}
                    justifyContent="space-between"
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                        Delete Account
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                        Permanently delete your account and all associated data. This action cannot be undone.
                      </Typography>
                    </Box>
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={onDeleteAccount}
                      startIcon={<DeleteForeverIcon />}
                      disabled
                      sx={{
                        borderWidth: 2,
                        '&:hover': {
                          borderWidth: 2,
                          bgcolor: alpha(theme.palette.error.main, 0.1),
                        },
                      }}
                    >
                      Delete Account
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Motion.div>
            </Grid>
          </Grid>
        </Box>
      </Box>
    </DashboardLayout>
  )
}
