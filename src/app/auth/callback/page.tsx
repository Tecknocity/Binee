'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.getSession();

      if (error) {
        router.replace('/login');
        return;
      }

      router.replace('/chat');
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-6 h-6 text-[#854DF9] animate-spin" />
        <p className="text-[#A0A0B5] text-sm">Completing sign in...</p>
      </div>
    </div>
  );
}
