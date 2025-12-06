import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Session token storage key for iOS/Safari fallback
const SESSION_TOKEN_KEY = 'tradietrack_session_token';

// Get session token from localStorage
export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

// Set session token in localStorage
export function setSessionToken(token: string): void {
  try {
    localStorage.setItem(SESSION_TOKEN_KEY, token);
  } catch {
    console.warn('Failed to save session token to localStorage');
  }
}

// Clear session token from localStorage
export function clearSessionToken(): void {
  try {
    localStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    console.warn('Failed to clear session token from localStorage');
  }
}

// Build headers with session token for iOS/Safari fallback
function buildHeaders(hasData: boolean): HeadersInit {
  const headers: HeadersInit = {};
  
  if (hasData) {
    headers['Content-Type'] = 'application/json';
  }
  
  // Add Authorization header with session token for iOS/Safari fallback
  const token = getSessionToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
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
  const res = await fetch(url, {
    method,
    headers: buildHeaders(!!data),
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      headers: buildHeaders(false),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
      // Make queries load instantly without showing loading states
      placeholderData: (previousData: any) => previousData,
      // Cache data aggressively 
      gcTime: 30 * 60 * 1000, // 30 minutes
    },
    mutations: {
      retry: false,
    },
  },
});
