import React, { createContext, useContext, useState, ReactNode } from 'react';
import { mockUser } from '@/data/mock/user';

interface UserContextType {
  user: typeof mockUser;
  updateUser: (updates: Partial<typeof mockUser>) => void;
  hasCompletedOnboarding: boolean;
  completeOnboarding: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState(mockUser);

  const updateUser = (updates: Partial<typeof mockUser>) => {
    setUser((prev) => ({ ...prev, ...updates }));
  };

  const hasCompletedOnboarding = user.hasCompletedOnboarding;

  const completeOnboarding = () => {
    setUser((prev) => ({ ...prev, hasCompletedOnboarding: true }));
  };

  return (
    <UserContext.Provider
      value={{ user, updateUser, hasCompletedOnboarding, completeOnboarding }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextType {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
