'use client';

import { useRef, useEffect, useState } from 'react';

/**
 * Leaflet + OpenStreetMap map component with route rendering.
 * Uses free OSM tiles — no API key needed.
 */
export default function MapView({ userLocation, routes, selectedRoute, onMapClick }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef([]);
  const markersRef = useRef([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    // Dynamically import leaflet (client-only)
    import('leaflet').then((L) => {
      // Fix Leaflet default icon paths for bundled environments
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      const defaultCenter = userLocation
        ? [userLocation.lat, userLocation.lng]
        : [28.6139, 77.2090];

      const map = L.map(mapContainer.current, {
        center: defaultCenter,
        zoom: 14,
        zoomControl: false,
      });

      // Premium-looking map tiles (CartoCDN Voyager — free, detailed, colorful)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
      }).addTo(map);

      // Zoom control bottom-right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Click handler for manual destination
      map.on('click', (e) => {
        if (onMapClick) {
          onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
        }
      });

      // Set crosshair cursor
      mapContainer.current.style.cursor = 'crosshair';

      mapRef.current = map;
      window._leaflet = L;
      setMapLoaded(true);
      console.log('[SICHER] Leaflet map loaded');
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update user marker when location changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !userLocation) return;
    const L = window._leaflet;
    const map = mapRef.current;

    // Remove old user markers
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];

    // Pulse ring
    const pulse = L.circleMarker([userLocation.lat, userLocation.lng], {
      radius: 22,
      fillColor: 'rgba(0, 180, 100, 0.15)',
      fillOpacity: 0.4,
      color: 'rgba(0, 180, 100, 0.4)',
      weight: 2,
      interactive: false,
    }).addTo(map);
    markersRef.current.push(pulse);

    // Center dot
    const dot = L.circleMarker([userLocation.lat, userLocation.lng], {
      radius: 8,
      fillColor: '#00b368',
      fillOpacity: 1,
      color: '#ffffff',
      weight: 3,
      interactive: false,
    }).addTo(map);
    markersRef.current.push(dot);

    // Fly to location
    map.flyTo([userLocation.lat, userLocation.lng], 14, { duration: 1.5 });
  }, [userLocation, mapLoaded]);

  // Draw routes when they arrive
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !routes) return;
    const L = window._leaflet;
    const map = mapRef.current;

    // Clear old route layers
    layersRef.current.forEach(layer => {
      try { map.removeLayer(layer); } catch (e) { /* ignore */ }
    });
    layersRef.current = [];

    // Draw each route
    routes.forEach((route, index) => {
      const isSafest = index === 0;
      // OSRM returns coordinates as [lng, lat] — Leaflet needs [lat, lng]
      const latLngs = route.coordinates.map(c => [c[1], c[0]]);

      if (isSafest) {
        // Glow effect for safest route
        const glow = L.polyline(latLngs, {
          color: '#00b368',
          weight: 16,
          opacity: 0.15,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
        }).addTo(map);
        layersRef.current.push(glow);

        // Main safest route line
        const mainLine = L.polyline(latLngs, {
          color: route.warning ? '#e63946' : '#00b368',
          weight: 6,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
        mainLine.bindPopup(
          `<div style="font-family:Inter,system-ui,sans-serif;padding:4px">
            <strong style="color:#00b368">🛡️ ${route.label}</strong><br/>
            Safety: <strong>${route.safety_score}/100</strong><br/>
            Distance: ${route.distance_km} km<br/>
            Time: ~${route.duration_min} min
          </div>`
        );
        layersRef.current.push(mainLine);

        // Start marker
        const startMarker = L.circleMarker(latLngs[0], {
          radius: 8,
          fillColor: '#00b368',
          fillOpacity: 1,
          color: '#fff',
          weight: 3,
        }).addTo(map);
        startMarker.bindTooltip('Start', { permanent: false, direction: 'top' });
        layersRef.current.push(startMarker);

        // End marker
        const endMarker = L.circleMarker(latLngs[latLngs.length - 1], {
          radius: 8,
          fillColor: '#e63946',
          fillOpacity: 1,
          color: '#fff',
          weight: 3,
        }).addTo(map);
        endMarker.bindTooltip('Destination', { permanent: false, direction: 'top' });
        layersRef.current.push(endMarker);
      } else {
        // Alternative route — dashed, muted
        const altLine = L.polyline(latLngs, {
          color: route.warning ? '#ff4466' : '#6670a0',
          weight: 3,
          opacity: 0.5,
          dashArray: '8, 12',
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
        altLine.bindPopup(
          `<div style="font-family:Inter,system-ui,sans-serif;padding:4px">
            <strong>${route.label}</strong><br/>
            Safety: <strong>${route.safety_score}/100</strong><br/>
            Distance: ${route.distance_km} km<br/>
            Time: ~${route.duration_min} min
          </div>`
        );
        layersRef.current.push(altLine);
      }
    });

    // Fit map to show all routes
    if (routes.length > 0 && routes[0].coordinates.length > 0) {
      const allLatLngs = routes.flatMap(r =>
        r.coordinates.map(c => [c[1], c[0]])
      );
      const bounds = L.latLngBounds(allLatLngs);
      map.fitBounds(bounds, {
        padding: [80, 80],
        maxZoom: 16,
        animate: true,
      });
    }
  }, [routes, mapLoaded]);

  // Highlight selected route
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !routes || !selectedRoute) return;

    // Rebuild route opacity based on selection
    let layerIndex = 0;
    routes.forEach((route, index) => {
      const isSafest = index === 0;
      const isSelected = route.id === selectedRoute.id;

      if (isSafest) {
        // Glow layer
        if (layersRef.current[layerIndex]) {
          layersRef.current[layerIndex].setStyle({ opacity: isSelected ? 0.2 : 0.05 });
        }
        layerIndex++;
        // Main line
        if (layersRef.current[layerIndex]) {
          layersRef.current[layerIndex].setStyle({
            opacity: isSelected ? 1 : 0.3,
            weight: isSelected ? 6 : 3,
          });
        }
        layerIndex++;
        // Start marker
        layerIndex++;
        // End marker
        layerIndex++;
      } else {
        if (layersRef.current[layerIndex]) {
          layersRef.current[layerIndex].setStyle({
            opacity: isSelected ? 0.9 : 0.3,
            weight: isSelected ? 5 : 2,
          });
        }
        layerIndex++;
      }
    });
  }, [selectedRoute, routes, mapLoaded]);

  return (
    <>
      {/* Leaflet CSS - no integrity check to avoid CSP issues */}
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
      />
      {/* Critical inline CSS to fix tile gaps */}
      <style>{`
        .leaflet-tile-pane { z-index: 2; }
        .leaflet-tile { border: none !important; outline: none !important; }
        .leaflet-container { background: #e8e8e8; }
        .leaflet-tile-container img { width: 256px !important; height: 256px !important; }
        .leaflet-popup-content { font-family: Inter, system-ui, sans-serif; }
      `}</style>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
    </>
  );
}
