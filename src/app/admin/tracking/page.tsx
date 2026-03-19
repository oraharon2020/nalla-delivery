'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, DriverLocation } from '@/lib/supabase';

// Colors for different drivers
const DRIVER_COLORS = [
  '#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
];

export default function TrackingPage() {
  const [isClient, setIsClient] = useState(false);
  const [locations, setLocations] = useState<DriverLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState('');
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsClient(true);
    loadApiKey();
    loadLocations();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('driver_locations_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'driver_locations',
      }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          setLocations(prev => {
            const filtered = prev.filter(l => l.driver_id !== (payload.new as DriverLocation).driver_id);
            return [...filtered, payload.new as DriverLocation];
          });
        }
      })
      .subscribe();

    // Refresh every 30 seconds as backup
    const refreshInterval = setInterval(loadLocations, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(refreshInterval);
    };
  }, []);

  const loadApiKey = async () => {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'google_maps_api_key')
      .single();
    
    if (data?.value) {
      const key = typeof data.value === 'string' ? data.value.replace(/"/g, '') : data.value;
      setGoogleMapsApiKey(key);
    }
  };

  const loadLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('driver_locations')
        .select('*, driver:users(id, display_name, phone)')
        .order('last_seen', { ascending: false });

      if (error) throw error;
      if (data) setLocations(data);
    } catch (err) {
      console.error('Error loading locations:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load Google Maps script
  useEffect(() => {
    if (!googleMapsApiKey || mapLoaded) return;
    
    // Check if already loaded
    if (window.google?.maps) {
      setMapLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&language=he`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapLoaded(true);
    document.head.appendChild(script);
  }, [googleMapsApiKey, mapLoaded]);

  // Initialize map
  useEffect(() => {
    if (!mapLoaded || !mapContainerRef.current || mapRef.current) return;

    mapRef.current = new google.maps.Map(mapContainerRef.current, {
      center: { lat: 32.0853, lng: 34.7818 }, // Tel Aviv
      zoom: 10,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });
  }, [mapLoaded]);

  // Update markers when locations change
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const currentDriverIds = new Set(locations.map(l => l.driver_id));

    // Remove markers for drivers no longer in the list
    markersRef.current.forEach((marker, driverId) => {
      if (!currentDriverIds.has(driverId)) {
        marker.setMap(null);
        markersRef.current.delete(driverId);
      }
    });

    // Update or create markers
    locations.forEach((loc, index) => {
      const position = { lat: loc.latitude, lng: loc.longitude };
      const driverName = loc.driver?.display_name || 'נהג';
      const isOnline = loc.is_online && isRecentlyActive(loc.last_seen);
      const color = DRIVER_COLORS[index % DRIVER_COLORS.length];

      const existingMarker = markersRef.current.get(loc.driver_id);
      
      if (existingMarker) {
        existingMarker.setPosition(position);
        existingMarker.setIcon(createMarkerIcon(color, isOnline));
      } else {
        const marker = new google.maps.Marker({
          position,
          map: mapRef.current!,
          icon: createMarkerIcon(color, isOnline),
          title: driverName,
        });

        const infoWindow = new google.maps.InfoWindow({
          content: createInfoContent(loc, isOnline),
        });

        marker.addListener('click', () => {
          infoWindow.open(mapRef.current!, marker);
          setSelectedDriver(loc.driver_id);
        });

        markersRef.current.set(loc.driver_id, marker);
      }
    });

    // Auto-fit bounds if multiple drivers
    if (locations.length > 1 && !selectedDriver) {
      const bounds = new google.maps.LatLngBounds();
      locations.forEach(loc => {
        bounds.extend({ lat: loc.latitude, lng: loc.longitude });
      });
      mapRef.current.fitBounds(bounds, 50);
    }
  }, [locations, mapLoaded, selectedDriver]);

  const focusDriver = useCallback((driverId: string) => {
    const loc = locations.find(l => l.driver_id === driverId);
    if (loc && mapRef.current) {
      mapRef.current.panTo({ lat: loc.latitude, lng: loc.longitude });
      mapRef.current.setZoom(15);
      setSelectedDriver(driverId);
    }
  }, [locations]);

  if (!isClient) return null;

  return (
    <div className="p-6 h-[calc(100vh-64px)]" dir="rtl">
      <div className="flex gap-4 h-full">
        {/* Sidebar - driver list */}
        <div className="w-72 bg-white rounded-lg shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b bg-gray-50">
            <h2 className="text-lg font-semibold">📍 מעקב נהגים חי</h2>
            <p className="text-sm text-gray-500 mt-1">
              {locations.filter(l => l.is_online && isRecentlyActive(l.last_seen)).length} מתוך {locations.length} מחוברים
            </p>
          </div>
          
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-4 text-center text-gray-500">טוען...</div>
            ) : locations.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <div className="text-3xl mb-2">📍</div>
                <p>אין נהגים מחוברים</p>
                <p className="text-xs mt-1">הנהגים יופיעו כשיפתחו את האפליקציה</p>
              </div>
            ) : (
              locations.map((loc, index) => {
                const isOnline = loc.is_online && isRecentlyActive(loc.last_seen);
                const color = DRIVER_COLORS[index % DRIVER_COLORS.length];
                
                return (
                  <button
                    key={loc.driver_id}
                    onClick={() => focusDriver(loc.driver_id)}
                    className={`w-full text-right p-3 border-b hover:bg-gray-50 transition-colors ${
                      selectedDriver === loc.driver_id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: isOnline ? color : '#9CA3AF' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {loc.driver?.display_name || 'נהג'}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className={isOnline ? 'text-green-600' : 'text-gray-400'}>
                            {isOnline ? '● מחובר' : '○ לא מחובר'}
                          </span>
                          <span className="text-gray-400">
                            {formatLastSeen(loc.last_seen)}
                          </span>
                        </div>
                        {loc.speed != null && loc.speed > 0 && isOnline && (
                          <div className="text-xs text-blue-600 mt-0.5">
                            🚗 {Math.round(loc.speed * 3.6)} קמ"ש
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 bg-white rounded-lg shadow-sm overflow-hidden relative">
          {!googleMapsApiKey ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <div className="text-4xl mb-3">🗺️</div>
                <p>יש להגדיר מפתח Google Maps בהגדרות</p>
              </div>
            </div>
          ) : (
            <div ref={mapContainerRef} className="w-full h-full" />
          )}
        </div>
      </div>
    </div>
  );
}

// Helper functions

function isRecentlyActive(lastSeen: string): boolean {
  const diff = Date.now() - new Date(lastSeen).getTime();
  return diff < 5 * 60 * 1000; // 5 minutes
}

function formatLastSeen(lastSeen: string): string {
  const diff = Date.now() - new Date(lastSeen).getTime();
  const minutes = Math.floor(diff / 60000);
  
  if (minutes < 1) return 'עכשיו';
  if (minutes < 60) return `לפני ${minutes} דק׳`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  
  return new Date(lastSeen).toLocaleDateString('he-IL');
}

function createMarkerIcon(color: string, isOnline: boolean): google.maps.Icon {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
      <path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 26 16 26s16-14 16-26C32 7.2 24.8 0 16 0z" 
            fill="${isOnline ? color : '#9CA3AF'}" stroke="white" stroke-width="2"/>
      <circle cx="16" cy="15" r="7" fill="white"/>
      <text x="16" y="19" text-anchor="middle" font-size="12" fill="${isOnline ? color : '#9CA3AF'}">🚗</text>
    </svg>
  `;
  
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(32, 42),
    anchor: new google.maps.Point(16, 42),
  };
}

function createInfoContent(loc: DriverLocation, isOnline: boolean): string {
  const speedInfo = loc.speed != null && loc.speed > 0 
    ? `<p style="margin:2px 0">🚗 מהירות: ${Math.round(loc.speed * 3.6)} קמ"ש</p>` 
    : '';
  
  return `
    <div dir="rtl" style="padding:8px;font-family:sans-serif;min-width:150px">
      <h3 style="margin:0 0 8px;font-size:16px">${loc.driver?.display_name || 'נהג'}</h3>
      <p style="margin:2px 0;color:${isOnline ? '#16a34a' : '#9CA3AF'}">
        ${isOnline ? '● מחובר' : '○ לא מחובר'}
      </p>
      ${loc.driver?.phone ? `<p style="margin:2px 0">📞 ${loc.driver.phone}</p>` : ''}
      ${speedInfo}
      <p style="margin:2px 0;color:#6B7280;font-size:12px">
        עדכון: ${formatLastSeen(loc.last_seen)}
      </p>
    </div>
  `;
}
