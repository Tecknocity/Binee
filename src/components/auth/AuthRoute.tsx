'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';

/**
 * Route guard for auth pages (login, signup, etc.).
 * Redirects already-authenticated users to /chat.
 * Shows a loading spinner while auth state is being determined.
 */
export default function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/chat');
    }
  }, [loading, user, router]);

  if (loading || user) {
    return (
      <div className="min-h-screen bg-navy-base flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center overflow-hidden animate-pulse">
            <Image src="/Binee__icon__white.svg" alt="Binee" width={32} height={32} unoptimized />
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <Loader2 className="w-5 h-5 text-accent animate-spin" />
            <p className="text-text-secondary text-sm">Checking session...</p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
