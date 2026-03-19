import { redirect } from 'next/navigation';

export default function WorkspaceSettingsRoute() {
  redirect('/settings?tab=workspace');
}
