import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'

const mockPage = (label) => ({
  default: () => <div>{label}</div>,
})

const mockRouteModules = () => {
  vi.doMock('../pages/Landing', () => mockPage('Landing Page'))
  vi.doMock('../pages/NotFound', () => mockPage('Not Found Page'))
  vi.doMock('../pages/ResetPassword', () => mockPage('Reset Password Page'))
  vi.doMock('../pages/Auth/Login', () => mockPage('Login Page'))
  vi.doMock('../pages/Auth/Register', () => mockPage('Register Page'))
  vi.doMock('../pages/Dashboard/Dashboard', () => mockPage('Dashboard Page'))
  vi.doMock('../pages/Documents/DocumentUpload', () => mockPage('Upload Page'))
  vi.doMock('../pages/Documents/DocumentList', () => mockPage('Document List Page'))
  vi.doMock('../pages/Documents/DocumentDetail', () => mockPage('Document Detail Page'))
  vi.doMock('../pages/Citations/CitationList', () => mockPage('Citation List Page'))
  vi.doMock('../pages/Citations/CitationDetail', () => mockPage('Citation Detail Page'))
  vi.doMock('../pages/Claims/ClaimList', () => mockPage('Claim List Page'))
  vi.doMock('../pages/Claims/ClaimDetail', () => mockPage('Claim Detail Page'))
  vi.doMock('../pages/TermsAndServices', () => mockPage('Terms Page'))
  vi.doMock('../pages/Privacy', () => mockPage('Privacy Page'))
  vi.doMock('../pages/NotificationsPage', () => mockPage('Notifications Page'))
  vi.doMock('../pages/SettingsPage', () => mockPage('Settings Page'))
  vi.doMock('../pages/Summary/SummaryPage', () => mockPage('Summary Page'))
  vi.doMock('../pages/DocumentDraftingAssistant/DraftingAssistantPage', () => mockPage('Drafting Assistant Page'))
  vi.doMock('../pages/ChatPage', () => mockPage('Chat Page'))
  vi.doMock('../routes/PrivateRoute', () => ({
    default: ({ children }) => <>{children}</>,
  }))
  vi.doMock('../routes/PublicRoute', () => ({
    default: ({ children }) => <>{children}</>,
  }))
}

const loadRoutes = async (enableDevRoutes) => {
  vi.resetModules()
  vi.doMock('../config/runtimeConfig', () => ({
    ENABLE_DEV_ROUTES: enableDevRoutes,
    API_URL: 'http://localhost:9006/api',
  }))
  mockRouteModules()
  const mod = await import('../routes')
  return mod.default
}

describe('dev route gating', () => {
  it('does not expose dev routes when flag is false', async () => {
    const AppRoutes = await loadRoutes(false)

    render(
      <MemoryRouter initialEntries={['/__dev__/dashboard']}>
        <AppRoutes />
      </MemoryRouter>
    )

    expect(screen.getByText('Not Found Page')).toBeInTheDocument()
    expect(screen.queryByText('Dashboard Page')).not.toBeInTheDocument()
  })

  it('exposes dev routes only when flag is true', async () => {
    const AppRoutes = await loadRoutes(true)

    render(
      <MemoryRouter initialEntries={['/__dev__/dashboard']}>
        <AppRoutes />
      </MemoryRouter>
    )

    expect(screen.getByText('Dashboard Page')).toBeInTheDocument()
  })

  it('exposes dynamic dev routes when flag is true', async () => {
    const AppRoutes = await loadRoutes(true)

    render(
      <MemoryRouter initialEntries={['/__dev__/documents/123']}>
        <AppRoutes />
      </MemoryRouter>
    )

    expect(screen.getByText('Document Detail Page')).toBeInTheDocument()
  })
})
