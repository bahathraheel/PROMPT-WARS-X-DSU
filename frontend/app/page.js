'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import SearchBar from '../components/SearchBar';
import RouteCards from '../components/RouteCards';
import WarningBanner from '../components/WarningBanner';
import LoadingOverlay from '../components/LoadingOverlay';
import HistoryDrawer from '../components/HistoryDrawer';
import { getUserLocation } from '../lib/geolocation';
import { fetchRoute, saveHistory } from '../lib/api';

// Dynamic imports (no SSR for WebGL components)
const GlobeIntro = dynamic(() => import('../components/GlobeIntro'), { ssr: false });
const MapView = dynamic(() => import('../components/MapView'), { ssr: false });

export default function HomePage() {
  // App state
  const [showGlobe, setShowGlobe] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [routes, setRoutes] = useState(null);
  const [advisory, setAdvisory] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [showWarning, setShowWarning] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  // Clock ticker for real-time widget
  useEffect(() => {
    setCurrentTime(new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Request geolocation on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      getUserLocation()
        .then(loc => {
          setUserLocation(loc);
          console.log('[SICHER] Location acquired:', loc);
        })
        .catch(err => {
          console.warn('[SICHER] Location denied:', err);
          setLocationError(err.message);
          // Default to New Delhi for demo
          setUserLocation({ lat: 28.6139, lng: 77.2090 });
        });
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Dismiss globe after 3.5 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowGlobe(false), 3500);
    return () => clearTimeout(timer);
  }, []);

  // Handle search submission
  const handleSearch = useCallback(async (query) => {
    if (!query.trim() || !userLocation) return;

    setLoading(true);
    setRoutes(null);
    setAdvisory(null);
    setShowWarning(false);
    setSelectedRoute(null);

    try {
      const data = await fetchRoute(userLocation, query);

      if (data.routes && data.routes.length > 0) {
        setRoutes(data.routes);
        setSelectedRoute(data.routes[0]);
      }

      if (data.advisory) {
        setAdvisory(data.advisory);
        setShowWarning(true);
      }

      // Save to history
      if (data.routes && data.routes.length > 0) {
        await saveHistory({
          destination: query,
          start: userLocation,
          end: {
            lat: data.routes[0].coordinates[data.routes[0].coordinates.length - 1][1],
            lng: data.routes[0].coordinates[data.routes[0].coordinates.length - 1][0],
          },
          top_score: data.routes[0].safety_score,
          route_count: data.routes.length,
          advisory: data.advisory,
        });
      }
    } catch (err) {
      console.error('[SICHER] Route fetch failed:', err);
      setAdvisory('❌ Could not fetch routes. Please check your connection and try again.');
      setShowWarning(true);
    } finally {
      setLoading(false);
    }
  }, [userLocation]);

  // Handle route card selection
  const handleRouteSelect = useCallback((route) => {
    setSelectedRoute(route);
  }, []);

  // Handle map click for manual destination selection
  const handleMapClick = useCallback((lngLat) => {
    const coordsStr = `${lngLat.lat.toFixed(5)}, ${lngLat.lng.toFixed(5)}`;
    handleSearch(coordsStr);
  }, [handleSearch]);

  return (
    <main className="app-container" role="main" aria-label="SICHER Navigation">
      {/* ... previous UI regions ... */}
      {showGlobe && <GlobeIntro />}

      {/* Top Right Branding Widget (Google Maps Style) */}
      <div className="top-right-branding" aria-hidden="true">
        <h1 className="brand-title">SI<span>CH</span>ER</h1>
        {currentTime && (
          <div className="real-time-info">
            <span className="live-pulse"></span>
            <span>LIVE • {currentTime}</span>
          </div>
        )}
      </div>

      <SearchBar
        onSearch={handleSearch}
        userLocation={userLocation}
        locationError={locationError}
        disabled={loading}
      />

      {/* Quick Recommendations Context */}
      <div className="quick-places-container">
        {['Metro Station', 'Hospital', 'Police Station', 'City Center', 'Cafe'].map((place) => (
          <button 
            key={place} 
            className="quick-place-chip"
            onClick={() => handleSearch(place)}
            disabled={loading}
          >
            {place}
          </button>
        ))}
      </div>

      {showWarning && advisory && (
        <WarningBanner
          message={advisory}
          onClose={() => setShowWarning(false)}
        />
      )}

      {/* Map */}
      <div className="map-container" id="map-region" role="region" aria-label="Navigation map">
        <MapView
          userLocation={userLocation}
          routes={routes}
          selectedRoute={selectedRoute}
          onMapClick={handleMapClick}
        />
      </div>

      {/* Loading */}
      {loading && <LoadingOverlay />}

      {/* Route Cards */}
      <RouteCards
        routes={routes}
        selectedRoute={selectedRoute}
        onSelect={handleRouteSelect}
      />

      {/* History */}
      <HistoryDrawer />
    </main>
  );
}
