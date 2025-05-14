import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Add TypeScript declaration for window.forceDataRefresh
declare global {
  interface Window {
    reactQueryClient?: QueryClient;
    forceDataRefresh?: () => Promise<void>;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  try {
    // Use appropriate headers and include CSRF token if available
    const headers: Record<string, string> = {};
    
    if (data) {
      headers["Content-Type"] = "application/json";
    }
    
    // The fetch request
    const res = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`${res.status}: ${errorText || res.statusText}`);
    }
    
    return res;
  } catch (error) {
    // Keep error reporting to console for troubleshooting
    console.error(`API request error for ${method} ${url}:`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      const res = await fetch(queryKey[0] as string, {
        credentials: "include",
      });
      
      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`${res.status}: ${errorText || res.statusText}`);
      }
      
      const data = await res.json();
      return data;
    } catch (error) {
      // Keep error reporting to console for troubleshooting
      console.error(`Query error for ${queryKey[0]}:`, error);
      throw error;
    }
  };

// Helper function to add a timestamp to a URL to bust cache
export function addCacheBuster(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_=${Date.now()}`;
}

// Helper function to force a complete refresh of all API data
export async function forceDataRefresh() {
  console.log("Forcing complete data refresh");
  
  // First, invalidate all queries
  await queryClient.invalidateQueries();
  
  // Then, directly fetch fresh timeslots and bookings with cache busters
  try {
    const timeslotsRes = await fetch(addCacheBuster('/api/timeslots'));
    if (timeslotsRes.ok) {
      const freshTimeslots = await timeslotsRes.json();
      queryClient.setQueryData(['/api/timeslots'], freshTimeslots);
    }
    
    const bookingsRes = await fetch(addCacheBuster('/api/bookings'));
    if (bookingsRes.ok) {
      const freshBookings = await bookingsRes.json();
      queryClient.setQueryData(['/api/bookings'], freshBookings);
    }
    
    console.log("Data refresh completed");
  } catch (error) {
    console.error("Error during forced data refresh:", error);
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Expose the query client to window for use in event handlers
if (typeof window !== 'undefined') {
  window.reactQueryClient = queryClient;
  // Also expose our helper function
  window.forceDataRefresh = forceDataRefresh;
}
