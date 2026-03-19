'use client';

import { Suspense } from 'react';
import { AuthProvider } from '@/components/auth/AuthProvider';
import AppLayout from '@/components/layout/AppLayout';
import { SidebarProvider } from '@/hooks/useSidebar';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';

function AppLoadingFallback() {
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

export default function AppRouteLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SidebarProvider>
        <Suspense fallback={<AppLoadingFallback />}>
          <AppLayout>{children}</AppLayout>
        </Suspense>
      </SidebarProvider>
    </AuthProvider>
  );
}
