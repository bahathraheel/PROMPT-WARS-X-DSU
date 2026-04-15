'use client';

import { useRef, useCallback, useState } from 'react';
import { GoogleMap, useJsApiLoader, Polyline, Marker } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: '100%'
};

// Subtle silver map style to keep the focus on safe routes
const silverStyle = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
  {
    featureType: 'administrative.land_parcel',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#bdbdbd' }]
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#eeeeee' }]
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#757575' }]
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#e5e5e5' }]
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#ffffff' }]
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#c9c9c9' }]
  }
];

export default function MapView({ userLocation, routes, selectedRoute, onMapClick }) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: ['places']
  });

  const [map, setMap] = useState(null);

  const onLoad = useCallback(function callback(map) {
    const bounds = new window.google.maps.LatLngBounds();
    setMap(map);
  }, []);

  const onUnmount = useCallback(function callback(map) {
    setMap(null);
  }, []);

  // Center logic
  const center = userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : { lat: 28.6139, lng: 77.2090 };

  // Fit bounds when routes change
  const handleRoutesChange = useCallback(() => {
    if (!map || !routes || routes.length === 0) return;
    const bounds = new window.google.maps.LatLngBounds();
    routes.forEach(route => {
      route.coordinates.forEach(c => {
        bounds.extend({ lat: c[1], lng: c[0] });
      });
    });
    map.fitBounds(bounds, { top: 80, right: 80, bottom: 80, left: 80 });
  }, [map, routes]);

  // Trigger fit bounds
  if (map && routes && routes.length > 0) {
    handleRoutesChange();
  }

  if (!isLoaded) return <div className="map-placeholder">Loading Google Maps...</div>;

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={14}
      onLoad={onLoad}
      onUnmount={onUnmount}
      onClick={(e) => onMapClick && onMapClick({ lat: e.latLng.lat(), lng: e.latLng.lng() })}
      options={{
        styles: silverStyle,
        zoomControl: true,
        mapTypeControl: false,
        scaleControl: true,
        streetViewControl: false,
        rotateControl: false,
        fullscreenControl: false
      }}
    >
      {/* Current location marker */}
      {userLocation && (
        <Marker
          position={{ lat: userLocation.lat, lng: userLocation.lng }}
          icon={{
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#00b368',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          }}
          title="Your current location"
        />
      )}

      {/* Render routes */}
      {routes && routes.map((route, idx) => {
        const isSafest = idx === 0;
        const isSelected = selectedRoute ? route.id === selectedRoute.id : isSafest;
        
        // Google Maps takes {lat, lng} objects
        const path = route.coordinates.map(c => ({ lat: c[1], lng: c[0] }));

        return (
          <Polyline
            key={route.id}
            path={path}
            options={{
              strokeColor: isSafest ? (route.warning ? '#e63946' : '#00b368') : '#6670a0',
              strokeOpacity: isSelected ? 1.0 : 0.3,
              strokeWeight: isSelected ? (isSafest ? 6 : 4) : 2,
              icons: !isSafest ? [{
                icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 2 },
                offset: '0',
                repeat: '20px'
              }] : null,
              zIndex: isSelected ? 100 : 10
            }}
          />
        );
      })}

      {/* Destination marker (Red point at the end of the safely selected route) */}
      {routes && routes.length > 0 && (
        <Marker
          position={{
            lat: (selectedRoute || routes[0]).coordinates[(selectedRoute || routes[0]).coordinates.length - 1][1],
            lng: (selectedRoute || routes[0]).coordinates[(selectedRoute || routes[0]).coordinates.length - 1][0]
          }}
          icon={{
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#e63946', // Distinct Red
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
          }}
          title="Destination"
        />
      )}
    </GoogleMap>
  );
}
