import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

type RefreshContextType = {
  refreshTimeslots: () => void;
  refreshBookings: () => void;
  lastRefreshTime: Date | null;
};

const RefreshContext = createContext<RefreshContextType | undefined>(undefined);

export function RefreshProvider({ children }: { children: ReactNode }) {
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const queryClient = useQueryClient();
  
  // Function to refresh timeslots data
  const refreshTimeslots = useCallback(() => {
    console.log('Refreshing timeslots data...');
    queryClient.invalidateQueries({ queryKey: ['/api/timeslots'] });
    setLastRefreshTime(new Date());
  }, [queryClient]);
  
  // Function to refresh bookings data
  const refreshBookings = useCallback(() => {
    console.log('Refreshing bookings data...');
    queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
    queryClient.invalidateQueries({ queryKey: ['/api/user/bookings'] });
    setLastRefreshTime(new Date());
  }, [queryClient]);

  return (
    <RefreshContext.Provider
      value={{
        refreshTimeslots,
        refreshBookings,
        lastRefreshTime
      }}
    >
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefresh() {
  const context = useContext(RefreshContext);
  if (context === undefined) {
    throw new Error("useRefresh must be used within a RefreshProvider");
  }
  return context;
}