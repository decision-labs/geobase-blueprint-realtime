'use client';

import { useEffect, useRef, useState } from 'react';
import { Geobase } from '@/lib/geobase';
import { v4 as uuidv4 } from 'uuid';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type MouseMovement = {
  user_id: string;
  x: number;
  y: number;
  created_at: string;
};

export default function MouseTracker() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mouseMovements, setMouseMovements] = useState<MouseMovement[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Idle'); 

  useEffect(() => {
    setUserId(uuidv4());
  }, []);

  const logMouseMovement = async (x: number, y: number) => {
    if (!userId) return;
    setStatus('Tracking...'); 
    await Geobase.from('mouse_movements').insert([{ user_id: userId, x, y }]);
  };

  useEffect(() => {
    const subscription = Geobase
      .channel('public:mouse_movements')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mouse_movements' },
        (payload: { new: MouseMovement }) => {
          const newMovement = payload.new;
          setMouseMovements((prev) => [...prev, newMovement]);
        }
      )
      .subscribe();

    return () => {
      Geobase.removeChannel(subscription);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    mouseMovements.forEach(({ x, y, user_id }) => {
      ctx.fillStyle = user_id === userId ? 'blue' : 'red';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    setStatus('Idle');
  }, [mouseMovements, userId]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    logMouseMovement(x, y);
  };

  const clearCanvas = () => {
    setMouseMovements([]);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-6">
      <Card className="w-full max-w-4xl shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-semibold text-gray-800">
            Shared Mouse Tracker
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
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              className="border border-gray-300 rounded-lg shadow-md w-full max-w-full h-auto"
              onMouseMove={handleMouseMove}
            />
          </div>
          <Button variant="outline" className="mt-2" onClick={clearCanvas}>
            Clear Canvas
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
