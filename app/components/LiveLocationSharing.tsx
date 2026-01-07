/**
 * Live Location Sharing Component
 *
 * UI for sharing live location in a chat
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { startLiveLocation, updateLiveLocation, stopLiveLocation } from '../api/location';
import { watchLocation, stopWatchingLocation, LocationData } from '../utils/location';

interface LiveLocationSharingProps {
  token: string;
  chatId?: string;
  onError?: (error: string) => void;
}

export default function LiveLocationSharing({
  token,
  chatId,
  onError,
}: LiveLocationSharingProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const liveSessionIdRef = useRef<string | null>(null);
  const currentLocationRef = useRef<LocationData | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (isSharing) {
        handleStopSharing();
      }
    };
  }, []);

  const handleStartSharing = async () => {
    try {
      // Get initial location
      const location = await new Promise<LocationData>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy || undefined,
            });
          },
          reject,
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });

      setCurrentLocation(location);
      currentLocationRef.current = location;

      // Start live location session
      const session = await startLiveLocation(token, {
        chatId,
        ...location,
      });

      const sessionId = session.liveSessionId;
      setLiveSessionId(sessionId);
      liveSessionIdRef.current = sessionId;
      setIsSharing(true);

      // Watch location changes
      watchIdRef.current = watchLocation(
        (updatedLocation) => {
          setCurrentLocation(updatedLocation);
          currentLocationRef.current = updatedLocation;
        },
        (error) => {
          console.error('Location watch error:', error);
          if (onError) {
            onError('Failed to track location');
          }
        }
      );

      // Update location every 12 seconds
      updateIntervalRef.current = setInterval(async () => {
        const currentLoc = currentLocationRef.current;
        const sessionIdToUse = liveSessionIdRef.current;
        if (sessionIdToUse && currentLoc) {
          try {
            await updateLiveLocation(token, sessionIdToUse, currentLoc);
          } catch (err) {
            console.error('Failed to update live location:', err);
          }
        }
      }, 12000);
    } catch (err: any) {
      console.error('Failed to start live location:', err);
      if (onError) {
        onError(err.response?.data?.message || 'Failed to start live location');
      }
    }
  };

  const handleStopSharing = async () => {
    if (liveSessionId) {
      try {
        await stopLiveLocation(token, liveSessionId);
      } catch (err) {
        console.error('Failed to stop live location:', err);
      }
    }

    if (watchIdRef.current !== null) {
      stopWatchingLocation(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }

    setIsSharing(false);
    setLiveSessionId(null);
    liveSessionIdRef.current = null;
    setCurrentLocation(null);
    currentLocationRef.current = null;
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span className="font-semibold">Live Location</span>
        </div>
        {isSharing && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-400">Sharing</span>
          </div>
        )}
      </div>

      {currentLocation && (
        <div className="text-sm text-gray-400 mb-3">
          {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
        </div>
      )}

      {!isSharing ? (
        <button
          onClick={handleStartSharing}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
        >
          Start Sharing Live Location
        </button>
      ) : (
        <button
          onClick={handleStopSharing}
          className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white"
        >
          Stop Sharing
        </button>
      )}
    </div>
  );
}
