'use client';

import { useEffect, useState } from 'react';

/**
 * Individual route card with animated score circle,
 * distance/time stats, and safety reason text.
 */
export default function RouteCard({ route, index, isSelected, onSelect }) {
  const [animatedScore, setAnimatedScore] = useState(0);

  // Animate score counter on mount
  useEffect(() => {
    const target = route.safety_score;
    const duration = 1200;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(eased * target));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    const delay = setTimeout(() => animate(), index * 200);
    return () => clearTimeout(delay);
  }, [route.safety_score, index]);

  // Score classification
  const scoreClass = route.safety_score >= 70 ? 'safe' : route.safety_score >= 40 ? 'moderate' : 'warning';
  const cardClass = route.id === 'route_safe' ? 'safe' : route.warning ? 'warning' : 'fast';

  // SVG circle math
  const svgSize = 56;
  const strokeWidth = 4;
  const r = (svgSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = (animatedScore / 100) * circumference;
  const dashOffset = circumference - progress;

  return (
    <div
      className={`route-card ${cardClass} ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      role="listitem"
      tabIndex={0}
      aria-label={`${route.label}: ${route.safety_score} safety score, ${route.duration_min} minutes, ${route.distance_km} kilometers. ${route.reason}`}
    >
      {/* Header */}
      <div className="route-card-header">
        <div>
          <div className="route-card-label">{route.label}</div>
        </div>

        {/* Animated Score Circle */}
        <div className={`score-circle ${scoreClass}`}>
          <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
            <circle
              className="score-circle-bg"
              cx={svgSize / 2}
              cy={svgSize / 2}
              r={r}
            />
            <circle
              className="score-circle-progress"
              cx={svgSize / 2}
              cy={svgSize / 2}
              r={r}
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <span className="score-value">{animatedScore}</span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="route-stats">
        <div className="route-stat">
          <span className="route-stat-value">{route.duration_min}<span style={{ fontSize: '0.7em', fontWeight: 400 }}>min</span></span>
          <span className="route-stat-label">Duration</span>
        </div>
        <div className="route-stat">
          <span className="route-stat-value">{route.distance_km}<span style={{ fontSize: '0.7em', fontWeight: 400 }}>km</span></span>
          <span className="route-stat-label">Distance</span>
        </div>
        {route.details && (
          <div className="route-stat">
            <span className="route-stat-value">{route.details.coverage_pct}<span style={{ fontSize: '0.7em', fontWeight: 400 }}>%</span></span>
            <span className="route-stat-label">Coverage</span>
          </div>
        )}
      </div>

      {/* Safety Reason */}
      <div className="route-reason">
        {route.reason}
      </div>
    </div>
  );
}
