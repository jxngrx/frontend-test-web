'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ChatApp from './components/SessionPanel';

const STORAGE_KEY = 'chat_session';

export default function Home() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Check authentication status
    const checkAuth = () => {
      try {
        const savedSession = localStorage.getItem(STORAGE_KEY);
        if (savedSession) {
          const session = JSON.parse(savedSession);
          if (session.token && session.userId) {
            setIsAuthenticated(true);
            return;
          }
        }
        setIsAuthenticated(false);
        router.push('/login');
      } catch (error) {
        setIsAuthenticated(false);
        router.push('/login');
      }
    };

    checkAuth();
  }, [router]);

  if (isAuthenticated === null) {
    // Loading state
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Router will handle redirect
  }

  return <ChatApp />;
}
