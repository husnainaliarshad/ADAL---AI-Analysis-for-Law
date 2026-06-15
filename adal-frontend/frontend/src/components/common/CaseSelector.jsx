import { useState, useEffect, useRef } from 'react'
import { Box, Select, MenuItem, Typography, IconButton, Dialog, DialogTitle, DialogContent, TextField, Button, Stack, CircularProgress, Divider } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { useCase } from '../../contexts/CaseContext'
import { linkDocument } from '../../api/caseApi'
import axiosClient from '../../api/axiosClient'

const CASE_TYPES = ['civil', 'criminal', 'constitutional']

export default function CaseSelector({ collapsed }) {
  const { caseId, caseContext, cases, selectCase, createCase, ctxLoading } = useCase()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ title: '', case_type: 'civil', case_number: '' })
  const [creating, setCreating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [uploadedDocId, setUploadedDocId] = useState(null)
  const [generatingTitle, setGeneratingTitle] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  const resetForm = () => {
    setForm({ title: '', case_type: 'civil', case_number: '' })
    setUploadedFile(null)
    setUploadedDocId(null)
    setUploading(false)
    setGeneratingTitle(false)
    setDragOver(false)
  }

  const generateTitle = async (docId) => {
    setGeneratingTitle(true)
    try {
      const res = await axiosClient.post('/cases/generate-title', { document_id: docId })
      if (res.data?.title) {
        setForm(prev => ({ ...prev, title: res.data.title }))
      }
    } catch (e) {
      console.error('Title generation failed:', e)
      // Fallback: use filename
    }
    setGeneratingTitle(false)
  }

  const handleFile = async (file) => {
    if (!file) return
    setUploading(true)
    setUploadedFile(file)
    const filename = file.name.replace(/\.[^.]+$/, '')
    if (!form.title) {
      setForm(prev => ({ ...prev, title: filename }))
    }
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await axiosClient.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180000,
      })
      const docId = res.data?.document_id || res.data?.id
      setUploadedDocId(docId)

      // If OCR is ready, generate AI title
      if (res.data?.has_ocr_text && res.data?.ocr_text_length > 100) {
        generateTitle(docId)
      }
    } catch (e) {
      console.error('Upload failed:', e)
      setUploadedFile(null)
    }
    setUploading(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) handleFile(file)
  }

  const handleCreate = async () => {
    if (!form.title.trim()) return
    setCreating(true)
    try {
      const c = await createCase(form)
      if (uploadedDocId) {
        await linkDocument(c.id, uploadedDocId).catch(() => {})
      }
      setDialogOpen(false)
      resetForm()
    } catch (e) { console.error(e) }
    setCreating(false)
  }

  if (collapsed) {
    return (
      <Box sx={{ textAlign: 'center', py: 1 }}>
        <IconButton size="small" onClick={() => setDialogOpen(true)}
          sx={{ color: caseId ? 'var(--violet)' : 'var(--text-muted)' }}>
          <GavelOutlinedIcon fontSize="small" />
        </IconButton>
      </Box>
    )
  }

  return (
    <Box sx={{ px: 1.1, py: 1, borderBottom: '1px solid var(--border)', width: '100%', overflow: 'hidden' }}>
      <Typography sx={{ 
        fontSize: '0.58rem', 
        letterSpacing: '0.22em', 
        textTransform: 'uppercase', 
        color: 'var(--text-muted)', 
        mb: 0.5,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}>
        Active Case
      </Typography>


      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
        <Select value={caseId || ''}
          onChange={(e) => selectCase(e.target.value || null)}
          displayEmpty size="small"
          sx={{
            flex: 1, color: 'var(--text-primary)', fontSize: '0.75rem',
            minWidth: 0, // Critical for flex truncation
            '& .MuiSelect-select': { 
              py: 0.5,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-bright)' },
          }}>
          <MenuItem value=""><em>No case selected</em></MenuItem>
          {cases.map((c) => (
            <MenuItem key={c.id} value={c.id} sx={{ fontSize: '0.75rem' }}>
              <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.title}
              </Box>
            </MenuItem>
          ))}
        </Select>
        <IconButton size="small" onClick={() => { resetForm(); setDialogOpen(true) }}
          sx={{ color: 'var(--violet)', p: 0.5 }}>
          <AddIcon fontSize="small" />
        </IconButton>
      </Box>

      {ctxLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.5 }}>
          <CircularProgress size={12} sx={{ color: 'var(--violet)' }} />
        </Box>
      )}

      {caseId && caseContext && (
        <Typography sx={{ 
          fontSize: '0.65rem', 
          color: 'var(--text-muted)', 
          mt: 0.5,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {caseContext.case?.case_type} &middot; {caseContext.documents?.length || 0} docs &middot; {caseContext.conversations?.length || 0} threads
        </Typography>
      )}

      <Dialog open={dialogOpen} onClose={() => { setDialogOpen(false); resetForm() }} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: 'var(--surface)', border: '1px solid var(--border)' } }}>
        <DialogTitle sx={{ color: 'var(--text-primary)', fontFamily: '"Cormorant Garamond", serif', display: 'flex', justifyContent: 'space-between' }}>
          New Case
          <IconButton size="small" onClick={() => { setDialogOpen(false); resetForm() }}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            {/* Title with AI generation indicator */}
            <TextField label="Title" size="small" value={form.title} autoFocus
              onChange={e => setForm({ ...form, title: e.target.value })}
              InputLabelProps={{ sx: { color: 'var(--text-secondary)' } }}
              InputProps={{
                endAdornment: generatingTitle ? (
                  <CircularProgress size={16} sx={{ color: 'var(--violet)' }} />
                ) : null,
              }}
              sx={{ input: { color: 'var(--text-primary)' } }} />
            {generatingTitle && (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <AutoAwesomeIcon sx={{ fontSize: 14, color: 'var(--violet)' }} />
                <Typography sx={{ color: 'var(--violet)', fontSize: '0.68rem' }}>Generating title from document...</Typography>
              </Stack>
            )}

            <TextField label="Case Number (optional)" size="small" value={form.case_number}
              onChange={e => setForm({ ...form, case_number: e.target.value })}
              InputLabelProps={{ sx: { color: 'var(--text-secondary)' } }}
              sx={{ input: { color: 'var(--text-primary)' } }} />
            <Select value={form.case_type} size="small"
              onChange={e => setForm({ ...form, case_type: e.target.value })}
              sx={{ color: 'var(--text-primary)', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-bright)' } }}>
              {CASE_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>

            <Divider sx={{ borderColor: 'var(--border)' }} />

            <Typography sx={{ fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--violet)' }}>
              Case file
            </Typography>

            <Box
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              sx={{
                border: `1.5px dashed ${dragOver ? 'var(--violet)' : 'var(--border-bright)'}`,
                borderRadius: 2, p: 2, textAlign: 'center', cursor: 'pointer',
                bgcolor: dragOver ? 'rgba(127,119,221,0.08)' : 'transparent',
                transition: 'border-color 0.2s, background 0.2s',
                '&:hover': { borderColor: 'var(--violet)', bgcolor: 'rgba(127,119,221,0.04)' },
              }}>
              <input ref={fileInputRef} type="file" hidden
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                accept=".pdf,.jpg,.jpeg,.png,.tiff,.txt,.md" />
              {uploading ? (
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
                  <CircularProgress size={18} sx={{ color: 'var(--violet)' }} />
                  <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                    Uploading & extracting text...
                  </Typography>
                </Stack>
              ) : uploadedFile ? (
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
                  <InsertDriveFileIcon sx={{ color: 'var(--violet)', fontSize: 20 }} />
                  <Typography sx={{ color: 'var(--text-primary)', fontSize: '0.78rem' }}>{uploadedFile.name}</Typography>
                </Stack>
              ) : (
                <Stack spacing={0.5} alignItems="center">
                  <UploadFileIcon sx={{ color: 'var(--text-muted)', fontSize: 24 }} />
                  <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Drop a file or click to upload</Typography>
                  <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>Title auto-generated from content</Typography>
                </Stack>
              )}
            </Box>

            <Button onClick={handleCreate} disabled={!form.title.trim() || creating || uploading || generatingTitle}
              variant="contained" size="small"
              sx={{ bgcolor: 'var(--violet)', '&:hover': { bgcolor: 'var(--lavender)' }, textTransform: 'none' }}>
              {creating ? 'Creating...' : 'Create Case'}
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  )
}
