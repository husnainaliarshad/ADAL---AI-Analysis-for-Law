import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import DraftingResourceSidebar from './components/DraftingResourceSidebar';
import DraftingEditor from './components/DraftingEditor';
import DraftingAISidebar from './components/DraftingAISidebar';
import DashboardLayout from '../Dashboard/DashboardLayout';
import draftingApi from '../../services/draftingService';
import './DraftingAssistantPage.css';

const AUTOSAVE_DELAY_MS = 1500;
const STARTER_HTML = '<h1>Board Resolution</h1><p>Enter your legal draft here...</p>';
const NEW_DOCUMENT_HTML = '<h1>Untitled Document</h1><p>Enter your legal draft here...</p>';

const buildWelcomeMessages = (message) => ([
  {
    id: 'welcome',
    type: 'assistant',
    content: message,
    proposalStatus: 'none',
    sources: [],
  },
]);

const normalizeErrorDetails = (error) => {
  const detail = error?.response?.data?.detail || error?.message || 'Unknown error';
  if (typeof detail === 'string') {
    return detail;
  }
  try {
    return JSON.stringify(detail, null, 2);
  } catch {
    return String(detail);
  }
};

const buildFriendlyAssistantError = (error) => ({
  content: "I couldn't complete that drafting step. Review the technical details below and try again.",
  technicalDetails: normalizeErrorDetails(error),
});

