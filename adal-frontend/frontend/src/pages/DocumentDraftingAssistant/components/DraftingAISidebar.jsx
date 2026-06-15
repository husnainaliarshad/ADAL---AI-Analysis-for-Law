import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { Bot, RotateCcw, Sparkles } from 'lucide-react';

const STATUS_STEPS = [
  'Reviewing your drafting request...',
  'Preparing a proposal preview...',
  'Collecting sources for review...',
];

const PROPOSAL_STATUS_LABELS = {
  pending: 'Proposal generated',
  accepted: 'Proposal accepted',
  rejected: 'Proposal rejected',
};

const DraftingAISidebar = ({
  messages,
  lastUserPrompt,
  documentTitle,
  isThinking,
  hasPendingProposal,
  onSendMessage,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [thinkingStep, setThinkingStep] = useState(0);

  useEffect(() => {
    let interval;
    if (isThinking) {
      interval = setInterval(() => {
        setThinkingStep((prev) => (prev + 1) % STATUS_STEPS.length);
      }, 2200);
    } else {
      setThinkingStep(0);
    }
    return () => clearInterval(interval);
  }, [isThinking]);

  const handleSend = () => {
    if (!inputValue.trim() || isThinking || hasPendingProposal) return;
    onSendMessage(null, inputValue);
    setInputValue('');
  };

  const handleRetry = () => {
    if (lastUserPrompt && !isThinking && !hasPendingProposal) {
      onSendMessage(lastUserPrompt);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="ai-assistant-container">
      <div className="ai-header">
        <div className="ai-header-copy">
          <div className="ai-header-kicker">Copilot</div>
          <h2>Draft Copilot</h2>
          <p>{documentTitle || 'Untitled Document'}</p>
        </div>
        <div className="ai-header-badge">
          <Sparkles size={14} />
          Context-aware drafting
        </div>
      </div>

      {hasPendingProposal && (
        <div className="ai-pending-banner" role="status">
          Review the current proposal in the editor before starting another AI drafting step.
        </div>
      )}

      <div className="ai-messages">
        {messages.map((message) => (
          <div key={message.id} className={`ai-message-container ${message.type}`}>
            {message.type === 'assistant' && (
              <div className="ai-avatar">
                <Bot size={14} />
              </div>
            )}

            <div className={`ai-message-bubble ${message.type} ${message.isError ? 'error' : ''}`}>
              <div className="ai-message-content">
                {message.type === 'assistant' ? (
                  <ReactMarkdown rehypePlugins={[rehypeRaw]}>{message.content}</ReactMarkdown>
                ) : (
                  <p>{message.content}</p>
                )}
              </div>

              {message.proposalStatus && message.proposalStatus !== 'none' && (
                <div className={`ai-proposal-status ${message.proposalStatus}`}>
                  {PROPOSAL_STATUS_LABELS[message.proposalStatus]}
                </div>
              )}

              {message.sources?.length > 0 && (
                <div className="ai-message-sources">
                  <h4>Sources used</h4>
                  <ul>
                    {message.sources.map((source, index) => (
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

              {message.isError && (
                <div className="ai-error-actions">
                  {message.technicalDetails && (
                    <details className="ai-technical-details">
                      <summary>Technical details</summary>
                      <pre>{message.technicalDetails}</pre>
                    </details>
                  )}
                  {lastUserPrompt && (
                    <button
                      type="button"
                      className="ai-secondary-button"
                      onClick={handleRetry}
                      disabled={isThinking || hasPendingProposal}
                    >
                      <RotateCcw size={13} />
                      Retry last prompt
                    </button>
                  )}
                </div>
              )}
            </div>

            {message.type === 'user' && (
              <div className="ai-avatar user">
                <span>You</span>
              </div>
            )}
          </div>
        ))}

        {isThinking && (
          <div className="ai-message-container assistant">
            <div className="ai-avatar">
              <Bot size={14} />
            </div>
            <div className="ai-message-bubble assistant thinking">
              <span className="ai-thinking-dot" />
              {STATUS_STEPS[thinkingStep]}
            </div>
          </div>
        )}
      </div>

      <div className="ai-input-area">
        <div className="ai-input-container">
          <textarea
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask for a clause, rewrite, or drafting improvement..."
            className="ai-input"
            rows={3}
            disabled={isThinking || hasPendingProposal}
          />
          <button
            type="button"
            onClick={handleSend}
            className="ai-send-button"
            disabled={isThinking || hasPendingProposal || !inputValue.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default DraftingAISidebar;
