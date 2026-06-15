import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Typography, Card, CardContent, Chip, Stack, CircularProgress,
  TextField, IconButton, Paper, Button, Divider
} from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined'
import ReactMarkdown from 'react-markdown'
import { getCase } from '../../api/caseApi'
import { sendCaseMessage } from '../../api/caseApi'

export default function CaseDetail() {
  const { caseId } = useParams()
  const navigate = useNavigate()
  const [caseData, setCaseData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const [error, setError] = useState(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { 
    setMessages([])
    setConversationId(null)
    setError(null)
    setInputValue('')
    loadCase() 
  }, [caseId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadCase = async () => {
    setLoading(true)
    try {
      const data = await getCase(caseId)
      setCaseData(data)
    } catch (e) { console.error('Failed to load case:', e) }
    setLoading(false)
  }

  const handleSend = async () => {
    const text = inputValue.trim()
    if (!text || isLoading) return

    const userMsg = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInputValue('')
    setIsLoading(true)
    setError(null)

    try {
      const response = await sendCaseMessage(text, parseInt(caseId), conversationId)
      if (!conversationId && response.conversation_id) {
        setConversationId(response.conversation_id)
      }
      const aiMsg = {
        role: 'assistant',
        content: response.response,
        metadata: response.metadata,
      }
      setMessages(prev => [...prev, aiMsg])
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to get response')
      setMessages(prev => prev.filter(m => m !== userMsg))
    }
    setIsLoading(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress sx={{ color: 'var(--violet)' }} />
      </Box>
    )
  }

  if (!caseData) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="var(--text-secondary)">Case not found</Typography>
      </Box>
    )
  }

  const c = caseData.case
  const documents = caseData.documents || []
  const conversations = caseData.conversations || []
  const drafts = caseData.drafts || []

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 48px)', gap: 0 }}>
      {/* Left: Case Context */}
      <Box sx={{ width: 320, borderRight: '1px solid var(--border)', bgcolor: 'var(--surface-deep)', overflow: 'auto', p: 2, flexShrink: 0 }}>
        <Typography variant="h5" sx={{ fontFamily: '"Cormorant Garamond", serif', color: 'var(--text-primary)', mb: 1 }}>
          {c.title}
        </Typography>
        <Stack direction="row" spacing={1} mb={2}>
          <Chip label={c.case_type} size="small" color={c.case_type === 'criminal' ? 'error' : c.case_type === 'constitutional' ? 'warning' : 'info'} variant="outlined" />
          <Chip label={c.status} size="small" color={c.status === 'open' ? 'success' : 'default'} variant="outlined" />
        </Stack>
        {c.case_number && (
          <Typography variant="body2" color="var(--text-secondary)" mb={2}>#{c.case_number}</Typography>
        )}

        <Divider sx={{ borderColor: 'var(--border)', mb: 2 }} />

        {/* Documents */}
        <Typography variant="subtitle2" sx={{ color: 'var(--violet)', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <DescriptionOutlinedIcon fontSize="small" /> Documents ({documents.length})
        </Typography>
        {documents.length === 0 ? (
          <Typography variant="body2" color="var(--text-secondary)" mb={2}>No documents linked</Typography>
        ) : (
          <Stack spacing={0.5} mb={2}>
            {documents.map((d) => (
              <Button key={d.id} size="small" onClick={() => navigate(`/documents/${d.id}`)}
                sx={{ justifyContent: 'flex-start', color: 'var(--text-primary)', textTransform: 'none', fontSize: '0.8rem',
                  '&:hover': { bgcolor: 'rgba(127,119,221,0.1)' } }}>
                {d.filename}
              </Button>
            ))}
          </Stack>
        )}

        {/* Conversations */}
        <Typography variant="subtitle2" sx={{ color: 'var(--violet)', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ChatBubbleOutlineIcon fontSize="small" /> Conversations ({conversations.length})
        </Typography>
        {conversations.length === 0 ? (
          <Typography variant="body2" color="var(--text-secondary)" mb={2}>No conversations yet</Typography>
        ) : (
          <Stack spacing={0.5} mb={2}>
            {conversations.map((conv) => (
              <Typography key={conv.id} variant="body2" color="var(--text-primary)" sx={{ fontSize: '0.8rem' }}>
                {conv.title || `Conversation #${conv.id}`}
              </Typography>
            ))}
          </Stack>
        )}

        {/* Drafts */}
        <Typography variant="subtitle2" sx={{ color: 'var(--violet)', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <EditNoteOutlinedIcon fontSize="small" /> Drafts ({drafts.length})
        </Typography>
        {drafts.length === 0 ? (
          <Typography variant="body2" color="var(--text-secondary)">No drafts</Typography>
        ) : (
          <Stack spacing={0.5}>
            {drafts.map((d) => (
              <Typography key={d.id} variant="body2" color="var(--text-primary)" sx={{ fontSize: '0.8rem' }}>
                {d.title}
              </Typography>
            ))}
          </Stack>
        )}
      </Box>

      {/* Right: Agent Chat */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: 'var(--obsidian)' }}>
        {/* Header */}
        <Box sx={{ p: 2, borderBottom: '1px solid var(--border)', bgcolor: 'var(--surface-deep)' }}>
          <Typography variant="body2" color="var(--text-secondary)">
            Case Agent — ask about legal research, extract citations, segment claims, or find evidence
          </Typography>
        </Box>

        {/* Messages */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {messages.length === 0 && !isLoading && (
            <Box sx={{ textAlign: 'center', mt: 8, color: 'var(--text-secondary)' }}>
              <Typography variant="h6" sx={{ fontFamily: '"Cormorant Garamond", serif', mb: 1 }}>
                Case Workflow Agent
              </Typography>
              <Typography variant="body2">
                Try: "Extract citations from my document" or "What does Section 302 of PPC say?"
              </Typography>
            </Box>
          )}

          {messages.map((msg, i) => (
            <Box key={i} sx={{ mb: 2, display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <Paper sx={{
                maxWidth: '75%', p: 2,
                bgcolor: msg.role === 'user' ? 'var(--violet)' : 'var(--surface)',
                color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              }}>
                {msg.role === 'assistant' ? (
                  <Box sx={{ '& p': { m: 0, lineHeight: 1.6 }, '& h3': { fontSize: '1rem', mt: 1, mb: 0.5, color: 'var(--violet)' },
                    '& ul, & ol': { pl: 2.5 }, '& code': { bgcolor: 'rgba(127,119,221,0.15)', px: 0.5, py: 0.2, borderRadius: 1 },
                    '& strong': { color: 'var(--lavender)' } }}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </Box>
                ) : (
                  <Typography variant="body2">{msg.content}</Typography>
                )}

                {msg.metadata?.tool_used && msg.metadata.tool_used !== 'chat' && (
                  <Chip label={`Tool: ${msg.metadata.tool_used}`} size="small"
                    sx={{ mt: 1, bgcolor: 'rgba(127,119,221,0.15)', color: 'var(--violet)', fontSize: '0.7rem' }} />
                )}
              </Paper>
            </Box>
          ))}

          {isLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
              <Paper sx={{ p: 2, bgcolor: 'var(--surface)', color: 'var(--text-secondary)', borderRadius: '16px 16px 16px 4px' }}>
                <CircularProgress size={16} sx={{ color: 'var(--violet)' }} />
              </Paper>
            </Box>
          )}

          {error && (
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <Typography color="error" variant="body2">{error}</Typography>
            </Box>
          )}

          <div ref={messagesEndRef} />
        </Box>

        {/* Input */}
        <Box sx={{ p: 2, borderTop: '1px solid var(--border)', bgcolor: 'var(--surface-deep)' }}>
          <Stack direction="row" spacing={1}>
            <TextField fullWidth multiline maxRows={4} value={inputValue}
              onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Ask the case agent..."
              disabled={isLoading}
              InputProps={{ sx: { color: 'var(--text-primary)', bgcolor: 'var(--surface)', borderRadius: 2 } }}
              inputRef={inputRef} />
            <IconButton onClick={handleSend} disabled={!inputValue.trim() || isLoading}
              sx={{ color: 'var(--violet)', alignSelf: 'flex-end' }}>
              <SendIcon />
            </IconButton>
          </Stack>
        </Box>
      </Box>
    </Box>
  )
}
