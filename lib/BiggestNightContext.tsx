import { createContext, useContext, ReactNode } from 'react';

type BiggestNightContextType = {
  pickedCount: number;
  totalCategories: number;
  isLocked: boolean;
  isSaving: boolean;
};

const BiggestNightContext = createContext<BiggestNightContextType | null>(null);

export function BiggestNightProvider({ children, value }: { children: ReactNode; value: BiggestNightContextType }) {
  return (
    <BiggestNightContext.Provider value={value}>
      {children}
    </BiggestNightContext.Provider>
  );
}

export function useBiggestNight() {
  const context = useContext(BiggestNightContext);
  return context || null;
}
