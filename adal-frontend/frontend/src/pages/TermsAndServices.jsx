import React, { useEffect } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Divider,
  alpha,
  useTheme,
  IconButton,
  Tooltip,
  Stack,
  Chip,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { motion as Motion } from 'framer-motion'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DescriptionIcon from '@mui/icons-material/Description'
import GavelIcon from '@mui/icons-material/Gavel'
import SecurityIcon from '@mui/icons-material/Security'
import CopyrightIcon from '@mui/icons-material/Copyright'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import WarningIcon from '@mui/icons-material/Warning'
import ContactMailIcon from '@mui/icons-material/ContactMail'
import DashboardLayout from './Dashboard/DashboardLayout'

const TermsAndServices = () => {
  const theme = useTheme()
  const navigate = useNavigate()

  useEffect(() => {
    document.title = 'Terms & Services | ADAL'
  }, [])

  const sections = [
    {
      id: 'introduction',
      title: '1. Introduction',
      icon: <DescriptionIcon />,
      content:
        'Welcome to ADAL. These Terms & Services govern your access to and use of our platform, products, and services ("Services"). By accessing or using the Services, you agree to be bound by these terms. If you do not agree, do not use our Services.',
    },
    {
      id: 'user-obligations',
      title: '2. User Obligations',
      icon: <SecurityIcon />,
      content:
        'You must provide accurate information when creating an account and keep your credentials secure. You agree not to use the Services for unlawful activities, to attempt to gain unauthorized access to our systems, or to interfere with the operation of the Services. You are responsible for all activity that occurs under your account.',
    },
    {
      id: 'intellectual-property',
      title: '3. Intellectual Property',
      icon: <CopyrightIcon />,
      content:
        'All content, trademarks, logos, and software provided by ADAL are the intellectual property of ADAL or our licensors. Nothing in these Terms grants you any rights to our intellectual property except as expressly provided for the limited purpose of using the Services.',
    },
    {
      id: 'data-privacy',
      title: '4. Data Privacy',
      icon: <SecurityIcon />,
      content:
        'We process and store user data in accordance with our Privacy Policy. We implement commercially reasonable technical and organizational measures to protect user data. To the extent required by law, users retain ownership of their data and can request access, correction, or deletion subject to legal requirements.',
    },
    {
      id: 'limitations',
      title: '5. Limitations of Liability',
      icon: <WarningIcon />,
      content:
        'To the maximum extent permitted by law, ADAL and its affiliates will not be liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, revenue, data, or use. Our total aggregate liability arising out of or related to these Terms will not exceed the amount paid by you to ADAL in the twelve (12) months preceding the claim, or one hundred US dollars (USD 100), whichever is greater.',
    },
    {
      id: 'governing-law',
      title: '6. Governing Law',
      icon: <AccountBalanceIcon />,
      content:
        'These Terms are governed by and construed in accordance with the laws of the jurisdiction in which ADAL is established, without regard to conflict of law principles. Any disputes arising from these Terms will be subject to the exclusive jurisdiction of the courts located in that jurisdiction.',
    },
    {
      id: 'contact-info',
      title: '7. Contact Information',
      icon: <ContactMailIcon />,
      content:
        'For questions about these Terms, please contact our legal team at legal@adal.example or visit our support center through the application. We will endeavor to respond to inquiries promptly.',
    },
  ]

  return (
    <DashboardLayout topbarProps={{ notifications: [], unreadCount: 0 }}>
      <Box
        sx={{
          width: '100%',
          maxWidth: '1200px',
          mx: 'auto',
          py: { xs: 3, md: 4 },
          px: { xs: 2, sm: 3, md: 4 },
          bgcolor: 'background.default',
          minHeight: 'calc(100vh - var(--adal-topbar-offset, 64px))',
        }}
      >
        {/* Back Button */}
        <Motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Tooltip title="Go back">
            <IconButton
              onClick={() => navigate(-1)}
              sx={{
                mb: 3,
                color: 'text.secondary',
                border: `1px solid ${alpha(theme.palette.divider, 0.25)}`,
                transition: 'all 0.2s ease',
                '&:hover': {
                  color: theme.palette.success.main,
                  borderColor: theme.palette.success.main,
                  bgcolor: alpha(theme.palette.success.main, 0.08),
                  transform: 'translateX(-4px)',
                },
              }}
            >
              <ArrowBackIcon />
            </IconButton>
          </Tooltip>
        </Motion.div>

        {/* Header Section */}
        <Motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card
            elevation={0}
            sx={{
              mb: 4,
              background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.05)} 0%, ${alpha(
                theme.palette.background.paper,
                0.8
              )} 100%)`,
              border: `1px solid ${alpha(theme.palette.success.main, 0.1)}`,
              borderRadius: 2,
              boxShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.08)}`,
            }}
          >
            <CardContent sx={{ p: { xs: 3, md: 4 }, textAlign: 'center' }}>
              <Stack spacing={2} alignItems="center">
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.success.main, 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <GavelIcon sx={{ fontSize: 40, color: theme.palette.success.main }} />
                </Box>
                <Box>
                  <Typography
                    component="h1"
                    variant="h4"
                    sx={{
                      fontWeight: 700,
                      mb: 1,
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
                    Terms & Services
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ fontSize: { xs: '0.95rem', md: '1rem' } }}>
                    Legal terms governing your use of ADAL services
                  </Typography>
                </Box>
                <Chip
                  label="Last Updated: January 2025"
                  size="small"
                  sx={{
                    bgcolor: alpha(theme.palette.success.main, 0.1),
                    color: theme.palette.success.main,
                    fontWeight: 600,
                  }}
                />
              </Stack>
            </CardContent>
          </Card>
        </Motion.div>

        {/* Main Content Card */}
        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card
            elevation={0}
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
                background: `linear-gradient(90deg, ${theme.palette.success.main} 0%, ${alpha(
                  theme.palette.success.main,
                  0.5
                )} 100%)`,
              },
            }}
          >
            <CardContent sx={{ px: { xs: 3, md: 6 }, py: { xs: 4, md: 5 } }}>
              {sections.map((section, index) => (
                <Motion.div
                  key={section.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                >
                  <section aria-labelledby={section.id} style={{ marginBottom: index < sections.length - 1 ? '2rem' : '0' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                      <Box
                        sx={{
                          p: 1,
                          borderRadius: 1.5,
                          bgcolor: alpha(theme.palette.success.main, 0.1),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: theme.palette.success.main,
                        }}
                      >
                        {section.icon}
                      </Box>
                      <Typography
                        id={section.id}
                        variant="h6"
                        component="h2"
                        sx={{
                          fontWeight: 700,
                          fontSize: '1.25rem',
                          color: 'text.primary',
                        }}
                      >
                        {section.title}
                      </Typography>
                    </Box>
                    <Typography
                      paragraph
                      sx={{
                        mt: 1,
                        lineHeight: 1.8,
                        fontSize: '1rem',
                        color: 'text.secondary',
                        pl: { xs: 0, md: 5 },
                      }}
                    >
                      {section.content}
                    </Typography>
                    {index < sections.length - 1 && (
                      <Divider
                        sx={{
                          mt: 3,
                          mb: 0,
                          borderColor: alpha(theme.palette.divider, 0.08),
                        }}
                      />
                    )}
                  </section>
                </Motion.div>
              ))}

              <Divider
                sx={{
                  my: 4,
                  borderColor: alpha(theme.palette.divider, 0.08),
                }}
              />

              {/* Acknowledgment */}
              <Motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 1 }}
              >
                <Box
                  sx={{
                    p: 2.5,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.success.main, 0.05),
                    border: `1px solid ${alpha(theme.palette.success.main, 0.1)}`,
                    mb: 3,
                  }}
                >
                  <Typography
                    variant="body1"
                    sx={{
                      fontWeight: 600,
                      color: 'text.primary',
                      lineHeight: 1.8,
                      textAlign: 'center',
                    }}
                  >
                    By using ADAL, you acknowledge that you have read and understood these Terms & Services and agree to
                    be bound by them.
                  </Typography>
                </Box>
              </Motion.div>

              {/* Footer */}
              <Motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 1.1 }}
              >
                <Box sx={{ mt: 4, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    © 2025 ADAL. All rights reserved.
                  </Typography>
                </Box>
              </Motion.div>
            </CardContent>
          </Card>
        </Motion.div>
      </Box>
    </DashboardLayout>
  )
}

export default TermsAndServices
