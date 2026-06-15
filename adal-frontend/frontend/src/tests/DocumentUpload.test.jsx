import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import DocumentUpload from '../pages/Documents/DocumentUpload'
import axiosClient from '../api/axiosClient'
import { renderWithProviders, screen, userEvent } from './test-utils'

vi.mock('../api/axiosClient', () => ({
  default: {
    post: vi.fn(),
  },
}))

describe('DocumentUpload request contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    axiosClient.post.mockResolvedValue({ data: { id: 1 } })
  })

  it('sends only file content in upload payload', async () => {
    renderWithProviders(<DocumentUpload />, { useMemoryRouter: true })

    const fileInput = screen.getByTestId('file-input')
    const file = new File(['test file'], 'contract.pdf', { type: 'application/pdf' })

    await userEvent.upload(fileInput, file)
    await userEvent.click(screen.getByRole('button', { name: /upload/i }))

    await waitFor(() => {
      expect(axiosClient.post).toHaveBeenCalled()
    })

    const [path, payload] = axiosClient.post.mock.calls[0]
    expect(path).toBe('/files/upload')
    expect(payload).toBeInstanceOf(FormData)
    expect(Array.from(payload.keys())).toEqual(['file'])
  })
})
