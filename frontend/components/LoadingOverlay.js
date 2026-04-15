'use client';

/**
 * Full-screen loading overlay with animated spinner
 * and status text. Shown while fetching routes.
 */
export default function LoadingOverlay() {
  return (
    <div className="loading-overlay" role="status" aria-label="Calculating safest route">
      <div className="loading-spinner" aria-hidden="true" />
      <p className="loading-text">
        Calculating safest route<span className="loading-dots" />
      </p>
      <p className="sr-only">Please wait while we analyze route safety</p>
    </div>
  );
}
