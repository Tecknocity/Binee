import React, { createContext, useContext } from 'react';

interface AccountPanelContextType {
  openAccount: (section?: string) => void;
}

const AccountPanelContext = createContext<AccountPanelContextType>({
  openAccount: () => {},
});

export const AccountPanelProvider = AccountPanelContext.Provider;
export const useAccountPanel = () => useContext(AccountPanelContext);
