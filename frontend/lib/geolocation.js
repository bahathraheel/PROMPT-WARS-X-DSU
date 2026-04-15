/**
 * SICHER — Browser Geolocation API Wrapper
 * 
 * Requests user location with proper error handling and fallback.
 */

/**
 * Get user's current location via browser Geolocation API.
 * 
 * @param {object} options - Geolocation options
 * @returns {Promise<{lat: number, lng: number}>} User coordinates
 */
export function getUserLocation(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000, // Cache for 1 minute
      ...options,
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
      },
      (error) => {
        let message;
        switch (error.code) {
        case error.PERMISSION_DENIED:
          message = 'Location permission denied. Using default location.';
          break;
        case error.POSITION_UNAVAILABLE:
          message = 'Location unavailable. Using default location.';
          break;
        case error.TIMEOUT:
          message = 'Location request timed out. Using default location.';
          break;
        default:
          message = 'Unknown location error. Using default location.';
        }
        reject(new Error(message));
      },
      defaultOptions,
    );
  });
}
