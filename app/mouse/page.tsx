'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Geobase } from '@/lib/geobase';
import { v4 as uuidv4 } from 'uuid';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { throttle } from 'lodash';

type MouseMovement = {
  user_id: string;
  x: number;
  y: number;
  created_at: string;
};

export default function MouseTracker() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mouseMovements, setMouseMovements] = useState<MouseMovement[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Idle'); 
  const mouseMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [userPositions, setUserPositions] = useState<Record<string, maplibregl.LngLat>>({});

  const throttledBroadcast = useCallback(
    throttle((lngLat: maplibregl.LngLat) => {
      console.log('Broadcasting position:', lngLat);
      console.log('Current userId:', userId);
      if (!userId) return;
      
      // Insert the mouse position into the database
      Geobase.from('mouse_movements')
        .insert([{ 
          user_id: userId, 
          x: lngLat.lng, 
          y: lngLat.lat 
        }])
        .then(response => {
          console.log('Insert response:', response);
        })
        .catch(error => {
          console.error('Insert error:', error);
        });
    }, 50),
    [userId]
  );

  useEffect(() => {
    const newUserId = uuidv4();
    setUserId(newUserId);
    console.log('Set userId:', newUserId);
  }, []);

  const logMouseMovement = async (lngLat: maplibregl.LngLat) => {
    console.log('Current userId:', userId);
    if (!userId) {
      console.log('No userId available, skipping movement logging');
      return;
    }
    
    setStatus('Tracking...');
    try {
      await Geobase.from('mouse_movements').insert([{ 
        user_id: userId, 
        x: lngLat.lng, 
        y: lngLat.lat 
      }]);
      console.log('Movement logged successfully');
    } catch (error) {
      console.error('Error logging movement:', error);
      setStatus('Error logging movement');
    }
  };

  // Listen for database changes
  useEffect(() => {
    console.log('Setting up subscription with userId:', userId);

    const subscription = Geobase
      .channel('public:mouse_movements')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mouse_movements' },
        (payload: { new: MouseMovement }) => {
          console.log('New movement received:', payload.new);
          if (payload.new.user_id !== userId) {
            setUserPositions(prev => ({
              ...prev,
              [payload.new.user_id]: new maplibregl.LngLat(payload.new.x, payload.new.y)
            }));
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    console.log('Subscribed to channel:', subscription);

    return () => {
      console.log('Cleaning up subscription');
      Geobase.removeChannel(subscription);
    };
  }, [userId]);

  useEffect(() => {
    if (!mapContainerRef.current || !userId) return;

    console.log('Initializing map with userId:', userId);
    
    mapRef.current = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [0, 0],
      zoom: 2
    });

    const el = document.createElement('div');
    el.className = 'mouse-tracker';
    el.style.width = '15px';
    el.style.height = '15px';
    el.style.borderRadius = '50%';
    el.style.backgroundColor = 'rgba(0, 0, 255, 0.5)';
    el.style.border = '2px solid white';
    el.style.boxShadow = '0 0 4px rgba(0,0,0,0.4)';

    mouseMarkerRef.current = new maplibregl.Marker(el);

    const handleMouseMove = (e: maplibregl.MapMouseEvent) => {
      if (mouseMarkerRef.current) {
        mouseMarkerRef.current.setLngLat(e.lngLat).addTo(mapRef.current!);
      }
      throttledBroadcast(e.lngLat);
    };

    mapRef.current.on('mousemove', handleMouseMove);
    mapRef.current.on('click', handleMapClick);

    return () => {
      mapRef.current?.off('mousemove', handleMouseMove);
      mapRef.current?.off('click', handleMapClick);
      mouseMarkerRef.current?.remove();
      mapRef.current?.remove();
    };
  }, [userId, throttledBroadcast]);

  useEffect(() => {
    if (!mapRef.current) return;

    console.log('Current mouse movements:', mouseMovements);

    // Remove existing markers
    const markers = document.getElementsByClassName('mouse-marker');
    while (markers[0]) {
      markers[0].remove();
    }

    // Add new markers
    mouseMovements.forEach(({ x, y, user_id }) => {
      console.log('Creating marker:', x, y, user_id);
      const el = document.createElement('div');
      el.className = 'mouse-marker';
      el.style.width = '10px';
      el.style.height = '10px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = user_id === userId ? 'blue' : 'red';

      new maplibregl.Marker(el)
        .setLngLat([x, y])
        .addTo(mapRef.current!);
    });

    setStatus('Idle');
  }, [mouseMovements, userId]);

  useEffect(() => {
    if (!mapRef.current) return;

    // Clear old markers
    const markers = document.getElementsByClassName('user-mouse-marker');
    while (markers[0]) {
      markers[0].remove();
    }

    // Create markers for each user position
    Object.entries(userPositions).forEach(([user_id, lngLat]) => {
      const el = document.createElement('div');
      el.className = 'user-mouse-marker';
      el.style.width = '15px';
      el.style.height = '15px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
      el.style.border = '2px solid white';
      el.style.boxShadow = '0 0 4px rgba(0,0,0,0.4)';

      new maplibregl.Marker(el)
        .setLngLat(lngLat)
        .addTo(mapRef.current!);
    });
  }, [userPositions]);

  const handleMapClick = (e: maplibregl.MapMouseEvent) => {
    console.log('Map clicked:', e.lngLat);
    logMouseMovement(e.lngLat);
  };

  const clearMarkers = () => {
    setMouseMovements([]);
    const markers = document.getElementsByClassName('mouse-marker');
    while (markers[0]) {
      markers[0].remove();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-6">
      <Card className="w-full max-w-4xl shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-semibold text-gray-800">
            Shared Map Tracker
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          <div className="flex items-center justify-between w-full mb-4">
            <Badge variant="outline" className="text-sm">
              Your User ID: {userId ?? 'Loading...'}
            </Badge>
            <Badge variant="secondary" className="text-sm">
              Status: {status}
            </Badge>
          </div>
          <div className="relative mb-4">
            <div
              ref={mapContainerRef}
              className="w-[800px] h-[600px] rounded-lg shadow-md"
            />
          </div>
          <Button variant="outline" className="mt-2" onClick={clearMarkers}>
            Clear Markers
          </Button>
          <div className="flex justify-between w-full mt-4 text-sm text-gray-500">
            <span className="text-blue-500 font-medium">Blue: You</span>
            <span className="text-red-500 font-medium">Red: Others</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
