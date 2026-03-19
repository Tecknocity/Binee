'use client';

import { Suspense } from 'react';
import { AuthProvider } from '@/components/auth/AuthProvider';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Suspense>{children}</Suspense>
    </AuthProvider>
  );
}
