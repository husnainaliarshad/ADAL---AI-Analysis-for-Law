import { useState } from 'react'
import { Button, Dialog, DialogTitle, DialogContent, List, ListItemButton, ListItemText, ListItemIcon, CircularProgress, Typography } from '@mui/material'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import { getCases, linkDocument } from '../../api/caseApi'
import { useCase } from '../../contexts/CaseContext'

export default function CaseLinkButton({ documentId }) {
  const { selectCase } = useCase()
  const [open, setOpen] = useState(false)
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(false)
  const [linking, setLinking] = useState(null)

  const handleOpen = async () => {
    setOpen(true)
    setLoading(true)
    try {
      const data = await getCases()
      setCases(data.filter(c => c.status === 'open'))
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const handleLink = async (caseId) => {
    setLinking(caseId)
    try {
      await linkDocument(caseId, documentId)
      selectCase(caseId)
      setOpen(false)
    } catch (e) { console.error(e) }
    setLinking(null)
  }

  if (!documentId) return null

  return (
    <>
      <Button onClick={handleOpen} sx={{
        color: 'var(--violet)', borderColor: 'var(--violet)', textTransform: 'none',
        '&:hover': { bgcolor: 'rgba(127,119,221,0.1)' }
      }} variant="outlined" size="small" startIcon={<AccountBalanceIcon fontSize="small" />}>
        Link to Case
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: 'var(--surface)', border: '1px solid var(--border)' } }}>
        <DialogTitle sx={{ color: 'var(--text-primary)', fontFamily: '"Cormorant Garamond", serif' }}>
          Link to Case
        </DialogTitle>
        <DialogContent>
          {loading ? (
            <CircularProgress size={24} sx={{ color: 'var(--violet)', display: 'block', mx: 'auto', my: 2 }} />
          ) : cases.length === 0 ? (
            <Typography color="var(--text-secondary)" sx={{ py: 2, textAlign: 'center', fontSize: '0.82rem' }}>
              No open cases. Create one from the sidebar.
            </Typography>
          ) : (
            <List disablePadding>
              {cases.map((c) => (
                <ListItemButton key={c.id} onClick={() => handleLink(c.id)} disabled={linking === c.id}
                  sx={{ color: 'var(--text-primary)', borderRadius: 1, '&:hover': { bgcolor: 'rgba(127,119,221,0.08)' } }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <AccountBalanceIcon sx={{ fontSize: 18, color: 'var(--violet)' }} />
                  </ListItemIcon>
                  <ListItemText primary={c.title} secondary={c.case_number || c.case_type}
                    primaryTypographyProps={{ fontSize: '0.82rem' }}
                    secondaryTypographyProps={{ sx: { color: 'var(--text-secondary)', fontSize: '0.7rem' } }} />
                  {linking === c.id && <CircularProgress size={16} sx={{ color: 'var(--violet)' }} />}
                </ListItemButton>
              ))}
            </List>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
