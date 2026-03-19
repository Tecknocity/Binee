'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';

// Pages that need full-height edge-to-edge layout (no padding)
const FULL_BLEED_PAGES = ['/chat'];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullBleed = FULL_BLEED_PAGES.some((p) => pathname === p || pathname.startsWith(p + '/'));

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
