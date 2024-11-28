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

type Movement = {
  user_id: string;
  x: number;
  y: number;
};

type Pin = {
  id?: string;
  user_id: string;
  x: number;
  y: number;
  created_at?: string;
};

type PresenceState = {
  user: string;
  online_at: string;
};

type PresenceEventPayload = {
  key: string;
  newPresences: PresenceState[];
  leftPresences: PresenceState[];
};

export default function MouseTracker() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Record<string, maplibregl.Marker>>({});
  const pinsRef = useRef<maplibregl.Marker[]>([]);
  const channelRef = useRef<any>(null);
  const [userId, setUserId] = useState<string>('');
  const [status, setStatus] = useState<string>('Idle');
  const [presenceState, setPresenceState] = useState<Record<string, PresenceState[]>>({});

  useEffect(() => {
    setUserId(uuidv4());
  }, []);

  const createMarkerElement = (isOwn: boolean, isPin: boolean = false, userId: string): HTMLDivElement => {
    const container = document.createElement('div');
    container.className = 'marker-container';
    container.style.position = 'relative';
    
    const dot = document.createElement('div');
    dot.className = `${isPin ? 'pin' : 'marker'}-${isOwn ? 'own' : 'other'}`;
    dot.style.width = isPin ? '10px' : '15px';
    dot.style.height = isPin ? '10px' : '15px';
    dot.style.borderRadius = '50%';
    dot.style.backgroundColor = isOwn ? 'rgba(0, 0, 255, 0.7)' : 'rgba(255, 0, 0, 0.7)';
    dot.style.border = '2px solid white';
    dot.style.boxShadow = '0 0 4px rgba(0,0,0,0.4)';
    
    const label = document.createElement('div');
    label.className = 'marker-label';
    label.style.position = 'absolute';
    label.style.top = '-25px';
    label.style.left = '50%';
    label.style.transform = 'translateX(-50%)';
    label.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    label.style.color = 'white';
    label.style.padding = '2px 6px';
    label.style.borderRadius = '4px';
    label.style.fontSize = '12px';
    label.style.whiteSpace = 'nowrap';
    label.style.pointerEvents = 'none';
    label.textContent = isOwn ? 'You' : `User ${userId.slice(0, 6)}`;

    container.appendChild(dot);
    if (!isPin) {  // Only show label for cursor markers, not pins
      container.appendChild(label);
    }
    
    return container;
  };

  const throttledBroadcast = useCallback(
    throttle((lngLat: maplibregl.LngLat) => {
      if (!userId || !channelRef.current) return;

      channelRef.current.send({
        type: 'broadcast',
        event: 'mouse-move',
        payload: { user_id: userId, x: lngLat.lng, y: lngLat.lat }
      });
      
      setStatus('Moving');
    }, 100),
    [userId]
  );

  const dropPin = async (lngLat: maplibregl.LngLat) => {
    if (!userId || !mapRef.current) return;

    setStatus('Dropping pin...');
    
    try {
      const element = createMarkerElement(true, true, userId);
      const marker = new maplibregl.Marker(element)
        .setLngLat(lngLat)
        .addTo(mapRef.current);

      pinsRef.current.push(marker);

      await Geobase.from('pins').insert([{ user_id: userId, x: lngLat.lng, y: lngLat.lat }]);

      setStatus('Pin dropped');
    } catch (error) {
      console.error('Error dropping pin:', error);
      setStatus('Failed to drop pin');
    }
  };

  const handleMouseMove = useCallback((e: maplibregl.MapMouseEvent) => {
    if (!mapRef.current || !userId) return;

    if (!markersRef.current[userId]) {
      const ownElement = createMarkerElement(true, false, userId);
      markersRef.current[userId] = new maplibregl.Marker(ownElement)
        .setLngLat(e.lngLat)
        .addTo(mapRef.current);
    } else {
      markersRef.current[userId]?.setLngLat(e.lngLat);
    }

    throttledBroadcast(e.lngLat);
  }, [userId, throttledBroadcast]);

  useEffect(() => {
    if (typeof window !== 'undefined' && mapContainerRef.current && userId) {
      mapRef.current = new maplibregl.Map({
        container: mapContainerRef.current,
        style: 'https://demotiles.maplibre.org/style.json',
        center: [0, 0],
        zoom: 2,
      });

      channelRef.current = Geobase.channel('room_01', {
        config: {
          broadcast: { self: false },
          presence: {
            key: userId,
          },
        },
      });

      channelRef.current
        .on('broadcast', { event: 'mouse-move' }, (payload: { payload: Movement }) => {
          const { user_id, x, y } = payload.payload;
          if (!mapRef.current || user_id === userId) return;

          const lngLat = new maplibregl.LngLat(x, y);

          if (!markersRef.current[user_id]) {
            const element = createMarkerElement(false, false, user_id);
            markersRef.current[user_id] = new maplibregl.Marker(element)
              .setLngLat(lngLat)
              .addTo(mapRef.current);
          } else {
            markersRef.current[user_id]?.setLngLat(lngLat);
          }
        })
        .on('presence', { event: 'sync' }, () => {
          const state = channelRef.current.presenceState() as Record<string, PresenceState[]>;
          console.log('sync', state);
          setPresenceState(state);
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }: PresenceEventPayload) => {
          console.log('join', key, newPresences);
          setPresenceState(current => ({
            ...current,
            [key]: newPresences
          }));
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }: PresenceEventPayload) => {
          console.log('leave', key, leftPresences);
          setPresenceState(current => {
            const newState = { ...current };
            delete newState[key];
            return newState;
          });
        })
        .subscribe(async (status: string) => {
          if (status !== 'SUBSCRIBED') return;
          
          await channelRef.current.track({
            user: userId,
            online_at: new Date().toISOString(),
          });
        });
  
      const handleMapClick = (e: maplibregl.MapMouseEvent) => {
        dropPin(e.lngLat);
      };
  
      mapRef.current.on('mousemove', handleMouseMove);
      mapRef.current.on('click', handleMapClick);
  
      Geobase.from('pins')
        .select('*')
        .then(({ data, error }) => {
          if (error) {
            console.error('Error fetching pins:', error);
            return;
          }
  
          if (data && mapRef.current) {
            data.forEach((pin: Pin) => {
              const lngLat = new maplibregl.LngLat(pin.x, pin.y);
              const element = createMarkerElement(pin.user_id === userId, true, userId);
              if (mapRef.current) {
                const marker = new maplibregl.Marker(element)
                  .setLngLat(lngLat)
                  .addTo(mapRef.current);

                pinsRef.current.push(marker);
              }
            });
          }
        });
  
      return () => {
        const cleanup = async () => {
          if (channelRef.current) {
            await channelRef.current.untrack();
            Geobase.removeChannel(channelRef.current);
          }
          mapRef.current?.off('mousemove', handleMouseMove);
          mapRef.current?.off('click', handleMapClick);
          Object.values(markersRef.current).forEach(marker => marker.remove());
          pinsRef.current.forEach(marker => marker.remove());
          mapRef.current?.remove();
        };
        cleanup();
      };
    }
  }, [throttledBroadcast, userId, handleMouseMove]);

  useEffect(() => {
    const pinsSubscription = Geobase
      .channel('public:pins')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pins' },
        (payload: { new: Pin }) => {
          const { user_id, x, y } = payload.new;
          if (!mapRef.current || user_id === userId) return;

          const lngLat = new maplibregl.LngLat(x, y);
          const element = createMarkerElement(false, true, userId);
          const marker = new maplibregl.Marker(element)
            .setLngLat(lngLat)
            .addTo(mapRef.current);

          pinsRef.current.push(marker);
        }
      )
      .subscribe();

    return () => {
      Geobase.removeChannel(pinsSubscription);
    };
  }, [userId]);

  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      Object.entries(markersRef.current).forEach(([id, marker]) => {
        if (id !== userId) {
          marker.remove();
          delete markersRef.current[id];
        }
      });
    }, 5000);

    return () => clearInterval(cleanupInterval);
  }, [userId]);

  const clearMarkers = useCallback(() => {
    pinsRef.current.forEach(marker => marker.remove());
    pinsRef.current = [];
    Object.entries(markersRef.current).forEach(([id, marker]) => {
      if (id !== userId) {
        marker.remove();
        delete markersRef.current[id];
      }
    });
  }, [userId]);

  const renderActiveUsers = () => {
    return Object.entries(presenceState).map(([key, presences]) => {
      const presence = presences[0];
      return (
        <Badge key={key} variant="outline" className="text-xs">
          {presence.user === userId ? 'You' : `User ${presence.user}`}
        </Badge>
      );
    });
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
              Your ID: {userId}
            </Badge>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-sm">
                Online Users: {Object.keys(presenceState).length}
              </Badge>
            </div>
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
          <div className="w-full flex justify-between items-center">
            <Button variant="outline" className="mt-2" onClick={clearMarkers}>
              Clear Markers
            </Button>
            <div className="flex flex-col gap-1">
              {renderActiveUsers()}
            </div>
          </div>
          <div className="flex justify-between w-full mt-4 text-sm text-gray-500">
            <span className="text-blue-500 font-medium">Blue: You</span>
            <span className="text-red-500 font-medium">Red: Others</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}