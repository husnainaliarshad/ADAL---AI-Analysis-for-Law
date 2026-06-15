import React, { useEffect, useMemo, useRef } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DraftingAssistantPage from '../pages/DocumentDraftingAssistant/DraftingAssistantPage';
import draftingApi from '../services/draftingService';

vi.mock('../components/layout/Sidebar', () => ({
  default: () => <div data-testid="app-sidebar">Sidebar</div>,
}));

vi.mock('../pages/DocumentDraftingAssistant/components/DraftingResourceSidebar', () => ({
  default: () => <div data-testid="resource-sidebar">Resources</div>,
}));

vi.mock('../pages/DocumentDraftingAssistant/components/DraftingAISidebar', () => ({
  default: function MockDraftingAISidebar({ messages, hasPendingProposal, onSendMessage }) {
    return (
    <div data-testid="ai-sidebar">
      <div data-testid="ai-message-count">{messages.length}</div>
      <div data-testid="ai-source-count">
        {messages.reduce((total, message) => total + (message.sources?.length || 0), 0)}
      </div>
      <div data-testid="pending-proposal">{hasPendingProposal ? 'yes' : 'no'}</div>
      <button type="button" onClick={() => onSendMessage(null, 'Draft a clause')}>
        Send AI prompt
      </button>
    </div>
    );
  },
}));

vi.mock('../pages/DocumentDraftingAssistant/components/DraftingEditor', () => ({
  default: function MockDraftingEditor(props) {
    const { onEditorReady } = props;
    const htmlRef = useRef(props.documentHtml);
    const selectionRef = useRef({ from: 0, to: 0, empty: true });

    useEffect(() => {
      htmlRef.current = props.documentHtml;
    }, [props.documentHtml]);

    const editorStub = useMemo(() => {
      const state = {};
      Object.defineProperty(state, 'selection', {
        get() {
          return selectionRef.current;
        },
      });

      const createChain = () => {
        const steps = [];
        return {
          focus() {
            return this;
          },
          setContent(nextHtml) {
            steps.push(() => {
              htmlRef.current = nextHtml;
            });
            return this;
          },
          insertContent(nextHtml) {
            steps.push(() => {
              htmlRef.current = nextHtml;
              selectionRef.current = { from: 0, to: 0, empty: true };
            });
            return this;
          },
          setTextSelection(position) {
            steps.push(() => {
              selectionRef.current = { from: position, to: position, empty: true };
            });
            return this;
          },
          run() {
            steps.forEach((step) => step());
            return true;
          },
        };
      };

      return {
        getHTML: () => htmlRef.current,
        state,
        chain: createChain,
      };
    }, []);

    useEffect(() => {
      onEditorReady(editorStub);
      return () => onEditorReady(null);
    }, [editorStub, onEditorReady]);

    return (
      <div data-testid="draft-editor">
        <div data-testid="document-html">{props.documentHtml}</div>
        <div data-testid="save-status-text">{props.saveStatusText}</div>
        <div data-testid="draft-id">{props.draftId || 'none'}</div>
        <div data-testid="version-count">{props.versions.length}</div>
        <div data-testid="selected-version">{props.selectedVersionId || 'none'}</div>
        <button type="button" onClick={() => props.onDocumentChange('<p>Edited document</p>')}>
          Change document
        </button>
        <button type="button" onClick={() => props.setDocumentTitle('Edited title')}>
          Change title
        </button>
        <button type="button" onClick={props.onSave}>
          Save draft
        </button>
        <button type="button" onClick={() => props.onSelectionChange(true)}>
          Set selection
        </button>
        <button type="button" onClick={() => props.onApplyProposal('replace-whole')}>
          Accept replace whole
        </button>
        <button type="button" onClick={() => props.onApplyProposal('replace-selection')}>
          Accept replace selection
        </button>
        <button type="button" onClick={props.onRejectProposal}>
          Reject proposal
        </button>
        <button type="button" onClick={props.onOpenVersionHistory}>
          Open history
        </button>
        <button type="button" onClick={() => props.onSelectVersion('version-2')}>
          Select version 2
        </button>
        <button type="button" onClick={() => props.onRestoreVersion(props.selectedVersionId)}>
          Restore selected version
        </button>
      </div>
    );
  },
}));

vi.mock('../services/draftingService', () => ({
  default: {
    processDocument: vi.fn(),
    sendChat: vi.fn(),
    getChatHistory: vi.fn(),
    getDraftVersions: vi.fn(),
    restoreDraftVersion: vi.fn(),
  },
}));

