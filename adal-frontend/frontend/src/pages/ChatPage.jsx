import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Typography,
} from '@mui/material';
import {
  Add,
  AutoAwesome,
  Close,
  DeleteOutline,
  Search,
  Send,
  StopCircle,
} from '@mui/icons-material';
import AppSidebar from '../components/layout/Sidebar';
import AdalLogo from '../components/ui/AdalLogo';
import { deleteConversation, getConversations, getMessages, sendMessage } from '../api/chatApi';
import { useCase } from '../contexts/CaseContext';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'research', label: 'Research' },
  { key: 'citations', label: 'Citations' },
];

const LegalProcessCard = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const steps = [
    'Analyzing inquiry',
    'Checking relevant material',
    'Assembling response structure',
    'Preparing final answer',
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 1400);

    return () => clearInterval(interval);
  }, []);

  return (
    <Box
      sx={{
        borderLeft: '2px solid rgba(var(--primary-rgb), 0.34)',
        pl: 2,
        py: 0.5,
        maxWidth: 880,
      }}
    >
      <Typography
        sx={{
          color: 'var(--text)',
          fontFamily: 'var(--font-heading)',
          fontSize: { xs: '1rem', md: '1.12rem' },
          mb: 1,
        }}
      >
        ADAL is preparing a response.
      </Typography>
      <Box sx={{ display: 'grid', gap: 1 }}>
        {steps.map((step, index) => {
          const isCurrent = index === currentStep;
          const isDone = index < currentStep;

          return (
            <Box
              key={step}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                color: isCurrent ? 'var(--text)' : isDone ? 'var(--text-secondary)' : 'var(--text-muted)',
              }}
            >
              <Box
                sx={{
                  width: 18,
                  height: 18,
                  borderRadius: '999px',
                  border: '1px solid rgba(var(--primary-rgb), 0.24)',
                  backgroundColor: isDone
                    ? 'rgba(var(--primary-rgb), 0.15)'
                    : 'rgba(var(--primary-rgb), 0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {isCurrent ? (
                  <CircularProgress size={10} sx={{ color: 'var(--primary)' }} />
                ) : (
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: '999px',
                      backgroundColor: isDone ? 'var(--primary)' : 'var(--text-muted)',
                    }}
                  />
                )}
              </Box>
              <Typography sx={{ fontSize: '0.82rem', letterSpacing: '0.01em' }}>
                {step}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

const getConversationTitle = (conversation) => conversation?.title || 'New conversation';

const getConversationPreview = (conversation) => {
  if (conversation?.last_message) return conversation.last_message;
  if (conversation?.preview) return conversation.preview;
  return 'Open this thread to continue the legal discussion.';
};

const inferConversationTags = (conversation) => {
  const text = `${conversation?.title || ''} ${conversation?.last_message || ''}`.toLowerCase();
  const tags = [];

  if (text.includes('draft') || text.includes('outline') || text.includes('petition')) {
    tags.push('Draft linked');
  }
  if (text.includes('citation') || text.includes('case') || text.includes('authority')) {
    tags.push('Citations');
  }
  if (text.includes('summary') || text.includes('research') || text.includes('issue')) {
    tags.push('Research');
  }
  if (tags.length === 0) tags.push('General');

  return tags.slice(0, 2);
};

const matchesFilter = (conversation, filter) => {
  if (filter === 'all') return true;
  const tags = inferConversationTags(conversation).map((tag) => tag.toLowerCase());

  if (filter === 'drafts') return tags.some((tag) => tag.includes('draft'));
  if (filter === 'research') return tags.some((tag) => tag.includes('research') || tag.includes('general'));
  if (filter === 'citations') return tags.some((tag) => tag.includes('citation'));

  return true;
};

const formatUpdatedAt = (value) => {
  if (!value) return 'Updated recently';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Updated recently';

  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.round(diffMs / 60000);

  if (diffMins < 1) return 'Updated just now';
  if (diffMins < 60) return `Updated ${diffMins} min ago`;

  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `Updated ${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) return 'Updated yesterday';
  if (diffDays < 7) return `Updated ${diffDays} days ago`;

  return `Updated ${date.toLocaleDateString()}`;
};

const ChatPage = () => {
  const { caseId } = useCase();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [error, setError] = useState(null);
  const [threadSearch, setThreadSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  const messagesEndRef = useRef(null);
  const searchInputRef = useRef(null);
  const typewriterIntervalRef = useRef(null);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === conversationId) || null,
    [conversationId, conversations],
  );

  const filteredConversations = useMemo(() => {
    return conversations.filter((conversation) => {
      const searchTarget = `${getConversationTitle(conversation)} ${getConversationPreview(conversation)}`.toLowerCase();
      const matchesSearch =
        !threadSearch.trim() || searchTarget.includes(threadSearch.trim().toLowerCase());

      return matchesSearch && matchesFilter(conversation, activeFilter);
    });
  }, [activeFilter, conversations, threadSearch]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    setConversationId(null);
    setMessages([]);
    setError(null);
    if (typewriterIntervalRef.current) clearInterval(typewriterIntervalRef.current);
    setIsTyping(false);
    
    loadConversations();

    return () => {
      if (typewriterIntervalRef.current) {
        clearInterval(typewriterIntervalRef.current);
      }
    };
  }, [caseId]);

  const loadConversations = async () => {
    try {
      setIsLoadingConversations(true);
      const loadedConversations = await getConversations();
      setConversations(loadedConversations);
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setError('Failed to load conversations');
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const loadConversationMessages = async (convId) => {
    try {
      setIsLoading(true);
      if (typewriterIntervalRef.current) clearInterval(typewriterIntervalRef.current);
      setIsTyping(false);

      const loadedMessages = await getMessages(convId);
      const formattedMessages = loadedMessages.map((message) => ({
        id: message.id,
        type: message.role === 'user' ? 'user' : 'ai',
        content: message.content,
        metadata: message.metadata
          ? typeof message.metadata === 'string'
            ? JSON.parse(message.metadata)
            : message.metadata
          : null,
        timestamp: new Date(message.created_at),
      }));

      setMessages(formattedMessages);
    } catch (err) {
      console.error('Failed to load messages:', err);
      setError('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopGenerating = () => {
    if (typewriterIntervalRef.current) {
      clearInterval(typewriterIntervalRef.current);
    }
    setIsTyping(false);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || isTyping) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setError(null);
    setIsLoading(true);

    try {
      const response = await sendMessage(userMessage.content, conversationId);

      if (!conversationId) {
        setConversationId(response.conversation_id);
        await loadConversations();
      }

      setIsLoading(false);
      setIsTyping(true);

      const fullContent = response.response;
      const aiMessageId = response.message_id;
      let currentLength = 0;

      setMessages((prev) => [
        ...prev,
        {
          id: aiMessageId,
          type: 'ai',
          content: '',
          metadata: response.metadata,
          timestamp: new Date(),
        },
      ]);

      typewriterIntervalRef.current = setInterval(() => {
        currentLength += 8;

        if (currentLength >= fullContent.length) {
          currentLength = fullContent.length;
          clearInterval(typewriterIntervalRef.current);
          setIsTyping(false);
        }

        setMessages((prev) =>
          prev.map((message) =>
            message.id === aiMessageId
              ? { ...message, content: fullContent.substring(0, currentLength) }
              : message,
          ),
        );
      }, 30);
    } catch (err) {
      console.error('Failed to send message:', err);
      setError(err.response?.data?.detail || 'Failed to send message');
      setMessages((prev) => prev.filter((message) => message.id !== userMessage.id));
      setIsLoading(false);
    }
  };

  const handleSelectConversation = async (conversation) => {
    setConversationId(conversation.id);
    await loadConversationMessages(conversation.id);
  };

  const handleNewConversation = () => {
    setConversationId(null);
    setMessages([]);
    setError(null);
    if (typewriterIntervalRef.current) clearInterval(typewriterIntervalRef.current);
    setIsTyping(false);
  };

  const handleDeleteConversation = async (convId, event) => {
    event.stopPropagation();

    try {
      await deleteConversation(convId);
      await loadConversations();
      if (conversationId === convId) {
        handleNewConversation();
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      setError('Failed to delete conversation');
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        height: '100vh',
        backgroundColor: 'var(--bg)',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ flexShrink: 0 }}>
        <AppSidebar />
      </Box>

      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        <Box
          sx={{
            borderBottom: '1px solid var(--border)',
            px: { xs: 2, md: 3 },
            py: 1.4,
            display: 'flex',
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            gap: 1.5,
            flexWrap: 'wrap',
            backgroundColor: 'var(--surface-overlay)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <Box>
            <Typography
              sx={{
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                fontSize: '0.64rem',
              }}
            >
              Threaded Conversations
            </Typography>
            <Typography
              sx={{
                color: 'var(--text)',
                fontFamily: 'var(--font-heading)',
                fontSize: { xs: '1.55rem', md: '1.85rem' },
                lineHeight: 1,
                mt: 0.25,
              }}
            >
              Chat
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              startIcon={<Search />}
              onClick={() => searchInputRef.current?.focus()}
              sx={topActionButtonStyles}
            >
              Search Threads
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleNewConversation}
              sx={primaryActionButtonStyles}
            >
              New Conversation
            </Button>
          </Box>
        </Box>

        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '280px minmax(0, 1fr)' },
            gap: { xs: 0, lg: 2 },
            px: { xs: 0, lg: 2 },
            pb: { xs: 0, lg: 2 },
            overflow: 'hidden',
          }}
        >
          <Box sx={{ ...panelStyles, ...historySidebarStyles }}>
            <Box sx={panelHeaderStyles}>
              <Box>
                <Typography sx={panelEyebrowStyles}>History</Typography>
                <Typography sx={panelTitleStyles}>Conversation threads</Typography>
              </Box>
              <Button
                size="small"
                onClick={handleNewConversation}
                sx={miniActionButtonStyles}
              >
                New
              </Button>
            </Box>

            <Box sx={{ px: { xs: 2, md: 2.25 }, pt: 1.25, display: 'grid', gap: 1 }}>
              <Box
                ref={searchInputRef}
                component="input"
                value={threadSearch}
                onChange={(event) => setThreadSearch(event.target.value)}
                placeholder="Search by topic, matter, or draft"
                sx={threadSearchStyles}
              />

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {FILTERS.map((filter) => (
                  <Box
                    key={filter.key}
                    component="button"
                    type="button"
                    onClick={() => setActiveFilter(filter.key)}
                    sx={{
                      ...threadChipStyles,
                      ...(activeFilter === filter.key ? activeThreadChipStyles : {}),
                    }}
                  >
                    {filter.label}
                  </Box>
                ))}
              </Box>
            </Box>

            <Box
              sx={{
                p: { xs: 2, md: 2.25 },
                pt: 1.5,
                display: 'grid',
                gap: 0.2,
                overflowY: 'auto',
                minHeight: 0,
              }}
            >
              {isLoadingConversations ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={24} sx={{ color: 'var(--primary)' }} />
                </Box>
              ) : filteredConversations.length === 0 ? (
                <Box sx={emptyCardStyles}>
                  <Typography sx={{ color: 'var(--text)', fontSize: '0.95rem', mb: 0.5 }}>
                    No matching threads
                  </Typography>
                  <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.6 }}>
                    Start a new conversation or adjust the search filters.
                  </Typography>
                </Box>
              ) : (
                filteredConversations.map((conversation) => {
                  const isSelected = conversationId === conversation.id;
                  const tags = inferConversationTags(conversation);

                  return (
                    <Box
                      key={conversation.id}
                      onClick={() => handleSelectConversation(conversation)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleSelectConversation(conversation);
                        }
                      }}
                      sx={{
                        ...historyCardStyles,
                        ...(isSelected ? activeHistoryCardStyles : {}),
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start' }}>
                        <Typography sx={historyTitleStyles}>
                          {getConversationTitle(conversation)}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={(event) => handleDeleteConversation(conversation.id, event)}
                          sx={{
                            color: 'var(--text-muted)',
                            p: 0.25,
                            mt: -0.25,
                            '&:hover': {
                              color: 'var(--error)',
                              backgroundColor: 'rgba(var(--primary-rgb), 0.06)',
                            },
                          }}
                        >
                          <DeleteOutline sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Box>
                      <Typography sx={historyCopyStyles}>
                        {getConversationPreview(conversation)}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mt: 1 }}>
                        {tags.map((tag) => (
                          <Box key={tag} sx={historyTagStyles}>
                            {tag}
                          </Box>
                        ))}
                      </Box>
                      <Typography sx={historyMetaStyles}>
                        {formatUpdatedAt(conversation.updated_at)}
                      </Typography>
                    </Box>
                  );
                })
              )}
            </Box>
          </Box>

          <Box sx={{ ...panelStyles, ...conversationShellStyles }}>
            <Box sx={panelHeaderStyles}>
              <Box>
                <Typography sx={panelEyebrowStyles}>Current Thread</Typography>
                <Typography sx={panelTitleStyles}>
                  {selectedConversation ? getConversationTitle(selectedConversation) : 'Start a new conversation'}
                </Typography>
              </Box>
            </Box>

            <Box
              sx={{
                px: { xs: 1.25, md: 2 },
                pb: { xs: 1.25, md: 1.75 },
                display: 'grid',
                gridTemplateRows: '1fr auto',
                gap: 1.5,
                minHeight: 0,
                height: 'calc(100% - 72px)',
              }}
            >
              {error && (
                <Box
                  sx={{
                    border: '1px solid color-mix(in srgb, var(--error) 34%, transparent)',
                    backgroundColor: 'color-mix(in srgb, var(--error) 12%, transparent)',
                    color: 'var(--text)',
                    borderRadius: '14px',
                    px: 1.5,
                    py: 1.1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                  }}
                >
                  <Typography sx={{ fontSize: '0.82rem' }}>{error}</Typography>
                  <IconButton size="small" onClick={() => setError(null)} sx={{ color: 'inherit' }}>
                    <Close sx={{ fontSize: 18 }} />
                  </IconButton>
                </Box>
              )}

              <Box
                sx={{
                  minHeight: 0,
                  overflowY: 'auto',
                  display: 'grid',
                  gap: 2.2,
                  px: { xs: 0.75, md: 1.5 },
                  pr: { xs: 0.75, md: 2 },
                  alignContent: messages.length === 0 && !isLoading ? 'center' : 'start',
                }}
              >
                {messages.length === 0 && !isLoading ? (
                  <Box
                    sx={{
                      maxWidth: 720,
                      mx: 'auto',
                      textAlign: 'center',
                      py: 4,
                    }}
                  >
                    <Box
                      sx={{
                        width: 54,
                        height: 54,
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                        backgroundColor: 'rgba(var(--primary-rgb), 0.08)',
                      }}
                    >
                      <AutoAwesome sx={{ color: 'var(--primary)', fontSize: 28 }} />
                    </Box>
                    <Typography
                      sx={{
                        color: 'var(--text)',
                        fontFamily: 'var(--font-heading)',
                        fontSize: { xs: '1.8rem', md: '2.2rem' },
                        mb: 0.75,
                      }}
                    >
                      Welcome to ADAL Chat
                    </Typography>
                    <Typography
                      sx={{
                        color: 'var(--text-secondary)',
                        fontSize: '0.88rem',
                        lineHeight: 1.7,
                        maxWidth: 600,
                        mx: 'auto',
                      }}
                    >
                      Ask focused follow-up questions, refine arguments, or continue a saved legal thread without losing the surrounding context.
                    </Typography>
                  </Box>
                ) : (
                  messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))
                )}

                {isLoading && <LegalProcessCard />}
                <div ref={messagesEndRef} />
              </Box>

                <Box sx={composerStyles}>
                  <Box
                    component="textarea"
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask ADAL to refine, summarize, compare authorities, or continue the current thread."
                  disabled={isLoading || isTyping}
                  sx={composeBoxStyles}
                />

                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 1,
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    flexDirection: { xs: 'column', sm: 'row' },
                  }}
                >
                  <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>
                    {conversationId
                      ? 'Continue the selected thread or start a new one from the header.'
                      : 'A new thread will be created when you send your first message.'}
                  </Typography>

                  {isTyping ? (
                    <Button
                      variant="outlined"
                      startIcon={<StopCircle />}
                      onClick={handleStopGenerating}
                      sx={{
                        ...topActionButtonStyles,
                        minWidth: 144,
                        borderColor: 'color-mix(in srgb, var(--error) 28%, transparent)',
                        color: 'var(--error)',
                      }}
                    >
                      Stop
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      endIcon={isLoading ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <Send />}
                      onClick={handleSendMessage}
                      disabled={!inputValue.trim() || isLoading}
                      sx={{ ...primaryActionButtonStyles, minWidth: 144 }}
                    >
                      Send
                    </Button>
                  )}
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

const MessageBubble = ({ message }) => {
  const isUser = message.type === 'user';
  const sourceTitles = Array.isArray(message.metadata?.sources_found)
    ? message.metadata.sources_found.map((source) => source.title).filter(Boolean)
    : [];

  const markdownComponents = {
    p: ({ node, ...props }) => (
        <Typography
        sx={{
          color: isUser ? 'inherit' : 'var(--text-secondary)',
          fontSize: '0.84rem',
          lineHeight: 1.72,
          mb: 1.25,
          '&:last-child': { mb: 0 },
        }}
        {...props}
      />
    ),
    h1: ({ node, ...props }) => (
      <Typography
        sx={{
          color: 'var(--text)',
          fontFamily: 'var(--font-heading)',
          fontSize: '1.55rem',
          mt: 1.2,
          mb: 0.8,
        }}
        {...props}
      />
    ),
    h2: ({ node, ...props }) => (
      <Typography
        sx={{
          color: 'var(--text)',
          fontFamily: 'var(--font-heading)',
          fontSize: '1.28rem',
          mt: 1.1,
          mb: 0.7,
        }}
        {...props}
      />
    ),
    h3: ({ node, ...props }) => (
      <Typography
        sx={{
          color: 'var(--primary)',
          fontSize: '0.66rem',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          mt: 1.1,
          mb: 0.45,
        }}
        {...props}
      />
    ),
    ul: ({ node, ...props }) => (
      <Box component="ul" sx={{ pl: 2.2, my: 0.8 }} {...props} />
    ),
    ol: ({ node, ...props }) => (
      <Box component="ol" sx={{ pl: 2.2, my: 0.8 }} {...props} />
    ),
    li: ({ node, ...props }) => (
      <Typography
        component="li"
        sx={{
          color: isUser ? 'inherit' : 'var(--text-secondary)',
          fontSize: '0.84rem',
          lineHeight: 1.7,
          mb: 0.45,
        }}
        {...props}
      />
    ),
    strong: ({ node, ...props }) => (
      <Box component="strong" sx={{ color: isUser ? 'inherit' : 'var(--text)', fontWeight: 600 }} {...props} />
    ),
    blockquote: ({ node, ...props }) => (
      <Box
        component="blockquote"
        sx={{
          m: 0,
          mt: 1,
          pl: 1.4,
          borderLeft: '2px solid rgba(var(--primary-rgb), 0.3)',
          color: isUser ? 'inherit' : 'var(--text-secondary)',
        }}
        {...props}
      />
    ),
    code: ({ inline, node, ...props }) =>
      inline ? (
        <Box
          component="code"
          sx={{
            px: 0.55,
            py: 0.1,
            borderRadius: '6px',
            backgroundColor: isUser ? 'rgba(255,255,255,0.12)' : 'rgba(var(--primary-rgb), 0.08)',
            fontFamily: 'monospace',
            fontSize: '0.8em',
          }}
          {...props}
        />
      ) : (
        <Box
          component="pre"
          sx={{
            m: 0,
            mt: 1,
            p: 1.2,
            borderRadius: '12px',
            backgroundColor: isUser ? 'rgba(255,255,255,0.12)' : 'var(--surface-alt)',
            overflowX: 'auto',
          }}
        >
          <code {...props} />
        </Box>
      ),
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: isUser ? 'row-reverse' : 'row',
          alignItems: 'flex-start',
          gap: 1.25,
          width: '100%',
          maxWidth: 920,
          justifyContent: 'flex-start',
        }}
      >
        <Box sx={isUser ? userAvatarStyles : aiAvatarStyles}>
          {isUser ? (
            <Typography sx={{ fontSize: '0.63rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              You
            </Typography>
          ) : (
            <AdalLogo variant="icon" height={22} />
          )}
        </Box>

        <Box
          sx={{
            ...messageBubbleStyles,
            ...(isUser ? userMessageBubbleStyles : aiMessageBubbleStyles),
          }}
        >
          {!isUser && (
            <Typography
              sx={{
                color: 'var(--text)',
                fontSize: '0.74rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                mb: 0.6,
              }}
            >
              ADAL
            </Typography>
          )}

          {isUser ? (
            <Typography sx={{ fontSize: '0.84rem', lineHeight: 1.68, whiteSpace: 'pre-wrap' }}>
              {message.content}
            </Typography>
          ) : (
            <Box sx={{ '& > *:last-child': { mb: 0 } }}>
              <ReactMarkdown components={markdownComponents}>{message.content}</ReactMarkdown>
            </Box>
          )}

          {!isUser && sourceTitles.length > 0 && (
            <Box
              sx={{
                mt: 1,
                pt: 1,
                borderTop: '1px solid rgba(var(--primary-rgb), 0.12)',
              }}
            >
              <Typography
                sx={{
                  color: 'var(--primary)',
                  fontSize: '0.62rem',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  mb: 0.55,
                }}
              >
                Sources
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.55 }}>
                {sourceTitles.map((title) => (
                  <Chip
                    key={title}
                    label={title}
                    size="small"
                    sx={{
                      backgroundColor: 'rgba(var(--primary-rgb), 0.05)',
                      color: 'var(--text-secondary)',
                      border: '1px solid rgba(var(--primary-rgb), 0.16)',
                      height: 26,
                      '.MuiChip-label': {
                        px: 1,
                        fontSize: '0.65rem',
                      },
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

const panelStyles = {
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: 'transparent',
  position: 'relative',
  overflow: 'hidden',
};

const historySidebarStyles = {
  borderRight: { xs: 'none', lg: '1px solid var(--border)' },
  backgroundColor: { xs: 'var(--surface-overlay)', lg: 'transparent' },
};

const conversationShellStyles = {
  backgroundColor: 'transparent',
};

const panelHeaderStyles = {
  px: { xs: 2, md: 2.5 },
  pt: { xs: 1.5, md: 1.75 },
  pb: 1,
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: 1,
  position: 'relative',
  zIndex: 1,
};

const panelEyebrowStyles = {
  color: 'var(--text-muted)',
  fontSize: '0.62rem',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
};

const panelTitleStyles = {
  color: 'var(--text)',
  fontFamily: 'var(--font-heading)',
  fontSize: { xs: '1.05rem', md: '1.18rem' },
  lineHeight: 1,
  mt: 0.35,
};

const topActionButtonStyles = {
  minHeight: 38,
  px: 1.4,
  borderRadius: '10px',
  borderColor: 'var(--border)',
  backgroundColor: 'var(--bg-secondary)',
  color: 'var(--text)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontSize: '0.74rem',
  '&:hover': {
    borderColor: 'rgba(var(--primary-rgb), 0.28)',
    backgroundColor: 'rgba(var(--primary-rgb), 0.06)',
  },
};

const primaryActionButtonStyles = {
  minHeight: 38,
  px: 1.5,
  borderRadius: '10px',
  backgroundColor: 'var(--primary)',
  color: '#fff',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontSize: '0.74rem',
  boxShadow: '0 10px 20px rgba(var(--primary-rgb), 0.24)',
  '&:hover': {
    backgroundColor: 'var(--primary-hover)',
    boxShadow: '0 12px 24px rgba(var(--primary-rgb), 0.28)',
  },
  '&:disabled': {
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.45)',
  },
};

const miniActionButtonStyles = {
  minHeight: 30,
  px: 1.1,
  borderRadius: '999px',
  border: '1px solid var(--border)',
  backgroundColor: 'rgba(var(--primary-rgb), 0.04)',
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontSize: '0.66rem',
  '&:hover': {
    backgroundColor: 'rgba(var(--primary-rgb), 0.09)',
    borderColor: 'rgba(var(--primary-rgb), 0.24)',
  },
};

const threadSearchStyles = {
  width: '100%',
  minHeight: 40,
  border: '1px solid var(--border)',
  borderRadius: '12px',
  backgroundColor: 'var(--surface-alt)',
  color: 'var(--text)',
  px: 1.1,
  fontSize: '0.76rem',
  outline: 'none',
  '&::placeholder': {
    color: 'var(--text-muted)',
    opacity: 1,
  },
  '&:focus': {
    borderColor: 'rgba(var(--primary-rgb), 0.28)',
    backgroundColor: 'rgba(var(--primary-rgb), 0.05)',
  },
};

const threadChipStyles = {
  appearance: 'none',
  border: '1px solid var(--border)',
  borderRadius: '999px',
  backgroundColor: 'rgba(var(--primary-rgb), 0.04)',
  color: 'var(--text-secondary)',
  px: 1,
  py: 0.45,
  fontSize: '0.64rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  cursor: 'pointer',
};

const activeThreadChipStyles = {
  backgroundColor: 'rgba(var(--primary-rgb), 0.12)',
  borderColor: 'rgba(var(--primary-rgb), 0.26)',
  color: 'var(--text)',
};

const historyCardStyles = {
  width: '100%',
  textAlign: 'left',
  border: 'none',
  borderLeft: '2px solid transparent',
  borderRadius: '14px',
  backgroundColor: 'transparent',
  p: 1.2,
  cursor: 'pointer',
  transition: 'background-color 0.18s ease, border-color 0.18s ease',
  '&:hover': {
    backgroundColor: 'rgba(var(--primary-rgb), 0.04)',
    borderLeftColor: 'rgba(var(--primary-rgb), 0.2)',
  },
};

const activeHistoryCardStyles = {
  backgroundColor: 'rgba(var(--primary-rgb), 0.08)',
  borderLeftColor: 'var(--primary)',
};

const historyTitleStyles = {
  color: 'var(--text)',
  fontSize: '0.86rem',
  lineHeight: 1.4,
  pr: 1,
};

const historyCopyStyles = {
  color: 'var(--text-secondary)',
  fontSize: '0.74rem',
  lineHeight: 1.7,
  mt: 0.35,
  display: '-webkit-box',
  overflow: 'hidden',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
};

const historyTagStyles = {
  border: '1px solid var(--border)',
  borderRadius: '999px',
  px: 0.8,
  py: 0.32,
  fontSize: '0.6rem',
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  backgroundColor: 'rgba(var(--primary-rgb), 0.04)',
};

const historyMetaStyles = {
  color: 'var(--text-muted)',
  fontSize: '0.64rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  mt: 1,
};

const composerStyles = {
  width: '100%',
  maxWidth: 920,
  mx: 'auto',
  border: '1px solid var(--border)',
  borderRadius: '22px',
  backgroundColor: 'var(--surface)',
  boxShadow: '0 16px 32px rgba(0, 0, 0, 0.18)',
  p: { xs: 1.25, md: 1.4 },
  display: 'grid',
  gap: 0.95,
};

const composeBoxStyles = {
  width: '100%',
  minHeight: 88,
  resize: 'none',
  border: 'none',
  borderRadius: '16px',
  backgroundColor: 'transparent',
  color: 'var(--text)',
  p: 0.4,
  fontSize: '0.92rem',
  lineHeight: 1.65,
  outline: 'none',
  fontFamily: 'var(--font-body)',
  '&::placeholder': {
    color: 'var(--text-muted)',
    opacity: 1,
  },
  '&:focus': {
    outline: 'none',
  },
  '&:disabled': {
    opacity: 0.65,
  },
};

const emptyCardStyles = {
  border: '1px dashed var(--border)',
  borderRadius: '16px',
  p: 1.6,
  backgroundColor: 'rgba(var(--primary-rgb), 0.03)',
};

const aiAvatarStyles = {
  width: 32,
  height: 32,
  borderRadius: '10px',
  border: '1px solid rgba(var(--primary-rgb), 0.24)',
  background: 'rgba(var(--primary-rgb), 0.08)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  p: 0.75,
  overflow: 'hidden',
};

const userAvatarStyles = {
  width: 32,
  height: 32,
  borderRadius: '999px',
  border: '1px solid rgba(var(--primary-rgb), 0.22)',
  backgroundColor: 'var(--primary)',
  color: 'var(--mui-primary-contrast)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const messageBubbleStyles = {
  maxWidth: { xs: 'min(100%, calc(100vw - 92px))', md: '78%' },
  borderRadius: '18px',
  px: 1.35,
  py: 1.15,
};

const userMessageBubbleStyles = {
  backgroundColor: 'var(--primary)',
  border: '1px solid var(--primary)',
  color: 'var(--mui-primary-contrast)',
  boxShadow: '0 10px 22px rgba(var(--primary-rgb), 0.18)',
};

const aiMessageBubbleStyles = {
  maxWidth: 'min(100%, 820px)',
  backgroundColor: 'transparent',
  border: 'none',
  px: 0,
  py: 0,
  color: 'var(--text-secondary)',
};

export default ChatPage;
