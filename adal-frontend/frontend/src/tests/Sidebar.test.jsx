import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import PrivateRoute from '../routes/PrivateRoute'
import PublicRoute from '../routes/PublicRoute'
import { getAccessToken } from '../utils/tokenStorage'
import { isTokenValid } from '../utils/tokenValidation'

vi.mock('../utils/tokenStorage', () => ({
  getAccessToken: vi.fn(),
}))

vi.mock('../utils/tokenValidation', () => ({
  isTokenValid: vi.fn(),
}))

describe('Auth Guards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects unauthenticated users away from private routes', () => {
    getAccessToken.mockReturnValue(null)
    isTokenValid.mockReturnValue(false)

    render(
      <MemoryRouter initialEntries={['/private']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/private"
            element={(
              <PrivateRoute>
                <div>Private Content</div>
              </PrivateRoute>
            )}
          />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Private Content')).not.toBeInTheDocument()
  })

  it('allows authenticated users into private routes', () => {
    getAccessToken.mockReturnValue('valid-token')
    isTokenValid.mockReturnValue(true)

    render(
      <MemoryRouter initialEntries={['/private']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/private"
            element={(
              <PrivateRoute>
                <div>Private Content</div>
              </PrivateRoute>
            )}
          />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Private Content')).toBeInTheDocument()
  })

  it('redirects authenticated users away from public auth routes', () => {
    getAccessToken.mockReturnValue('valid-token')
    isTokenValid.mockReturnValue(true)

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/dashboard" element={<div>Dashboard Page</div>} />
          <Route
            path="/login"
            element={(
              <PublicRoute>
                <div>Login Form</div>
              </PublicRoute>
            )}
          />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Dashboard Page')).toBeInTheDocument()
    expect(screen.queryByText('Login Form')).not.toBeInTheDocument()
  })
})