describe('DraftingAssistantPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    draftingApi.processDocument.mockResolvedValue({ draft_id: 'draft-1' });
    draftingApi.sendChat.mockResolvedValue({
      reply: 'Here is a proposed clause.',
      delivery_mode: 'editor',
      html_to_insert: '<p>AI generated clause</p>',
      sources: [{ title: 'Source A', url: 'https://example.com/source-a' }],
    });
    draftingApi.getChatHistory.mockResolvedValue([]);
    draftingApi.getDraftVersions.mockResolvedValue([
      {
        id: 'version-1',
        version_number: 3,
        created_at: '2026-04-17T08:00:00Z',
        preview: 'Latest saved version',
        is_latest: true,
      },
      {
        id: 'version-2',
        version_number: 2,
        created_at: '2026-04-16T08:00:00Z',
        preview: 'Older version',
        is_latest: false,
      },
    ]);
    draftingApi.restoreDraftVersion.mockResolvedValue({
      draft_id: 'draft-1',
      title: 'Restored title',
      content_html: '<p>Restored version content</p>',
      created_at: '2026-04-17T09:15:00Z',
    });

    Object.defineProperty(window, 'confirm', {
      configurable: true,
      writable: true,
      value: vi.fn(() => true),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('autosaves dirty edits after the debounce window', async () => {
    vi.useFakeTimers();
    render(<DraftingAssistantPage />);

    expect(screen.getByTestId('save-status-text')).toHaveTextContent('Not saved yet');

    fireEvent.click(screen.getByRole('button', { name: 'Change document' }));

    expect(screen.getByTestId('save-status-text')).toHaveTextContent('Unsaved changes');

    await act(async () => {
      vi.advanceTimersByTime(1600);
      await Promise.resolve();
    });
    expect(draftingApi.processDocument).toHaveBeenCalledWith(
      'Board Resolution',
      '<p>Edited document</p>',
      null
    );

    expect(screen.getByTestId('save-status-text')).toHaveTextContent('Saved');
  });

  it('keeps AI output as a pending proposal until it is accepted and saved', async () => {
    render(<DraftingAssistantPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Send AI prompt' }));

    await waitFor(() => expect(draftingApi.sendChat).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('pending-proposal')).toHaveTextContent('yes'));

    expect(screen.getByTestId('ai-source-count')).toHaveTextContent('1');
    expect(screen.getByTestId('document-html')).toHaveTextContent('<h1>Board Resolution</h1>');

    fireEvent.click(screen.getByRole('button', { name: 'Set selection' }));
    fireEvent.click(screen.getByRole('button', { name: 'Accept replace selection' }));

    await waitFor(() => {
      expect(draftingApi.processDocument).toHaveBeenCalledWith(
        'Board Resolution',
        '<p>AI generated clause</p>',
        null
      );
    });

    expect(screen.getByTestId('pending-proposal')).toHaveTextContent('no');
    expect(screen.getByTestId('document-html')).toHaveTextContent('<p>AI generated clause</p>');
  });

  it('rejects AI proposals without mutating the document', async () => {
    render(<DraftingAssistantPage />);

    const initialHtml = screen.getByTestId('document-html').textContent;

    fireEvent.click(screen.getByRole('button', { name: 'Send AI prompt' }));
    await waitFor(() => expect(screen.getByTestId('pending-proposal')).toHaveTextContent('yes'));

    fireEvent.click(screen.getByRole('button', { name: 'Reject proposal' }));

    await waitFor(() => {
      expect(screen.getByTestId('pending-proposal')).toHaveTextContent('no');
      expect(screen.getByTestId('document-html').textContent).toBe(initialHtml);
      expect(draftingApi.processDocument).not.toHaveBeenCalled();
    });
  });

  it('keeps explanatory answers in chat when the backend routes to chat mode', async () => {
    draftingApi.sendChat.mockResolvedValueOnce({
      reply: 'This argument is procedurally stronger than the merits point because the record is cleaner on notice and hearing.',
      delivery_mode: 'chat',
      html_to_insert: '',
      sources: [{ title: 'Source B', url: 'https://example.com/source-b' }],
    });

    render(<DraftingAssistantPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Send AI prompt' }));

    await waitFor(() => expect(draftingApi.sendChat).toHaveBeenCalled());
    expect(screen.getByTestId('pending-proposal')).toHaveTextContent('no');
    expect(screen.getByTestId('document-html')).toHaveTextContent('<h1>Board Resolution</h1>');
    expect(screen.getByTestId('ai-source-count')).toHaveTextContent('1');
    expect(draftingApi.processDocument).not.toHaveBeenCalled();
  });

  it('loads version history and restores the selected version', async () => {
    render(<DraftingAssistantPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Change document' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => expect(draftingApi.processDocument).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('draft-id')).toHaveTextContent('draft-1'));

    fireEvent.click(screen.getByRole('button', { name: 'Open history' }));

    await waitFor(() => expect(draftingApi.getDraftVersions).toHaveBeenCalledWith('draft-1'));
    expect(screen.getByTestId('version-count')).toHaveTextContent('2');

    fireEvent.click(screen.getByRole('button', { name: 'Select version 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore selected version' }));

    await waitFor(() => expect(draftingApi.restoreDraftVersion).toHaveBeenCalledWith('draft-1', 'version-2'));
    expect(screen.getByTestId('document-html')).toHaveTextContent('<p>Restored version content</p>');
  });

  it('treats title-only changes as dirty and autosaves them', async () => {
    vi.useFakeTimers();
    render(<DraftingAssistantPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Change title' }));
    expect(screen.getByTestId('save-status-text')).toHaveTextContent('Unsaved changes');

    await act(async () => {
      vi.advanceTimersByTime(1600);
      await Promise.resolve();
    });
    expect(draftingApi.processDocument).toHaveBeenCalledWith(
      'Edited title',
      '<h1>Board Resolution</h1><p>Enter your legal draft here...</p>',
      null
    );
  });
});
