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
import { getUserAvatar } from '@/lib/avatars';

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

type UserDisplay = {
  name: string;
  avatar: string;
};

const COLORS = [
  '#FF6B6B',
  '#4ECDC4', 
  '#45B7D1', 
  '#96CEB4',
  '#FFEEAD', 
  '#D4A5A5', 
  '#9B59B6',
  '#3498DB', 
  '#E67E22', 
  '#27AE60', 
];

const ADJECTIVES = [
  'Swift', 'Brave', 'Clever', 'Mighty', 'Noble', 
  'Wise', 'Lucky', 'Bright', 'Wild', 'Calm'
];

const NOUNS = [
  'Fox', 'Eagle', 'Wolf', 'Bear', 'Lion', 
  'Tiger', 'Hawk', 'Deer', 'Owl', 'Dolphin'
];

export default function MouseTracker() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Record<string, maplibregl.Marker>>({});
  const pinsRef = useRef<maplibregl.Marker[]>([]);
  const channelRef = useRef<any>(null);
  const [userId, setUserId] = useState<string>('');
  const [status, setStatus] = useState<string>('Idle');
  const [presenceState, setPresenceState] = useState<Record<string, PresenceState[]>>({});
  const colorMapRef = useRef<Record<string, string>>({});
  const nameMapRef = useRef<Record<string, string>>({});

  useEffect(() => {
    setUserId(uuidv4());
  }, []);

  const getOrCreateUserColor = useCallback((uid: string): string => {
    if (colorMapRef.current[uid]) {
      return colorMapRef.current[uid];
    }

    const usedColors = Object.values(colorMapRef.current);
    const availableColors = COLORS.filter(color => !usedColors.includes(color));
    
    const newColor = availableColors.length > 0
      ? availableColors[Math.floor(Math.random() * availableColors.length)]
      : `#${Math.floor(Math.random()*16777215).toString(16)}`;
    
    colorMapRef.current[uid] = newColor;
    return newColor;
  }, []);

  const getOrCreateUserName = useCallback((uid: string): string => {
    if (nameMapRef.current[uid]) {
      return nameMapRef.current[uid];
    }

    const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const name = `${adjective} ${noun}`;
    nameMapRef.current[uid] = name;
    return name;
  }, []);

  const createMarkerElement = useCallback((isOwn: boolean, isPin: boolean = false, uid: string): HTMLDivElement => {
    const container = document.createElement('div');
    
    const dot = document.createElement('div');
    const userColor = isOwn ? '#2563EB' : getOrCreateUserColor(uid);
    
    dot.style.cssText = `
      width: ${isPin ? '10px' : '15px'};
      height: ${isPin ? '10px' : '15px'};
      border-radius: 50%;
      background-color: ${userColor};
      border: 2px solid white;
      box-shadow: 0 0 4px rgba(0,0,0,0.4);
    `;
    
    container.appendChild(dot);
    
    if (!isPin) {
      const label = document.createElement('div');
      label.style.cssText = `
        position: absolute;
        top: -25px;
        left: 50%;
        transform: translateX(-50%);
        background: black;
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 12px;
        white-space: nowrap;
      `;
      label.textContent = isOwn ? 'You' : getOrCreateUserName(uid);
      container.appendChild(label);
    }
    
    return container;
  }, [getOrCreateUserColor, getOrCreateUserName]);

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
      const marker = new maplibregl.Marker({ element })
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
      markersRef.current[userId] = new maplibregl.Marker({ element: ownElement })
        .setLngLat(e.lngLat)
        .addTo(mapRef.current);
    } else {
      markersRef.current[userId]?.setLngLat(e.lngLat);
    }

    throttledBroadcast(e.lngLat);
  }, [userId, throttledBroadcast]);

  // Initialize map and channel
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
            markersRef.current[user_id] = new maplibregl.Marker({ element })
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
              const element = createMarkerElement(pin.user_id === userId, true, pin.user_id);
              if (mapRef.current) {
                const marker = new maplibregl.Marker({ element })
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
          colorMapRef.current = {};
          nameMapRef.current = {};
        };
        cleanup();
      };
    }
  }, [throttledBroadcast, userId, handleMouseMove]);

  // Subscribe to pins
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
          const element = createMarkerElement(false, true, user_id);
          const marker = new maplibregl.Marker({ element })
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

  // Cleanup markers
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
      const isCurrentUser = presence.user === userId;
      const name = getOrCreateUserName(presence.user);
      const displayName = isCurrentUser ? `You (${name})` : name;
      const avatar = getUserAvatar(presence.user);
      
      return (
        <div key={key} className="flex items-center gap-2 mb-2">
          <img 
            src={avatar} 
            alt={displayName} 
            className="w-8 h-8 rounded-full bg-white"
            loading="lazy"
          />
          <Badge variant="outline" className="text-xs">
            {displayName}
          </Badge>
        </div>
      );
    });
  };

  return (
    <div className="h-screen w-screen relative">
      <div
        ref={mapContainerRef}
        className="w-full h-full"
      />

      <div className="absolute top-4 left-4 right-4 flex justify-between items-start gap-4 z-10">
        <Card className="bg-white/90 backdrop-blur-sm shadow-lg">
          <CardContent className="p-4">
            <div className="flex flex-col gap-2">
              <Badge variant="outline" className="text-sm">
                Your ID: {userId}
              </Badge>
              <Badge variant="secondary" className="text-sm">
                Online Users: {Object.keys(presenceState).length}
              </Badge>
              <Badge variant="secondary" className="text-sm">
                Status: {status}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/90 backdrop-blur-sm shadow-lg">
          <CardContent className="p-4">
            <div className="flex flex-col gap-2">
              {renderActiveUsers()}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-6">
        <Card className="bg-white/95 backdrop-blur-sm shadow-lg w-fit">
          <CardContent className="p-4 flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-md animate-pulse" />
              <span className="text-sm text-gray-700">Your Cursor</span>
            </div>
            <div className="h-6 w-px bg-gray-200" />
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 border-2 border-white shadow-md" />
              <span className="text-sm text-gray-700">Other Users</span>
            </div>
          </CardContent>
        </Card>

        <Button 
          variant="outline" 
          className="bg-white/95 backdrop-blur-sm shadow-xl rounded-xl px-10 py-6 
          border-2 border-gray-100/50 hover:bg-white hover:scale-105 transition-all duration-300
          text-gray-700 hover:text-gray-900 font-semibold text-lg
          hover:border-red-200 hover:shadow-red-100/50 group"
          onClick={clearMarkers}
        >
          <span className="group-hover:text-red-600 transition-colors">Clear All Markers</span>
        </Button>
      </div>
    </div>
  );
}