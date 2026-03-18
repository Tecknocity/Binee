'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { resetPassword } from '@/lib/supabase/auth';

const forgotSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
});

type ForgotFormData = z.infer<typeof forgotSchema>;

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    getValues,
  } = useForm<ForgotFormData>({
    resolver: zodResolver(forgotSchema),
  });

  const onSubmit = async (data: ForgotFormData) => {
    setServerError('');
    const { error } = await resetPassword(data.email);
    if (error) {
      setServerError(error.message);
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <AuthLayout title="Check your email" subtitle="We sent a password reset link">
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
            <Mail size={24} className="text-accent" />
          </div>
          <p className="text-center text-sm text-text-secondary">
            We sent a reset link to{' '}
            <span className="font-medium text-text-primary">{getValues('email')}</span>.
            Check your inbox and follow the link to reset your password.
          </p>
        </div>
        <Link
          href="/login"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-navy-light"
        >
          <ArrowLeft size={16} />
          Back to sign in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Reset your password" subtitle="Enter your email and we'll send you a reset link">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-text-secondary">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            {...register('email')}
            className="w-full rounded-lg border border-border bg-navy-light px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          {errors.email && (
            <p className="mt-1 text-xs text-error">{errors.email.message}</p>
          )}
        </div>

        {serverError && (
          <p className="rounded-lg bg-error/10 px-3 py-2 text-xs text-error">{serverError}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting && <Loader2 size={16} className="animate-spin" />}
          Send reset link
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-text-secondary">
        <Link href="/login" className="inline-flex items-center gap-1 text-accent hover:text-accent-hover transition-colors font-medium">
          <ArrowLeft size={14} />
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
