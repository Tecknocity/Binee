'use client';

import DashboardPage from '@/components/dashboard/DashboardPage';
import { ClickUpGate } from '@/components/shared/ClickUpGate';

export default function DashboardsRoute() {
  return (
    <ClickUpGate>
      <DashboardPage />
    </ClickUpGate>
  );
}
