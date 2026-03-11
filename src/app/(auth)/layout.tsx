'use client';

import { AuthProvider } from '@/components/auth/AuthProvider';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-navy-base flex items-center justify-center px-4">
        {children}
      </div>
    </AuthProvider>
  );
}
