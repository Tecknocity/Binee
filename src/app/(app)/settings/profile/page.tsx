import { redirect } from 'next/navigation';

export default function ProfileSettingsRoute() {
  redirect('/settings?tab=account');
}