const formatSavedTime = (timestamp) => {
  if (!timestamp) return '';
  try {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
};

const DraftingAssistantPage = () => {
  const [currentHtml, setCurrentHtml] = useState(STARTER_HTML);
  const [lastSavedHtml, setLastSavedHtml] = useState(STARTER_HTML);
  const [documentTitle, setDocumentTitle] = useState('Board Resolution');
  const [lastSavedTitle, setLastSavedTitle] = useState('Board Resolution');
  const [draftId, setDraftId] = useState(null);
  const [editorInstance, setEditorInstance] = useState(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [pageError, setPageError] = useState('');
  const [pendingAiProposal, setPendingAiProposal] = useState(null);
  const [draftsRefreshToken, setDraftsRefreshToken] = useState(0);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [versions, setVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  const [isRestoringVersion, setIsRestoringVersion] = useState(false);

  const [messages, setMessages] = useState(() => buildWelcomeMessages(
    "Hello! I'm your AI drafting assistant. I can help you with legal document drafting, template suggestions, and content improvements. How can I assist you today?"
  ));
  const [lastUserPrompt, setLastUserPrompt] = useState('');

  const autosaveTimerRef = useRef(null);
  const currentHtmlRef = useRef(currentHtml);
  const lastSavedHtmlRef = useRef(lastSavedHtml);
  const titleRef = useRef(documentTitle);
  const lastSavedTitleRef = useRef(lastSavedTitle);
  const draftIdRef = useRef(draftId);
  const lastSavedAtRef = useRef(lastSavedAt);

  useEffect(() => {
    currentHtmlRef.current = currentHtml;
  }, [currentHtml]);

  useEffect(() => {
    lastSavedHtmlRef.current = lastSavedHtml;
  }, [lastSavedHtml]);

  useEffect(() => {
    titleRef.current = documentTitle;
  }, [documentTitle]);

  useEffect(() => {
    lastSavedTitleRef.current = lastSavedTitle;
  }, [lastSavedTitle]);

  useEffect(() => {
    draftIdRef.current = draftId;
  }, [draftId]);

  useEffect(() => {
    lastSavedAtRef.current = lastSavedAt;
  }, [lastSavedAt]);

  useEffect(() => () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
  }, []);

  const handleDocumentLoad = useCallback((html, title, id = null, options = {}) => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    const normalizedId = id ? String(id) : null;
    const safeHtml = html || NEW_DOCUMENT_HTML;
    const safeTitle = title || 'Untitled Document';

    setCurrentHtml(safeHtml);
    setLastSavedHtml(safeHtml);
    setDocumentTitle(safeTitle);
    setLastSavedTitle(safeTitle);
    setDraftId(normalizedId);
    setPendingAiProposal(null);
    setHasSelection(false);
    setIsDirty(false);
    setPageError('');
    setLastSavedAt(options.lastSavedAt || null);
    setSaveStatus(options.lastSavedAt ? 'saved' : 'idle');
    setResetKey((prev) => prev + 1);
  }, []);

  const saveDocument = useCallback(async (providedHtml = null, providedTitle = null, providedDraftId = null) => {
    if (isSaving) return null;

    const htmlToSave = providedHtml ?? currentHtmlRef.current;
    if (!htmlToSave) return null;

    setIsSaving(true);
    setSaveStatus('saving');
    setPageError('');

    try {
      const titleToSave = (providedTitle ?? titleRef.current ?? '').trim() || 'Untitled Document';
      const activeDraftId = providedDraftId ?? draftIdRef.current;
      const result = await draftingApi.processDocument(titleToSave, htmlToSave, activeDraftId);
      const resolvedDraftId = result?.draft_id ? String(result.draft_id) : activeDraftId;
      const savedAt = new Date().toISOString();

      setDraftId(resolvedDraftId || null);
      setDocumentTitle(titleToSave);
      setLastSavedTitle(titleToSave);
      setLastSavedHtml(htmlToSave);
      setIsDirty(false);
      setSaveStatus('saved');
      setLastSavedAt(savedAt);
      setDraftsRefreshToken((prev) => prev + 1);

      return {
        result,
        savedAt,
        draftId: resolvedDraftId || null,
      };
    } catch (error) {
      console.error('[DraftingAssistantPage] Save error:', error);
      setSaveStatus('error');
      setPageError('Failed to save document. Your changes are still available locally.');
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [isSaving]);

  const handleEditorChange = useCallback((nextHtml) => {
    setCurrentHtml(nextHtml);

    const nextDirty = (
      nextHtml !== lastSavedHtmlRef.current
      || titleRef.current !== lastSavedTitleRef.current
    );
    setIsDirty(nextDirty);

    if (nextDirty) {
      setSaveStatus('unsaved');
    } else if (lastSavedAtRef.current) {
      setSaveStatus('saved');
    } else {
      setSaveStatus('idle');
    }
  }, []);

  const handleTitleChange = useCallback((nextTitle) => {
    setDocumentTitle(nextTitle);

    const nextDirty = (
      currentHtmlRef.current !== lastSavedHtmlRef.current
      || nextTitle !== lastSavedTitleRef.current
    );
    setIsDirty(nextDirty);

    if (nextDirty) {
      setSaveStatus('unsaved');
    } else if (lastSavedAtRef.current) {
      setSaveStatus('saved');
    } else {
      setSaveStatus('idle');
    }
  }, []);

  useEffect(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    if (!editorInstance || !isDirty || isSaving || pendingAiProposal) {
      return undefined;
    }

    autosaveTimerRef.current = setTimeout(() => {
      saveDocument();
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [currentHtml, documentTitle, editorInstance, isDirty, isSaving, pendingAiProposal, saveDocument]);

  const loadVersions = useCallback(async (targetDraftId = draftIdRef.current) => {
    if (!targetDraftId) {
      setVersions([]);
      setSelectedVersionId(null);
      return [];
    }

    setVersionsLoading(true);
    try {
      const list = await draftingApi.getDraftVersions(targetDraftId);
      setVersions(list || []);
      setSelectedVersionId((currentSelection) => {
        if (list?.some((version) => version.id === currentSelection)) {
          return currentSelection;
        }
        return list?.[0]?.id || null;
      });
      return list || [];
    } catch (error) {
      console.error('[DraftingAssistantPage] Version list error:', error);
      setPageError('Failed to load version history.');
      return [];
    } finally {
      setVersionsLoading(false);
    }
  }, []);

  const handleOpenVersionHistory = useCallback(async () => {
    if (!draftIdRef.current) {
      setPageError('Save the draft first to access version history.');
      return;
    }
    setIsVersionHistoryOpen(true);
    await loadVersions(draftIdRef.current);
  }, [loadVersions]);

  const handleCloseVersionHistory = useCallback(() => {
    setIsVersionHistoryOpen(false);
  }, []);

  const handleRestoreVersion = useCallback(async (versionId) => {
    if (!draftIdRef.current || !versionId) return;

    setIsRestoringVersion(true);
    setPageError('');

    try {
      const restored = await draftingApi.restoreDraftVersion(draftIdRef.current, versionId);
      handleDocumentLoad(
        restored.content_html || NEW_DOCUMENT_HTML,
        restored.title || titleRef.current || 'Untitled Document',
        restored.draft_id || draftIdRef.current,
        { lastSavedAt: restored.created_at || new Date().toISOString() }
      );
      setDraftsRefreshToken((prev) => prev + 1);
      setIsVersionHistoryOpen(false);
    } catch (error) {
      console.error('[DraftingAssistantPage] Restore error:', error);
      setPageError('Failed to restore that version.');
    } finally {
      setIsRestoringVersion(false);
    }
  }, [handleDocumentLoad]);

  const updateProposalStatus = useCallback((messageId, proposalStatus) => {
    setMessages((prev) => prev.map((message) => (
      message.id === messageId
        ? { ...message, proposalStatus }
        : message
    )));
  }, []);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!draftId) {
        setMessages(buildWelcomeMessages(
          "Hello! I'm your AI drafting assistant. I can help you with legal document drafting, template suggestions, and content improvements. How can I assist you today?"
        ));
        return;
      }

      try {
        const history = await draftingApi.getChatHistory(draftId);
        if (history && history.length > 0) {
          setMessages(history.map((message) => ({
            ...message,
            proposalStatus: message.proposalStatus || 'none',
            sources: message.sources || [],
          })));
        } else {
          setMessages(buildWelcomeMessages(
            "Hello again! I'm ready to continue helping you with this document. What can I help you with?"
          ));
        }
      } catch (error) {
        console.error('[DraftingAssistantPage] Failed to fetch chat history:', error);
        setMessages(buildWelcomeMessages(
          "I'm ready to help with this document. Ask for a clause, rewrite, or drafting improvement to continue."
        ));
      }
    };

    fetchHistory();
  }, [draftId]);

  const handleSendMessageToAI = async (retryPrompt = null, currentInput = '') => {
    const promptToSend = retryPrompt || currentInput;
    if (!promptToSend.trim()) return;

    if (pendingAiProposal) {
      setPageError('Review or reject the current AI proposal before requesting another drafting step.');
      return;
    }

    if (!editorInstance) {
      setPageError('The editor is still loading. Please try again in a moment.');
      return;
    }

    const contextHtml = editorInstance.getHTML();
    const userMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: promptToSend,
      proposalStatus: 'none',
      sources: [],
    };

    setLastUserPrompt(promptToSend);
    setMessages((prev) => [...prev, userMessage]);
    setIsThinking(true);
    setPageError('');

    try {
      const response = await draftingApi.sendChat(promptToSend, contextHtml, draftIdRef.current);
      const assistantMessageId = `assistant-${Date.now()}`;
      const deliveryMode = response.delivery_mode || (response.html_to_insert ? 'editor' : 'chat');
      const hasProposal = deliveryMode === 'editor' && Boolean(response.html_to_insert);

      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          type: 'assistant',
          content: response.reply || 'Drafting step completed.',
          sources: response.sources || [],
          proposalStatus: hasProposal ? 'pending' : 'none',
        },
      ]);

      if (hasProposal) {
        setPendingAiProposal({
          html: response.html_to_insert,
          sources: response.sources || [],
          messageId: assistantMessageId,
        });
      }
    } catch (error) {
      console.error('[DraftingAssistantPage] Chat error:', error);
      const friendlyError = buildFriendlyAssistantError(error);
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          type: 'assistant',
          content: friendlyError.content,
          technicalDetails: friendlyError.technicalDetails,
          isError: true,
          proposalStatus: 'none',
          sources: [],
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleRejectProposal = useCallback(() => {
    if (!pendingAiProposal) return;

    updateProposalStatus(pendingAiProposal.messageId, 'rejected');
    setPendingAiProposal(null);
    setPageError('');
  }, [pendingAiProposal, updateProposalStatus]);

  const handleApplyProposal = useCallback(async (mode) => {
    const proposal = pendingAiProposal;
    if (!proposal || !editorInstance) return;

    if (mode === 'replace-selection' && !hasSelection) {
      return;
    }

    if (mode === 'replace-whole' && !window.confirm('Replace the entire draft with the AI proposal? This will overwrite the current document content.')) {
      return;
    }

    setPageError('');

    if (mode === 'replace-whole') {
      editorInstance.chain().focus().setContent(proposal.html).run();
    } else if (mode === 'replace-selection') {
      editorInstance.chain().focus().insertContent(proposal.html).run();
    } else {
      const cursorPosition = editorInstance.state.selection.to;
      editorInstance.chain().focus().setTextSelection(cursorPosition).insertContent(proposal.html).run();
    }

    const updatedHtml = editorInstance.getHTML();
    setCurrentHtml(updatedHtml);
    setPendingAiProposal(null);
    updateProposalStatus(proposal.messageId, 'accepted');
    await saveDocument(updatedHtml);
  }, [editorInstance, hasSelection, pendingAiProposal, saveDocument, updateProposalStatus]);

  const handleReload = useCallback(async () => {
    if (!draftIdRef.current) return;
    if (!window.confirm('Are you sure you want to reload? Any unsaved changes will be lost.')) return;

    try {
      setIsThinking(true);
      setPageError('');
      const content = await draftingApi.getDraftContent(draftIdRef.current);
      handleDocumentLoad(
        content.content_html || NEW_DOCUMENT_HTML,
        content.title || 'Untitled Document',
        content.id || draftIdRef.current,
        { lastSavedAt: lastSavedAtRef.current }
      );
    } catch (error) {
      console.error('[DraftingAssistantPage] Reload error:', error);
      setPageError('Failed to reload the latest saved version.');
    } finally {
      setIsThinking(false);
    }
  }, [handleDocumentLoad]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveDocument();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveDocument]);

  const handleNewDocument = () => {
    if (isDirty && !window.confirm('You have unsaved changes. Are you sure you want to start a new document?')) {
      return;
    }

    handleDocumentLoad(NEW_DOCUMENT_HTML, 'Untitled Document', null);
  };

  const statusText = (() => {
    if (saveStatus === 'saving') return 'Saving...';
    if (saveStatus === 'error') return 'Save failed';
    if (saveStatus === 'unsaved') return 'Unsaved changes';
    if (saveStatus === 'saved' && lastSavedAt) return `Saved ${formatSavedTime(lastSavedAt)}`;
    return draftId ? 'Draft loaded' : 'Not saved yet';
  })();

  return (
    <DashboardLayout topbarProps={{ notifications: [], unreadCount: 0 }}>
      <div className="drafting-assistant-container">
        <div className={`drafting-panel drafting-panel-left ${isLeftSidebarCollapsed ? 'collapsed' : ''}`}>
          {!isLeftSidebarCollapsed && (
            <DraftingResourceSidebar
              activeDraftId={draftId}
              draftsRefreshToken={draftsRefreshToken}
              onLoadDocument={handleDocumentLoad}
              onNewDocument={handleNewDocument}
              onError={setPageError}
            />
          )}
        <button
          className="sidebar-toggle-btn left"
          onClick={() => setIsLeftSidebarCollapsed(!isLeftSidebarCollapsed)}
          aria-label={isLeftSidebarCollapsed ? 'Expand resources sidebar' : 'Collapse resources sidebar'}
          title={isLeftSidebarCollapsed ? 'Show resources' : 'Hide resources'}
        >
          {isLeftSidebarCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
          <span className="sidebar-toggle-label">
            {isLeftSidebarCollapsed ? 'Show resources' : 'Hide resources'}
          </span>
        </button>
          {isLeftSidebarCollapsed && (
            <div className="collapsed-sidebar-vertical-text">
              <span>RESOURCES</span>
            </div>
          )}
        </div>

        <div className="drafting-panel drafting-panel-center">
          <DraftingEditor
            key={resetKey}
            documentHtml={currentHtml}
            onDocumentChange={handleEditorChange}
            documentTitle={documentTitle}
            setDocumentTitle={handleTitleChange}
            draftId={draftId}
            onEditorReady={setEditorInstance}
            onSelectionChange={setHasSelection}
            isThinking={isThinking}
            onSave={() => saveDocument()}
            onReload={handleReload}
            isSaving={isSaving}
            saveStatus={saveStatus}
            saveStatusText={statusText}
            pageError={pageError}
            pendingAiProposal={pendingAiProposal}
            hasSelection={hasSelection}
            onApplyProposal={handleApplyProposal}
            onRejectProposal={handleRejectProposal}
            isVersionHistoryOpen={isVersionHistoryOpen}
            onOpenVersionHistory={handleOpenVersionHistory}
            onCloseVersionHistory={handleCloseVersionHistory}
            versions={versions}
            versionsLoading={versionsLoading}
            selectedVersionId={selectedVersionId}
            onSelectVersion={setSelectedVersionId}
            onRestoreVersion={handleRestoreVersion}
            isRestoringVersion={isRestoringVersion}
          />
        </div>

        <div className={`drafting-panel drafting-panel-right ${isRightSidebarCollapsed ? 'collapsed' : ''}`}>
          {!isRightSidebarCollapsed && (
            <DraftingAISidebar
              messages={messages}
              lastUserPrompt={lastUserPrompt}
              documentTitle={documentTitle}
              isThinking={isThinking}
              hasPendingProposal={Boolean(pendingAiProposal)}
              onSendMessage={handleSendMessageToAI}
            />
          )}
        <button
          className="sidebar-toggle-btn right"
          onClick={() => setIsRightSidebarCollapsed(!isRightSidebarCollapsed)}
          aria-label={isRightSidebarCollapsed ? 'Expand AI assistant sidebar' : 'Collapse AI assistant sidebar'}
          title={isRightSidebarCollapsed ? 'Show copilot' : 'Hide copilot'}
        >
          {isRightSidebarCollapsed ? <PanelRightOpen size={14} /> : <PanelRightClose size={14} />}
          <span className="sidebar-toggle-label">
            {isRightSidebarCollapsed ? 'Show copilot' : 'Hide copilot'}
          </span>
        </button>
          {isRightSidebarCollapsed && (
            <div className="collapsed-sidebar-vertical-text right">
              <span>AI ASSISTANT</span>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DraftingAssistantPage;
