'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { DeliveryAssignment } from '@/lib/supabase';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface RouteOptimizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliveries: DeliveryAssignment[];
  onSaveRoute: (orderedDeliveries: DeliveryAssignment[]) => void;
  apiKey: string;
}

interface GeocodedDelivery extends DeliveryAssignment {
  lat?: number;
  lng?: number;
}

const mapContainerStyle = {
  width: '100%',
  height: '400px',
};

const israelCenter = {
  lat: 31.7683,
  lng: 35.2137,
};

// Sortable item component
function SortableItem({ delivery, index }: { delivery: GeocodedDelivery; index: number }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: delivery.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`p-2 border rounded mb-2 cursor-grab bg-white ${isDragging ? 'bg-blue-100' : ''}`}
    >
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
          {index + 1}
        </span>
        <div className="flex-1 text-sm">
          <div className="font-medium">#{delivery.order_number}</div>
          <div className="text-gray-500 truncate">{delivery.shipping_address}</div>
        </div>
        <span className="text-gray-400">☰</span>
      </div>
    </div>
  );
}

export default function RouteOptimizerModal({
  isOpen,
  onClose,
  deliveries,
  onSaveRoute,
  apiKey,
}: RouteOptimizerModalProps) {
  const [orderedDeliveries, setOrderedDeliveries] = useState<GeocodedDelivery[]>([]);
  const [startAddress, setStartAddress] = useState('');
  const [endAddress, setEndAddress] = useState('');
  const [returnToStart, setReturnToStart] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [mapCenter, setMapCenter] = useState(israelCenter);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: ['places'],
    language: 'he',
    region: 'IL',
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen && deliveries.length > 0) {
      setOrderedDeliveries(deliveries.map(d => ({ ...d })));
      setDirections(null);
    }
  }, [isOpen, deliveries]);

  // Geocode addresses when component loads
  useEffect(() => {
    if (isLoaded && orderedDeliveries.length > 0) {
      geocodeAddresses();
    }
  }, [isLoaded, orderedDeliveries.length]);

  const geocodeAddresses = async () => {
    if (!window.google) return;
    
    if (!geocoderRef.current) {
      geocoderRef.current = new google.maps.Geocoder();
    }

    const geocodedList = await Promise.all(
      orderedDeliveries.map(async (delivery) => {
        if (delivery.lat && delivery.lng) return delivery;
        
        try {
          const result = await geocoderRef.current!.geocode({
            address: delivery.shipping_address + ', ישראל',
          });
          
          if (result.results[0]) {
            const location = result.results[0].geometry.location;
            return {
              ...delivery,
              lat: location.lat(),
              lng: location.lng(),
            };
          }
        } catch (error) {
          console.error('Geocoding error for:', delivery.shipping_address, error);
        }
        return delivery;
      })
    );

    setOrderedDeliveries(geocodedList);

    // Center map on first valid location
    const firstValid = geocodedList.find(d => d.lat && d.lng);
    if (firstValid && firstValid.lat && firstValid.lng) {
      setMapCenter({ lat: firstValid.lat, lng: firstValid.lng });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedDeliveries.findIndex(d => d.id === active.id);
    const newIndex = orderedDeliveries.findIndex(d => d.id === over.id);

    setOrderedDeliveries(arrayMove(orderedDeliveries, oldIndex, newIndex));
    setDirections(null); // Clear existing directions
  };

  // Calculate route directions for display
  const calculateRoute = useCallback(async () => {
    if (!window.google || orderedDeliveries.length < 2) return;

    const validDeliveries = orderedDeliveries.filter(d => d.lat && d.lng);
    if (validDeliveries.length < 2) return;

    const directionsService = new google.maps.DirectionsService();

    const waypoints = validDeliveries.slice(1, -1).map(d => ({
      location: new google.maps.LatLng(d.lat!, d.lng!),
      stopover: true,
    }));

    try {
      const result = await directionsService.route({
        origin: new google.maps.LatLng(validDeliveries[0].lat!, validDeliveries[0].lng!),
        destination: new google.maps.LatLng(
          validDeliveries[validDeliveries.length - 1].lat!,
          validDeliveries[validDeliveries.length - 1].lng!
        ),
        waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        region: 'IL',
      });
      setDirections(result);
    } catch (error) {
      console.error('Error calculating route:', error);
    }
  }, [orderedDeliveries]);

  // Auto-optimize using simple nearest neighbor (free - no API cost!)
  const optimizeByNearestNeighbor = () => {
    setIsOptimizing(true);
    
    const validDeliveries = orderedDeliveries.filter(d => d.lat && d.lng);
    if (validDeliveries.length < 2) {
      setIsOptimizing(false);
      return;
    }

    // Simple nearest neighbor algorithm
    const optimized: GeocodedDelivery[] = [];
    const remaining = [...validDeliveries];
    
    // Start from first delivery
    let current = remaining.shift()!;
    optimized.push(current);

    while (remaining.length > 0) {
      // Find nearest neighbor
      let nearestIndex = 0;
      let nearestDistance = Infinity;

      remaining.forEach((delivery, index) => {
        const distance = calculateDistance(
          current.lat!, current.lng!,
          delivery.lat!, delivery.lng!
        );
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });

      current = remaining.splice(nearestIndex, 1)[0];
      optimized.push(current);
    }

    // Add back deliveries without coordinates at the end
    const noCoords = orderedDeliveries.filter(d => !d.lat || !d.lng);
    
    setOrderedDeliveries([...optimized, ...noCoords]);
    setIsOptimizing(false);
    calculateRoute();
  };

  // Haversine distance calculation
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const handleSave = () => {
    onSaveRoute(orderedDeliveries);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold">🗺️ סידור קו משלוחים</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Map */}
          <div className="flex-1 p-4">
            {loadError && (
              <div className="h-[400px] bg-red-50 flex items-center justify-center text-red-600">
                שגיאה בטעינת המפה. בדוק את מפתח ה-API
              </div>
            )}
            {!isLoaded && !loadError && (
              <div className="h-[400px] bg-gray-100 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            )}
            {isLoaded && !loadError && (
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={mapCenter}
                zoom={10}
              >
                {/* Markers */}
                {orderedDeliveries.map((delivery, index) => (
                  delivery.lat && delivery.lng && (
                    <Marker
                      key={delivery.id}
                      position={{ lat: delivery.lat, lng: delivery.lng }}
                      label={{
                        text: String(index + 1),
                        color: 'white',
                        fontWeight: 'bold',
                      }}
                      title={`${index + 1}. ${delivery.customer_name}\n${delivery.shipping_address}`}
                    />
                  )
                ))}

                {/* Route */}
                {directions && (
                  <DirectionsRenderer
                    directions={directions}
                    options={{
                      suppressMarkers: true,
                      polylineOptions: {
                        strokeColor: '#4F46E5',
                        strokeWeight: 4,
                      },
                    }}
                  />
                )}
              </GoogleMap>
            )}

            {/* Route info */}
            {directions && directions.routes[0] && (
              <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                <span className="font-medium">מרחק כולל: </span>
                {directions.routes[0].legs.reduce((sum, leg) => sum + (leg.distance?.value || 0), 0) / 1000} ק"מ
                <span className="mx-2">|</span>
                <span className="font-medium">זמן משוער: </span>
                {Math.round(directions.routes[0].legs.reduce((sum, leg) => sum + (leg.duration?.value || 0), 0) / 60)} דקות
              </div>
            )}
          </div>

          {/* Deliveries List */}
          <div className="w-full md:w-80 border-t md:border-t-0 md:border-r p-4 overflow-y-auto max-h-[300px] md:max-h-none">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">סדר משלוחים</h3>
              <span className="text-sm text-gray-500">{orderedDeliveries.length} נקודות</span>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={orderedDeliveries.map(d => d.id)}
                strategy={verticalListSortingStrategy}
              >
                {orderedDeliveries.map((delivery, index) => (
                  <SortableItem
                    key={delivery.id}
                    delivery={delivery}
                    index={index}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex flex-wrap gap-3 justify-between items-center">
          <div className="flex gap-2">
            <button
              onClick={optimizeByNearestNeighbor}
              disabled={isOptimizing || orderedDeliveries.length < 2}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 flex items-center gap-2"
            >
              {isOptimizing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  מחשב...
                </>
              ) : (
                <>🔄 סדר אוטומטי (חינם)</>
              )}
            </button>
            <button
              onClick={calculateRoute}
              disabled={orderedDeliveries.length < 2}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300"
            >
              📍 הצג מסלול
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-gray-100"
            >
              ביטול
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              💾 שמור סדר
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
