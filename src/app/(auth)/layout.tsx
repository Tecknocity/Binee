'use client';

import { Suspense } from 'react';
import AuthRoute from '@/components/auth/AuthRoute';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <AuthRoute>{children}</AuthRoute>
    </Suspense>
  );
}
