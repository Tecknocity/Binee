'use client';

import { AuthProvider } from '@/components/auth/AuthProvider';
import AppLayout from '@/components/layout/AppLayout';
import { SidebarProvider } from '@/hooks/useSidebar';

export default function AppRouteLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SidebarProvider>
        <AppLayout>{children}</AppLayout>
      </SidebarProvider>
    </AuthProvider>
  );
}
