'use client';

import RouteCard from './RouteCard';

/**
 * Bottom sheet container for route result cards.
 * Horizontally scrollable on mobile, vertical on desktop.
 */
export default function RouteCards({ routes, selectedRoute, onSelect }) {
  if (!routes || routes.length === 0) return null;

  return (
    <div
      className={`cards-container ${routes ? 'visible' : ''}`}
      id="route-results"
      role="region"
      aria-label="Route results"
    >
      <div className="cards-handle" aria-hidden="true" />
      <div className="cards-scroll" role="list" aria-label="Available routes">
        {routes.map((route, index) => (
          <RouteCard
            key={route.id}
            route={route}
            index={index}
            isSelected={selectedRoute?.id === route.id}
            onSelect={() => onSelect(route)}
          />
        ))}
      </div>
    </div>
  );
}
