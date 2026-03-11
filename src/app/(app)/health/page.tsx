'use client';

import HealthPage from '@/components/dashboard/HealthPage';
import { ClickUpGate } from '@/components/shared/ClickUpGate';

export default function HealthRoute() {
  return (
    <ClickUpGate>
      <HealthPage />
    </ClickUpGate>
  );
}
