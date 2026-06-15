import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Strike from '@tiptap/extension-strike';
import Link from '@tiptap/extension-link';
import { History, RefreshCcw, Save } from 'lucide-react';

const ToolbarButton = ({ active = false, disabled = false, label, onClick, title }) => (
  <button
    type="button"
    className={`editor-button ${active ? 'is-active' : ''}`}
    onClick={onClick}
    disabled={disabled}
    title={title || label}
  >
    {label}
  </button>
);

const formatVersionDate = (value) => {
  if (!value) return 'Unknown time';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const DraftingEditor = ({
  documentHtml,
  onDocumentChange,
  documentTitle,
  setDocumentTitle,
  draftId,
  onEditorReady,
  onSelectionChange,
  isThinking,
  onSave,
  onReload,
  isSaving,
  saveStatusText,
  pageError,
  pendingAiProposal,
  hasSelection,
  onApplyProposal,
  onRejectProposal,
  isVersionHistoryOpen,
  onOpenVersionHistory,
  onCloseVersionHistory,
  versions,
  versionsLoading,
  selectedVersionId,
  onSelectVersion,
  onRestoreVersion,
  isRestoringVersion,
}) => {
  const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [isProposalExpanded, setIsProposalExpanded] = useState(false);
  const linkPopoverRef = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: true,
        orderedList: true,
      }),
      Underline,
      Strike,
      Subscript,
      Superscript,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
        defaultAlignment: 'left',
      }),
      Link.configure({
        openOnClick: false,
      }),
    ],
    content: documentHtml,
    editorProps: {
      attributes: {
        class: 'tiptap focus:outline-none',
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      onDocumentChange(activeEditor.getHTML());
    },
    onSelectionUpdate: ({ editor: activeEditor }) => {
      onSelectionChange(!activeEditor.state.selection.empty);
    },
  });

  const selectedVersion = useMemo(
    () => versions.find((version) => version.id === selectedVersionId) || versions[0] || null,
    [selectedVersionId, versions]
  );

  useEffect(() => {
    if (!editor) return undefined;

    onEditorReady(editor);
    onSelectionChange(!editor.state.selection.empty);

    return () => {
      onEditorReady(null);
      onSelectionChange(false);
    };
  }, [editor, onEditorReady, onSelectionChange]);

  useEffect(() => {
    if (!editor) return;
    if (documentHtml !== editor.getHTML()) {
      editor.commands.setContent(documentHtml);
    }
  }, [documentHtml, editor]);

  useEffect(() => {
    if (!isLinkPopoverOpen || !editor) return;
    setLinkValue(editor.getAttributes('link').href || '');
  }, [editor, isLinkPopoverOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (linkPopoverRef.current && !linkPopoverRef.current.contains(event.target)) {
        setIsLinkPopoverOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setIsProposalExpanded(false);
  }, [pendingAiProposal?.messageId]);

  const applyLink = useCallback(() => {
    if (!editor) return;

    if (!linkValue.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkValue.trim() }).run();
    }

    setIsLinkPopoverOpen(false);
  }, [editor, linkValue]);

  const removeLink = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setLinkValue('');
    setIsLinkPopoverOpen(false);
  }, [editor]);

  if (!editor) {
    return <div className="editor-container" />;
  }

  return (
    <div className="editor-container">
      <div className="editor-header">
        <div className="editor-header-main">
          <span className="editor-header-kicker">Drafting workspace</span>
          <input
            type="text"
            value={documentTitle}
            onChange={(event) => setDocumentTitle(event.target.value)}
            placeholder="Document title"
            className="editor-title-input"
          />
          <div className="editor-header-meta">
            <span className="editor-save-status">{saveStatusText}</span>
            <span className="editor-draft-id">
              {draftId ? `Draft ${draftId}` : 'New draft'}
            </span>
            {isThinking && (
              <span className="editor-assistant-chip">
                Assistant preparing a proposal
              </span>
            )}
          </div>
        </div>

        <div className="editor-header-actions">
          <button
            type="button"
            className="editor-header-button"
            onClick={onOpenVersionHistory}
            disabled={!draftId || versionsLoading}
          >
            <History size={14} />
            Version history
          </button>
          <button
            type="button"
            className="editor-header-button"
            onClick={onReload}
            disabled={!draftId || isThinking}
          >
            <RefreshCcw size={14} />
            Reload
          </button>
          <button
            type="button"
            className="editor-header-button primary"
            onClick={onSave}
            disabled={isSaving}
          >
            <Save size={14} />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {pageError && (
        <div className="editor-page-banner" role="alert">
          {pageError}
        </div>
      )}

      <div className="editor-toolbar">
        <div className="editor-toolbar-group">
          <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()} />
          <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()} />
        </div>

        <div className="editor-toolbar-group">
          <ToolbarButton
            label="B"
            title="Bold"
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
          <ToolbarButton
            label="I"
            title="Italic"
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
          <ToolbarButton
            label="U"
            title="Underline"
            active={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          />
          <ToolbarButton
            label="Strike"
            active={editor.isActive('strike')}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          />
        </div>

        <div className="editor-toolbar-group">
          <ToolbarButton
            label="H1"
            active={editor.isActive('heading', { level: 1 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          />
          <ToolbarButton
            label="H2"
            active={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          />
          <ToolbarButton
            label="H3"
            active={editor.isActive('heading', { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          />
        </div>

        <div className="editor-toolbar-group">
          <ToolbarButton
            label="Bullets"
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
          <ToolbarButton
            label="Numbered"
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          />
          <ToolbarButton
            label="Quote"
            active={editor.isActive('blockquote')}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          />
          <ToolbarButton
            label="Rule"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          />
        </div>

        <div className="editor-toolbar-group">
          <ToolbarButton
            label="Left"
            active={editor.isActive({ textAlign: 'left' })}
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
          />
          <ToolbarButton
            label="Center"
            active={editor.isActive({ textAlign: 'center' })}
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
          />
          <ToolbarButton
            label="Right"
            active={editor.isActive({ textAlign: 'right' })}
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
          />
          <ToolbarButton
            label="Justify"
            active={editor.isActive({ textAlign: 'justify' })}
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          />
        </div>

        <div className="editor-toolbar-group" ref={linkPopoverRef}>
          <ToolbarButton
            label="Link"
            active={editor.isActive('link') || isLinkPopoverOpen}
            onClick={() => setIsLinkPopoverOpen((current) => !current)}
          />

          {isLinkPopoverOpen && (
            <div className="editor-link-popover">
              <label className="editor-link-label" htmlFor="draft-link-input">
                Link URL
              </label>
              <input
                id="draft-link-input"
                type="url"
                value={linkValue}
                onChange={(event) => setLinkValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    applyLink();
                  }
                }}
                placeholder="https://example.com"
                className="editor-link-input"
              />
              <div className="editor-link-actions">
                <button type="button" className="editor-header-button primary" onClick={applyLink}>
                  Apply
                </button>
                <button type="button" className="editor-header-button" onClick={removeLink}>
                  Remove
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="editor-document-container">
        {pendingAiProposal && (
          <section className="ai-proposal-card" aria-label="AI proposal review">
            <div className="ai-proposal-header">
              <div className="ai-proposal-copy">
                <span className="editor-header-kicker">Pending AI proposal</span>
                <h3>Review before apply</h3>
                <p>The live draft will stay unchanged until you accept or reject this proposal.</p>
              </div>
              <div className="ai-proposal-header-actions">
                <button
                  type="button"
                  className="editor-header-button primary"
                  onClick={() => setIsProposalExpanded((current) => !current)}
                >
                  {isProposalExpanded ? 'Hide proposal' : 'Review proposal'}
                </button>
                <button
                  type="button"
                  className="editor-header-button"
                  onClick={onRejectProposal}
                >
                  Reject
                </button>
              </div>
            </div>

            {isProposalExpanded && (
              <>
                <div
                  className="ai-proposal-preview"
                  dangerouslySetInnerHTML={{ __html: pendingAiProposal.html }}
                />

                {pendingAiProposal.sources?.length > 0 && (
                  <div className="ai-proposal-sources">
                    <h4>Sources used</h4>
                    <ul>
                      {pendingAiProposal.sources.map((source, index) => (
                        <li key={`${source.url || source.title || 'source'}-${index}`}>
                          {source.url ? (
                            <a href={source.url} target="_blank" rel="noreferrer">
                              {source.title || source.url}
                            </a>
                          ) : (
                            <span>{source.title || 'Untitled source'}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="ai-proposal-actions">
                  <button
                    type="button"
                    className="editor-header-button primary"
                    onClick={() => onApplyProposal('insert-at-cursor')}
                  >
                    Insert at cursor
                  </button>
                  <button
                    type="button"
                    className="editor-header-button"
                    onClick={() => onApplyProposal('replace-selection')}
                    disabled={!hasSelection}
                  >
                    Replace selection
                  </button>
                  <button
                    type="button"
                    className="editor-header-button danger"
                    onClick={() => onApplyProposal('replace-whole')}
                  >
                    Replace whole draft
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {isThinking && !pendingAiProposal && (
          <div className="editor-assistant-status-panel">
            Assistant is preparing a drafting proposal. Your document will stay unchanged until you accept it.
          </div>
        )}

        <div className="editor-sheet">
          <EditorContent editor={editor} />
        </div>
      </div>

      {isVersionHistoryOpen && (
        <div className="version-history-overlay" onClick={onCloseVersionHistory} role="presentation">
          <section
            className="version-history-panel"
            role="dialog"
            aria-modal="false"
            aria-label="Version history"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="version-history-header">
              <div>
                <h3>Version history</h3>
                <p>Restore a saved version to create a new latest draft state.</p>
              </div>
              <button type="button" className="editor-header-button" onClick={onCloseVersionHistory}>
                Close
              </button>
            </div>

            <div className="version-history-body">
              <div className="version-history-list">
                {versionsLoading ? (
                  <div className="version-history-empty">Loading versions...</div>
                ) : versions.length === 0 ? (
                  <div className="version-history-empty">No saved versions yet.</div>
                ) : (
                  versions.map((version) => (
                    <button
                      key={version.id}
                      type="button"
                      className={`version-history-item ${version.id === selectedVersion?.id ? 'is-selected' : ''}`}
                      onClick={() => onSelectVersion(version.id)}
                    >
                      <div className="version-history-item-top">
                        <span>Version {version.version_number}</span>
                        {version.is_latest && <span className="version-history-latest">Latest</span>}
                      </div>
                      <div className="version-history-item-time">
                        {formatVersionDate(version.created_at)}
                      </div>
                      <div className="version-history-item-preview">
                        {version.preview || 'No preview available.'}
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="version-history-detail">
                {selectedVersion ? (
                  <>
                    <div className="version-history-detail-copy">
                      <h4>Version {selectedVersion.version_number}</h4>
                      <p>{formatVersionDate(selectedVersion.created_at)}</p>
                    </div>
                    <div className="version-history-preview-card">
                      {selectedVersion.preview || 'No preview available for this version.'}
                    </div>
                    <button
                      type="button"
                      className="editor-header-button primary"
                      onClick={() => onRestoreVersion(selectedVersion.id)}
                      disabled={isRestoringVersion}
                    >
                      {isRestoringVersion ? 'Restoring...' : 'Restore version'}
                    </button>
                  </>
                ) : (
                  <div className="version-history-empty">Select a version to inspect it.</div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default DraftingEditor;
