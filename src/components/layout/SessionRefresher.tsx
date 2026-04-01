'use client';

import { useRouteSessionRefresh } from '@/hooks/useRouteSessionRefresh';

export function SessionRefresher() {
  useRouteSessionRefresh();
  return null; // Renders nothing, just runs the hook
}
