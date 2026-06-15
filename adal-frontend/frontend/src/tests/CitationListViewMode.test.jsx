import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CitationList from '../pages/Citations/CitationList'
import citationApi from '../api/citationApi'
import documentApi from '../api/documentApi'
const theme = createTheme()

vi.mock('../api/citationApi', () => ({
  default: {
    getCitationsByDocument: vi.fn(),
  },
}))

vi.mock('../api/documentApi', () => ({
  default: {
    getDocumentById: vi.fn(),
  },
}))

vi.mock('../components/Citations/CitationExtractor', () => ({
  default: () => <button type="button">Extract Citations</button>,
}))

vi.mock('../components/Citations/CitationCard', () => ({
  default: ({ citation }) => <div data-testid="citation-card">{citation.citation_text}</div>,
}))

describe('CitationList view mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    documentApi.getDocumentById.mockResolvedValue({
      data: {
        filename: 'Sample Document.pdf',
      },
    })

    citationApi.getCitationsByDocument.mockResolvedValue({
      data: {
        citations: [
          {
            id: 1,
            citation_text: 'Smith v. Jones, 123 U.S. 456',
            citation_type: 'case',
            confidence_score: 'high',
            created_at: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    })
  })

  it('allows toggling between grid and table views', async () => {
    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={['/documents/1/citations']}>
          <Routes>
            <Route path="/documents/:documentId/citations" element={<CitationList />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('citation-card')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: 'Table' }))

    await waitFor(() => {
      expect(screen.getByText('Citation Text')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: 'Grid' }))

    await waitFor(() => {
      expect(screen.getByTestId('citation-card')).toBeInTheDocument()
    })
  })
})
