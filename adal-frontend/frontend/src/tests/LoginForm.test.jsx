import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { within } from '@testing-library/react'
import LoginForm from '../components/auth/LoginForm'
import authApi from '../api/authApi'
import { renderWithProviders, screen, userEvent } from './test-utils'

vi.mock('../api/authApi', () => ({
  default: {
    login: vi.fn(),
  },
}))

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('toggles password visibility correctly', async () => {
    renderWithProviders(<LoginForm />, { useMemoryRouter: true })

    const passwordField = screen.getByLabelText(/^password$/i)
    const passwordInput = passwordField.closest('.MuiFormControl-root')?.querySelector('input')
    expect(passwordInput).toBeTruthy()
    expect(passwordInput).toHaveAttribute('type', 'password')

    await userEvent.click(screen.getByLabelText(/toggle password visibility/i))
    expect(passwordInput).toHaveAttribute('type', 'text')
  })

  it('prioritizes backend detail over message in auth errors', async () => {
    authApi.login.mockRejectedValueOnce({
      response: {
        status: 400,
        data: {
          detail: 'Detail takes precedence',
          message: 'Generic message',
        },
      },
      message: 'Fallback error message',
    })

    renderWithProviders(<LoginForm />, { useMemoryRouter: true })

    await userEvent.type(screen.getByLabelText(/email address/i), 'user@example.com')
    const passwordField = screen.getByLabelText(/^password$/i)
    const passwordInput = passwordField.closest('.MuiFormControl-root')?.querySelector('input')
    expect(passwordInput).toBeTruthy()
    await userEvent.type(passwordInput, 'password123')
    await userEvent.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByText('Detail takes precedence')).toBeInTheDocument()
  })
})
