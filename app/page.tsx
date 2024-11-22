'use client';

import { useEffect, useState } from 'react';
import { Geobase } from '@/lib/geobase';
import { useRouter } from 'next/navigation';

export default function Page() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchUserAndSession = async () => {
      const { data: { session } } = await Geobase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }


      let newSessionId = localStorage.getItem('session_id');
      if (!newSessionId) {
        newSessionId = ''; 
        localStorage.setItem('session_id', newSessionId);
      }

      const newUserId = localStorage.getItem('user_id') || session.user.id;
      localStorage.setItem('user_id', newUserId);


      setSessionId(newSessionId);
      setUserId(newUserId);
    };

    fetchUserAndSession();
  }, [router]);

  const handleLogout = async () => {
    await Geobase.auth.signOut();
    router.push('/login');
  };

  if (!sessionId || !userId) return <p>Loading...</p>;

  return (
    <div className="h-screen flex items-center justify-center">
      <div>
        <button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
