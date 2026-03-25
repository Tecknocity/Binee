'use client';

import { Suspense } from 'react';
import { AuthProvider } from '@/components/auth/AuthProvider';
import AuthRoute from '@/components/auth/AuthRoute';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Suspense>
        <AuthRoute>{children}</AuthRoute>
      </Suspense>
    </AuthProvider>
  );
}
