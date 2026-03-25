import { redirect } from 'next/navigation';

export default function BillingSettingsRoute() {
  redirect('/settings?tab=billing');
}
