'use client';

import { AuthProvider } from '@/components/auth/AuthProvider';
import AppLayout from '@/components/layout/AppLayout';

export default function AppRouteLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppLayout>{children}</AppLayout>
    </AuthProvider>
  );
}
