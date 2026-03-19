'use client';

import { useEffect, useRef, useCallback } from 'react';

const SEND_INTERVAL = 30000; // 30 seconds

export function useGpsTracker() {
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPositionRef = useRef<GeolocationPosition | null>(null);

  const sendLocation = useCallback(async (position: GeolocationPosition) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await fetch('/api/driver-location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          heading: position.coords.heading,
        }),
      });
    } catch (e) {
      // Silent fail - don't disrupt user experience
    }
  }, []);

  const markOffline = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await fetch('/api/driver-location', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // Silent fail
    }
  }, []);

  useEffect(() => {
    if (!('geolocation' in navigator)) return;

    // Request permission and start watching
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        lastPositionRef.current = position;
      },
      (error) => {
        console.warn('GPS error:', error.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      }
    );

    // Send location every 30 seconds
    intervalRef.current = setInterval(() => {
      if (lastPositionRef.current) {
        sendLocation(lastPositionRef.current);
      }
    }, SEND_INTERVAL);

    // Send initial location after 2 seconds
    const initialTimeout = setTimeout(() => {
      if (lastPositionRef.current) {
        sendLocation(lastPositionRef.current);
      }
    }, 2000);

    // Cleanup on unmount / tab close
    const handleBeforeUnload = () => {
      markOffline();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Send last known location before going to background
        if (lastPositionRef.current) {
          sendLocation(lastPositionRef.current);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(initialTimeout);
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      markOffline();
    };
  }, [sendLocation, markOffline]);
}
