'use client';

import { useState, useRef, useEffect } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';

const LIBRARIES = ['places'];

/**
 * Search bar component with destination input and location badge.
 * Features: autocomplete-ready, keyboard accessible, loading state.
 */
export default function SearchBar({ onSearch, userLocation, locationError, disabled }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const autoCompleteRef = useRef(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES
  });

  useEffect(() => {
    if (isLoaded && inputRef.current && !autoCompleteRef.current) {
      autoCompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        fields: ['formatted_address', 'geometry'],
        types: ['address', 'establishment']
      });

      autoCompleteRef.current.addListener('place_changed', () => {
        const place = autoCompleteRef.current.getPlace();
        if (place.formatted_address) {
          setQuery(place.formatted_address);
        }
      });
    }
  }, [isLoaded]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim() && onSearch) {
      onSearch(query.trim());
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  return (
    <div className="search-container">
      <form onSubmit={handleSubmit} role="search" aria-label="Route search">
        <div className="search-wrapper">
          {/* Search Icon */}
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>

          {/* Input */}
          <input
            ref={inputRef}
            id="search-input"
            className="search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Where are you heading?"
            disabled={disabled}
            autoComplete="off"
            aria-label="Enter your destination"
            aria-describedby="location-status"
          />

          {/* Submit Button */}
          <button
            className="search-btn"
            type="submit"
            disabled={disabled || !query.trim()}
            aria-label="Find safe route"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12,5 19,12 12,19" />
            </svg>
          </button>
        </div>
      </form>

      {/* Location Status */}
      <div id="location-status" aria-live="polite">
        {userLocation && !locationError && (
          <div className="location-badge">
            <span className="location-dot" aria-hidden="true" />
            <span>
              📍 {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
            </span>
          </div>
        )}
        {locationError && (
          <div className="location-badge" style={{ background: 'var(--accent-warn-dim)', color: 'var(--accent-warn)' }}>
            <span>⚠️ Using default location (demo mode)</span>
          </div>
        )}
      </div>
    </div>
  );
}
