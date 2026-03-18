import { Suspense } from 'react';
import SettingsLayout from '@/components/settings/SettingsLayout';
import { Loader2 } from 'lucide-react';

export const metadata = {
  title: 'Settings - Binee',
};

function SettingsFallback() {
  return (
    <div className="w-full flex items-center justify-center py-20">
      <Loader2 className="w-5 h-5 text-accent animate-spin" />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsFallback />}>
      <SettingsLayout />
    </Suspense>
  );
}
