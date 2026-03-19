import { redirect } from 'next/navigation';

export default function SecuritySettingsRoute() {
  redirect('/settings?tab=privacy');
}
