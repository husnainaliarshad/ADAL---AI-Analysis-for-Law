import React, { useCallback, useEffect, useState } from 'react';
import { FileStack, LibraryBig, Plus, RefreshCw } from 'lucide-react';
import draftingApi from '../../../services/draftingService';

const formatUpdatedAt = (value) => {
  if (!value) return 'Unknown time';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const DraftingResourceSidebar = ({
  activeDraftId: parentActiveDraftId,
  draftsRefreshToken,
  onLoadDocument,
  onNewDocument,
  onError,
}) => {
  const [expandedSections, setExpandedSections] = useState({
    templates: true,
    myDrafts: true,
  });
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState(parentActiveDraftId);
  const [renamingDraftId, setRenamingDraftId] = useState(null);
  const [renamingValue, setRenamingValue] = useState('');

  useEffect(() => {
    setActiveDraftId(parentActiveDraftId);
  }, [parentActiveDraftId]);

  const fetchDrafts = useCallback(async () => {
    setLoadingDrafts(true);
    try {
      const list = await draftingApi.getDraftHistory();
      setDrafts(list || []);
    } catch (error) {
      console.error('[DraftingResourceSidebar] Error fetching drafts:', error);
      onError?.('Failed to load saved drafts.');
    } finally {
      setLoadingDrafts(false);
    }
  }, [onError]);

  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const list = await draftingApi.getTemplates();
      setTemplates(list || []);
    } catch (error) {
      console.error('[DraftingResourceSidebar] Error fetching templates:', error);
      onError?.('Failed to load legal templates.');
    } finally {
      setLoadingTemplates(false);
    }
  }, [onError]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    fetchDrafts();
  }, [draftsRefreshToken, fetchDrafts]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchDrafts();
    window.setTimeout(() => setIsRefreshing(false), 500);
  };

  const loadDraft = async (draftId) => {
    if (renamingDraftId) return;

    const selectedDraft = drafts.find((draft) => draft.id === draftId);
    setActiveDraftId(draftId);

    try {
      const draftData = await draftingApi.getDraftContent(draftId);
      onLoadDocument?.(
        draftData.content_html || '<h1>Empty Draft</h1>',
        draftData.title || 'Untitled Draft',
        draftData.id,
        {
          lastSavedAt: draftData.updated_at || selectedDraft?.updated_at || null,
        }
      );
    } catch (error) {
      console.error('[DraftingResourceSidebar] Error loading draft:', error);
      setActiveDraftId(parentActiveDraftId || null);
      onError?.('Failed to load the selected draft.');
    }
  };

  const loadTemplate = async (templateId) => {
    try {
      const templateData = await draftingApi.getTemplateContent(templateId);
      onLoadDocument?.(
        templateData.content_html,
        templateData.title,
        null,
        { lastSavedAt: null }
      );
    } catch (error) {
      console.error('[DraftingResourceSidebar] Error loading template:', error);
      onError?.('Failed to load the selected template.');
    }
  };

  const startRenaming = (event, draft) => {
    event.stopPropagation();
    setRenamingDraftId(draft.id);
    setRenamingValue(draft.title || '');
  };

  const cancelRenaming = (event) => {
    event?.stopPropagation();
    setRenamingDraftId(null);
    setRenamingValue('');
  };

  const confirmRename = async (event) => {
    event.stopPropagation();
    if (!renamingValue.trim()) return;

    try {
      await draftingApi.renameDraft(renamingDraftId, renamingValue.trim());
      setDrafts((currentDrafts) => currentDrafts.map((draft) => (
        draft.id === renamingDraftId
          ? { ...draft, title: renamingValue.trim() }
          : draft
      )));
      cancelRenaming();
    } catch (error) {
      console.error('[DraftingResourceSidebar] Failed to rename draft:', error);
      onError?.('Failed to rename draft.');
    }
  };

  const handleDelete = async (event, draftId) => {
    event.stopPropagation();

    if (!window.confirm('Delete this draft permanently? This cannot be undone.')) {
      return;
    }

    try {
      await draftingApi.deleteDraft(draftId);
      setDrafts((currentDrafts) => currentDrafts.filter((draft) => draft.id !== draftId));

      if (activeDraftId === draftId) {
        onNewDocument?.();
      }
    } catch (error) {
      console.error('[DraftingResourceSidebar] Failed to delete draft:', error);
      onError?.('Failed to delete draft.');
    }
  };

  const toggleSection = (section) => {
    setExpandedSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  return (
    <div className="resources-section">
      <div className="resources-shell-header">
        <div className="resources-shell-kicker">Workspace</div>
        <h2 className="resources-header">Draft Resources</h2>
        <p className="resources-shell-copy">
          Move between templates, reopen saved drafts, and keep the working document anchored.
        </p>
      </div>

      <div className="resources-block">
        <button
          type="button"
          onClick={() => toggleSection('templates')}
          className="resources-section-button"
        >
          <span className="resources-section-label">
            <LibraryBig size={14} />
            Legal templates
          </span>
          <span>{expandedSections.templates ? 'Hide' : 'Show'}</span>
        </button>

        {expandedSections.templates && (
          <div className="resources-list">
            {loadingTemplates ? (
              <div className="resources-empty-state">Loading templates...</div>
            ) : templates.length === 0 ? (
              <div className="resources-empty-state">No templates available.</div>
            ) : (
              templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className="resources-item resources-item-button"
                  onClick={() => loadTemplate(template.id)}
                >
                  <div className="resources-item-title">{template.title}</div>
                  <div className="resources-item-desc">{template.description}</div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="resources-block">
        <div className="resources-section-row">
          <button
            type="button"
            onClick={() => toggleSection('myDrafts')}
            className="resources-section-button"
          >
            <span className="resources-section-label">
              <FileStack size={14} />
              My drafts
            </span>
            <span>{expandedSections.myDrafts ? 'Hide' : 'Show'}</span>
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            className="drafts-refresh-btn"
            disabled={isRefreshing}
            title="Refresh drafts"
          >
            <RefreshCw size={13} className={isRefreshing ? 'is-spinning' : ''} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {expandedSections.myDrafts && (
          <div className="resources-list">
            <button type="button" className="new-draft-btn" onClick={onNewDocument}>
              <Plus size={13} />
              New document
            </button>

            {loadingDrafts ? (
              <div className="resources-empty-state">Loading drafts...</div>
            ) : drafts.length === 0 ? (
              <div className="resources-empty-state">No drafts yet. Save a document to see it here.</div>
            ) : (
              drafts.map((draft) => (
                <div
                  key={draft.id}
                  className={`resources-item ${activeDraftId === draft.id ? 'resources-item-active' : ''}`}
                  onClick={() => loadDraft(draft.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      loadDraft(draft.id);
                    }
                  }}
                >
                  {renamingDraftId === draft.id ? (
                    <div className="draft-inline-actions" onClick={(event) => event.stopPropagation()}>
                      <input
                        className="rename-input"
                        value={renamingValue}
                        onChange={(event) => setRenamingValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            confirmRename(event);
                          }
                        }}
                        autoFocus
                      />
                      <button type="button" className="draft-action-button" onClick={confirmRename}>
                        Save
                      </button>
                      <button type="button" className="draft-action-button" onClick={cancelRenaming}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="resources-item-header">
                        <div className="resources-item-title">{draft.title || 'Untitled draft'}</div>
                        <div className="draft-actions">
                          <button
                            type="button"
                            className="draft-action-button"
                            onClick={(event) => startRenaming(event, draft)}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            className="draft-action-button danger"
                            onClick={(event) => handleDelete(event, draft.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <div className="resources-item-desc">{formatUpdatedAt(draft.updated_at)}</div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DraftingResourceSidebar;
