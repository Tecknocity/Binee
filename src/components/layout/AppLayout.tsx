'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import Sidebar from '@/components/layout/Sidebar';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';

// Pages that need full-height edge-to-edge layout (no padding)
const FULL_BLEED_PAGES = ['/chat'];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  const pathname = usePathname();
  const isFullBleed = FULL_BLEED_PAGES.some((p) => pathname === p || pathname.startsWith(p + '/'));

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-base flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center overflow-hidden animate-pulse">
            <Image src="/Binee__icon__white.svg" alt="Binee" width={32} height={32} unoptimized />
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <Loader2 className="w-5 h-5 text-accent animate-spin" />
            <p className="text-text-secondary text-sm">Loading workspace...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh bg-navy-base flex overflow-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-auto">
        {isFullBleed ? (
          children
        ) : (
          <div className="p-6 lg:p-8 pt-16 lg:pt-8">{children}</div>
        )}
      </main>
    </div>
  );
}
