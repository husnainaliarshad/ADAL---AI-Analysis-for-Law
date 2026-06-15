import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Button, Card, CardContent, CardActions,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Chip, CircularProgress, Stack
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { getCases, createCase, deleteCase } from '../../api/caseApi'

const CASE_TYPES = ['civil', 'criminal', 'constitutional']
const TYPE_COLORS = { civil: 'info', criminal: 'error', constitutional: 'warning' }

export default function CasesList() {
  const navigate = useNavigate()
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newCase, setNewCase] = useState({ title: '', case_type: 'civil', case_number: '', description: '' })
  const [creating, setCreating] = useState(false)

  useEffect(() => { loadCases() }, [])

  const loadCases = async () => {
    setLoading(true)
    try {
      const data = await getCases()
      setCases(data)
    } catch (e) { console.error('Failed to load cases:', e) }
    setLoading(false)
  }

  const handleCreate = async () => {
    if (!newCase.title.trim()) return
    setCreating(true)
    try {
      await createCase(newCase)
      setDialogOpen(false)
      setNewCase({ title: '', case_type: 'civil', case_number: '', description: '' })
      loadCases()
    } catch (e) { console.error('Failed to create case:', e) }
    setCreating(false)
  }

  const handleDelete = async (caseId) => {
    if (!window.confirm('Delete this case? Documents and conversations will be unlinked but not deleted.')) return
    try {
      await deleteCase(caseId)
      loadCases()
    } catch (e) { console.error('Failed to delete case:', e) }
  }

  return (
    <Box sx={{ p: 4, maxWidth: 1000, mx: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" sx={{ fontFamily: '"Cormorant Garamond", serif', color: 'var(--text-primary)' }}>
          Cases
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}
          sx={{ bgcolor: 'var(--violet)', '&:hover': { bgcolor: 'var(--lavender)' } }}>
          New Case
        </Button>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: 'var(--violet)' }} />
        </Box>
      ) : cases.length === 0 ? (
        <Card sx={{ bgcolor: 'var(--surface)', border: '1px solid var(--border)', p: 6, textAlign: 'center' }}>
          <Typography color="var(--text-secondary)">No cases yet. Create one to start working.</Typography>
        </Card>
      ) : (
        <Stack spacing={2}>
          {cases.map((c) => (
            <Card key={c.id} sx={{ bgcolor: 'var(--surface)', border: '1px solid var(--border)' }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="h6" sx={{ color: 'var(--text-primary)', fontFamily: '"DM Sans", sans-serif' }}>
                      {c.title}
                    </Typography>
                    {c.case_number && (
                      <Typography variant="body2" color="var(--text-secondary)" sx={{ mt: 0.5 }}>
                        {c.case_number}
                      </Typography>
                    )}
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Chip label={c.case_type} size="small" color={TYPE_COLORS[c.case_type] || 'default'} variant="outlined" />
                    <Chip label={c.status} size="small" color={c.status === 'open' ? 'success' : 'default'} variant="outlined" />
                  </Stack>
                </Stack>
                <Typography variant="body2" color="var(--text-secondary)" sx={{ mt: 1 }}>
                  {new Date(c.updated_at).toLocaleDateString()}
                </Typography>
              </CardContent>
              <CardActions>
                <Button size="small" onClick={() => navigate(`/cases/${c.id}`)}
                  sx={{ color: 'var(--violet)' }}>
                  Open <OpenInNewIcon sx={{ ml: 0.5, fontSize: 16 }} />
                </Button>
                <IconButton size="small" onClick={() => handleDelete(c.id)} sx={{ ml: 'auto', color: 'var(--text-secondary)' }}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </CardActions>
            </Card>
          ))}
        </Stack>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: 'var(--surface)', border: '1px solid var(--border)' } }}>
        <DialogTitle sx={{ color: 'var(--text-primary)', fontFamily: '"Cormorant Garamond", serif' }}>
          New Case
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Case Title" value={newCase.title} required
              onChange={(e) => setNewCase({ ...newCase, title: e.target.value })}
              InputLabelProps={{ sx: { color: 'var(--text-secondary)' } }}
              sx={{ input: { color: 'var(--text-primary)' } }} />
            <TextField label="Case Number (optional)" value={newCase.case_number}
              onChange={(e) => setNewCase({ ...newCase, case_number: e.target.value })}
              InputLabelProps={{ sx: { color: 'var(--text-secondary)' } }}
              sx={{ input: { color: 'var(--text-primary)' } }} />
            <TextField label="Case Type" value={newCase.case_type} select
              onChange={(e) => setNewCase({ ...newCase, case_type: e.target.value })}
              InputLabelProps={{ sx: { color: 'var(--text-secondary)' } }}
              sx={{ '& .MuiSelect-select': { color: 'var(--text-primary)' } }}>
              {CASE_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>
            <TextField label="Description (optional)" value={newCase.description} multiline rows={2}
              onChange={(e) => setNewCase({ ...newCase, description: e.target.value })}
              InputLabelProps={{ sx: { color: 'var(--text-secondary)' } }}
              sx={{ textarea: { color: 'var(--text-primary)' } }} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: 'var(--text-secondary)' }}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!newCase.title.trim() || creating}
            sx={{ color: 'var(--violet)' }}>
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
