import React, { useEffect } from 'react'
import { Container, Box, Typography, Card, CardContent } from '@mui/material'
import ThemeToggleButton from '../components/ThemeToggleButton'

const Privacy = () => {
  useEffect(() => {
    document.title = 'Privacy Policy | ADAL'
  }, [])

  return (
    <Box component="main" sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary', py: { xs: 4, md: 8 } }}>
      <Container maxWidth="md">
        <Box sx={{ position: 'relative' }}>
          <Box sx={{ position: 'absolute', top: -8, right: -8 }}>
            <ThemeToggleButton />
          </Box>

          <Box sx={{ mb: 3, textAlign: 'center' }}>
            <Typography component="h1" variant="h4" sx={{ fontWeight: 700 }} gutterBottom>
              Privacy Policy
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              How ADAL collects, uses, and protects your personal data
            </Typography>
          </Box>

          <Card elevation={3}>
            <CardContent sx={{ px: { xs: 3, md: 6 }, py: { xs: 3, md: 5 } }}>
              <Typography paragraph>
                This is a placeholder Privacy Policy. When the backend and legal copy are ready this page will be
                populated with the official privacy policy describing data collection, processing, retention, and
                user rights.
              </Typography>

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 4, textAlign: 'center' }}>
                © 2025 ADAL. All rights reserved.
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Container>
    </Box>
  )
}

export default Privacy
