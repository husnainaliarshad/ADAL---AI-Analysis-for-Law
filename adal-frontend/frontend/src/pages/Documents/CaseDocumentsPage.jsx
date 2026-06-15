// Case-aware wrapper for DocumentList — no changes to DocumentList.jsx needed
import DocumentList from './DocumentList'
import { useCase } from '../../contexts/CaseContext'
import { Typography, Box, Chip, Button } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

export default function CaseDocumentsPage() {
  const { caseId, caseContext, selectCase } = useCase()

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {caseId && caseContext && (
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1, px: 3, py: 1,
          bgcolor: 'rgba(127,119,221,0.08)', borderBottom: '1px solid var(--border)',
        }}>
          <Typography variant="body2" sx={{ color: 'var(--violet)', fontFamily: '"Cormorant Garamond", serif', fontWeight: 600 }}>
            Case: {caseContext.case?.title}
          </Typography>
          <Chip label={caseContext.case?.case_type} size="small" variant="outlined"
            sx={{ color: 'var(--text-secondary)', borderColor: 'var(--border-bright)' }} />
          <Button size="small" onClick={() => selectCase(null)} sx={{ ml: 'auto', color: 'var(--text-muted)', minWidth: 0 }}>
            <CloseIcon fontSize="small" />
          </Button>
        </Box>
      )}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <DocumentList />
      </Box>
    </Box>
  )
}
