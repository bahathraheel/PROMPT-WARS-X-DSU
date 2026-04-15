'use client';

/**
 * Warning banner displayed when all routes have low safety scores
 * or when errors occur. Features slide-in + shake animation.
 */
export default function WarningBanner({ message, onClose }) {
  return (
    <div
      className="warning-banner"
      role="alert"
      aria-live="assertive"
    >
      <span className="warning-banner-icon" aria-hidden="true">⚠️</span>
      <p className="warning-banner-text">{message}</p>
      <button
        className="warning-banner-close"
        onClick={onClose}
        aria-label="Dismiss warning"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
