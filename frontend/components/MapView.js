'use client';

import { useRef, useEffect, useState } from 'react';

/**
 * Mapbox GL JS map component with dark styling, 3D terrain,
 * user location marker, and route line rendering.
 */
export default function MapView({ userLocation, routes, selectedRoute, onMapClick }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    // Dynamically import mapbox-gl (client-only)
    import('mapbox-gl').then((mapboxgl) => {
      // Use environment variable for Mapbox token
      mapboxgl.default.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

      const map = new mapboxgl.default.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          name: 'SICHER Dark',
          sources: {
            'osm-tiles': {
              type: 'raster',
              tiles: [
                'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
                'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
                'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
              ],
              tileSize: 256,
              attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
            },
          },
          layers: [
            {
              id: 'osm-tiles-layer',
              type: 'raster',
              source: 'osm-tiles',
              minzoom: 0,
              maxzoom: 19,
            },
          ],
        },
        center: userLocation
          ? [userLocation.lng, userLocation.lat]
          : [77.2090, 28.6139],
        zoom: 14,
        pitch: 45,
        bearing: -17.6,
        antialias: true,
      });

      // Navigation controls
      map.addControl(new mapboxgl.default.NavigationControl({
        showCompass: true,
        showZoom: true,
        visualizePitch: true,
      }), 'bottom-right');

      map.on('load', () => {
        setMapLoaded(true);
        console.log('[SICHER] Map loaded');
      });

      // Allow passing clicks up to parent (for manual destination select)
      map.on('click', (e) => {
        if (onMapClick) {
          onMapClick(e.lngLat);
        }
      });

      map.getCanvas().style.cursor = 'crosshair';

      mapRef.current = map;
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

    const map = mapRef.current;

    // Remove existing user marker layer
    if (map.getLayer('user-marker')) map.removeLayer('user-marker');
    if (map.getLayer('user-marker-pulse')) map.removeLayer('user-marker-pulse');
    if (map.getSource('user-location')) map.removeSource('user-location');

    // Add user location source
    map.addSource('user-location', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [userLocation.lng, userLocation.lat],
        },
      },
    });

    // Pulse ring
    map.addLayer({
      id: 'user-marker-pulse',
      type: 'circle',
      source: 'user-location',
      paint: {
        'circle-radius': 20,
        'circle-color': 'rgba(0, 255, 136, 0.15)',
        'circle-stroke-width': 1,
        'circle-stroke-color': 'rgba(0, 255, 136, 0.3)',
      },
    });

    // Center dot
    map.addLayer({
      id: 'user-marker',
      type: 'circle',
      source: 'user-location',
      paint: {
        'circle-radius': 7,
        'circle-color': '#00ff88',
        'circle-stroke-width': 3,
        'circle-stroke-color': '#06060c',
      },
    });

    // Fly to location
    map.flyTo({
      center: [userLocation.lng, userLocation.lat],
      zoom: 14,
      pitch: 45,
      duration: 2000,
    });
  }, [userLocation, mapLoaded]);

  // Draw routes when they arrive
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !routes) return;

    const map = mapRef.current;

    // Clear old route layers and sources
    // We check for both dashes and underscores just to be safe
    const layerIds = [
      'route_safe', 'route_safe-glow', 'route_fast', 'route_alt_1', 'route_alt_2',
      'route-safe', 'route-safe-glow', 'route-fast', 'route-alt-1', 'route-alt-2'
    ];
    for (const id of layerIds) {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getLayer(id + '-glow')) map.removeLayer(id + '-glow');
      if (map.getSource(id)) map.removeSource(id);
    }

    // Draw each route
    routes.forEach((route, index) => {
      const isSafest = index === 0;
      const sourceId = route.id || `route-${index}`;

      map.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: route.coordinates,
          },
          properties: {
            score: route.safety_score,
          },
        },
      });

      if (isSafest) {
        // Glow layer for safe route
        map.addLayer({
          id: sourceId + '-glow',
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#00b368',
            'line-width': 14,
            'line-blur': 12,
            'line-opacity': 0.2,
          },
        });

        // Main safe route line
        map.addLayer({
          id: sourceId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': route.warning ? '#e63946' : '#00b368',
            'line-width': 5,
            'line-opacity': 1,
          },
        });
      } else {
        // Alternative / fast route — muted
        map.addLayer({
          id: sourceId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': route.warning ? '#ff4466' : '#6670a0',
            'line-width': 3,
            'line-opacity': 0.6,
            'line-dasharray': [2, 3],
          },
        });
      }
    });

    // Fit map to show all routes
    if (routes.length > 0 && routes[0].coordinates.length > 0) {
      const allCoords = routes.flatMap(r => r.coordinates);
      const bounds = allCoords.reduce(
        (b, coord) => {
          return {
            minLng: Math.min(b.minLng, coord[0]),
            maxLng: Math.max(b.maxLng, coord[0]),
            minLat: Math.min(b.minLat, coord[1]),
            maxLat: Math.max(b.maxLat, coord[1]),
          };
        },
        { minLng: Infinity, maxLng: -Infinity, minLat: Infinity, maxLat: -Infinity },
      );

      map.fitBounds(
        [[bounds.minLng, bounds.minLat], [bounds.maxLng, bounds.maxLat]],
        { padding: { top: 120, bottom: 250, left: 40, right: 40 }, duration: 1500, pitch: 45 },
      );
    }
  }, [routes, mapLoaded]);

  // Highlight selected route
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !routes || !selectedRoute) return;

    const map = mapRef.current;

    routes.forEach((route) => {
      const layerId = route.id || `route-${routes.indexOf(route)}`;
      if (map.getLayer(layerId)) {
        const isSelected = route.id === selectedRoute.id;
        map.setPaintProperty(layerId, 'line-opacity', isSelected ? 0.95 : 0.3);
        map.setPaintProperty(layerId, 'line-width', isSelected ? 5 : 2);
      }
    });
  }, [selectedRoute, routes, mapLoaded]);

  return <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />;
}
