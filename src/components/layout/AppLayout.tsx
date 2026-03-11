'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import Sidebar from '@/components/layout/Sidebar';
import { Loader2, Hexagon } from 'lucide-react';

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
          <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center">
            <Hexagon className="w-6 h-6 text-accent animate-pulse" />
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
    <div className="min-h-screen bg-navy-base flex">
      <Sidebar />
      <main className="flex-1 min-h-screen overflow-auto">
        {isFullBleed ? (
          children
        ) : (
          <div className="p-6 lg:p-8 pt-16 lg:pt-8">{children}</div>
        )}
      </main>
    </div>
  );
}
