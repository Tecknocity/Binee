'use client';

import { useState } from 'react';
import TeamMembersList from '@/components/settings/TeamMembersList';
import InviteMemberModal from '@/components/settings/InviteMemberModal';

export default function TeamSettings() {
  const [showInviteModal, setShowInviteModal] = useState(false);

  return (
    <div className="space-y-6">
      <TeamMembersList onInviteClick={() => setShowInviteModal(true)} />

      <InviteMemberModal
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
      />
    </div>
  );
}
