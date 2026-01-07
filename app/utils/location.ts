/**
 * Location Utility Functions
 *
 * Helper functions for location services
 */

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

/**
 * Request location permission and get current location
 * Returns location data or null if permission denied or error
 */
export const getCurrentLocation = (): Promise<LocationData | null> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      console.warn('Geolocation is not supported by this browser');
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy || undefined,
        });
      },
      (error) => {
        console.warn('Error getting location:', error.message);
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
};

/**
 * Request location permission
 * Returns true if permission granted, false otherwise
 */
export const requestLocationPermission = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || !navigator.permissions) {
    // Fallback: try to get location directly
    const location = await getCurrentLocation();
    return location !== null;
  }

  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return result.state === 'granted';
  } catch (error) {
    // Fallback: try to get location directly
    const location = await getCurrentLocation();
    return location !== null;
  }
};

/**
 * Watch location changes (for live location)
 * Returns a watch ID that can be used with clearWatch
 */
export const watchLocation = (
  onLocationUpdate: (location: LocationData) => void,
  onError?: (error: GeolocationPositionError) => void
): number | null => {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    console.warn('Geolocation is not supported by this browser');
    return null;
  }

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      onLocationUpdate({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy || undefined,
      });
    },
    (error) => {
      console.warn('Error watching location:', error.message);
      if (onError) {
        onError(error);
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    }
  );

  return watchId;
};

/**
 * Stop watching location
 */
export const stopWatchingLocation = (watchId: number | null): void => {
  if (watchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
};
