export const mockUser = {
  id: 'usr_1',
  name: 'Arman Kazemi',
  email: 'arman@tecknocity.com',
  avatarUrl: '',
  company: 'Tecknocity',
  role: 'CEO & Founder',
  timezone: 'America/New_York',
  hasCompletedOnboarding: true,
  plan: 'pro' as const,
  createdAt: '2025-09-15T10:00:00Z',
};

export type User = typeof mockUser;
