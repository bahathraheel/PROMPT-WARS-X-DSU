'use client';

import { useState, useEffect } from 'react';
import { fetchHistory, clearHistory } from '../lib/api';

/**
 * Drawer showing the last 10 route checks from checks.json.
 * Slides up from the bottom on mobile.
 */
export default function HistoryDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [checks, setChecks] = useState([]);

  // Load history when drawer opens
  useEffect(() => {
    if (isOpen) {
      fetchHistory().then(data => {
        setChecks(data.checks || []);
      }).catch(() => setChecks([]));
    }
  }, [isOpen]);

  const handleClear = async () => {
    await clearHistory();
    setChecks([]);
  };

  const getScoreClass = (score) => {
    if (score >= 70) return 'good';
    if (score >= 40) return 'moderate';
    return 'bad';
  };

  const formatTime = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
        ' ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        className="history-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close history' : 'Open route history'}
        aria-expanded={isOpen}
      >
        🕐
      </button>

      {/* Drawer */}
      <div
        className={`history-drawer ${isOpen ? 'open' : ''}`}
        role="dialog"
        aria-label="Route history"
        aria-hidden={!isOpen}
      >
        <div className="cards-handle" aria-hidden="true" />
        
        <div className="history-header">
          <h2 className="history-title">Recent Checks</h2>
          {checks.length > 0 && (
            <button
              onClick={handleClear}
              style={{ fontSize: '0.8rem', color: 'var(--accent-warn)', padding: '4px 12px' }}
              aria-label="Clear all history"
            >
              Clear
            </button>
          )}
        </div>

        {checks.length === 0 ? (
          <div className="history-empty">
            <p>No route checks yet.</p>
            <p style={{ marginTop: '8px', fontSize: '0.8rem' }}>
              Search for a destination to see your history here.
            </p>
          </div>
        ) : (
          <div role="list">
            {checks.map((check, i) => (
              <div className="history-item" key={check.id || i} role="listitem">
                <span className={`history-score ${getScoreClass(check.top_score)}`}>
                  {check.top_score}
                </span>
                <div className="history-details">
                  <div className="history-dest">{check.destination || 'Unknown'}</div>
                  <div className="history-time">{formatTime(check.timestamp)}</div>
                </div>
                {check.advisory && (
                  <span title={check.advisory} aria-label="Had advisory">⚠️</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 35,
            background: 'rgba(0,0,0,0.3)',
          }}
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}
