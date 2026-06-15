import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import SystemStatus from '../pages/Dashboard/components/SystemStatus'
import axiosClient from '../api/axiosClient'

vi.mock('../api/axiosClient', () => ({
  default: {
    get: vi.fn(),
  },
}))

describe('SystemStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders health-derived statuses when /health succeeds', async () => {
    axiosClient.get.mockResolvedValueOnce({
      data: {
        status: 'healthy',
        timestamp: '2026-01-01T10:00:00.000Z',
        checks: {
          server: true,
          database: true,
        },
      },
    })

    render(<SystemStatus />)

    await waitFor(() => {
      expect(screen.getAllByText('Healthy').length).toBeGreaterThanOrEqual(2)
    })

    expect(screen.getByText('API Server')).toBeInTheDocument()
    expect(screen.getByText('Database')).toBeInTheDocument()
  })

  it('renders unavailable state when /health fails', async () => {
    axiosClient.get.mockRejectedValueOnce(new Error('network unavailable'))

    render(<SystemStatus />)

    await waitFor(() => {
      expect(screen.getAllByText('Unavailable').length).toBeGreaterThanOrEqual(2)
    })
  })
})
