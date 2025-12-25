import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { addToOfflineQueue, isOnline as checkOnline } from "./offlineQueue";

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
    
    // Handle session expiry (403) with a clearer message
    if (res.status === 403 || res.status === 401) {
      // Clear the invalid session token
      clearSessionToken();
      throw new Error(`session_expired: Your session has expired. Please log in again.`);
    }
    
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

export interface OfflineQueueResult {
  queued: true;
  mutationId: string;
  message: string;
}

export type OfflineAwareResult = Response | OfflineQueueResult;

export function isOfflineQueueResult(result: OfflineAwareResult): result is OfflineQueueResult {
  return 'queued' in result && result.queued === true;
}

export async function offlineAwareApiRequest(
  method: string,
  url: string,
  data?: unknown,
  options?: { mutationType?: string }
): Promise<OfflineAwareResult> {
  if (!checkOnline()) {
    const mutationType = options?.mutationType || getMutationTypeFromUrl(url, method);
    const mutation = addToOfflineQueue(mutationType, url, method, data);
    return {
      queued: true,
      mutationId: mutation.id,
      message: 'Your changes have been saved offline and will sync when you reconnect.',
    };
  }

  return apiRequest(method, url, data);
}

function getMutationTypeFromUrl(url: string, method: string): string {
  const segments = url.split('/').filter(Boolean);
  const resource = segments[1] || 'unknown';
  
  switch (method.toUpperCase()) {
    case 'POST':
      return `create_${resource.replace(/s$/, '')}`;
    case 'PUT':
    case 'PATCH':
      return `update_${resource.replace(/s$/, '')}`;
    case 'DELETE':
      return `delete_${resource.replace(/s$/, '')}`;
    default:
      return `${method.toLowerCase()}_${resource}`;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";

// Build URL from query key segments
// Supports: ["/api/jobs"] or ["/api/jobs", { archived: true }]
function buildUrlFromQueryKey(queryKey: readonly unknown[]): string {
  const segments = [...queryKey];
  const lastSegment = segments[segments.length - 1];
  
  // Check if last segment is an object (query params)
  if (lastSegment && typeof lastSegment === 'object' && !Array.isArray(lastSegment)) {
    segments.pop();
    const basePath = segments.join("/");
    const params = new URLSearchParams();
    
    for (const [key, value] of Object.entries(lastSegment as Record<string, unknown>)) {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    }
    
    const queryString = params.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  }
  
  return segments.join("/");
}

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = buildUrlFromQueryKey(queryKey);
    const res = await fetch(url, {
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
      // Retry once on 403/network errors to handle server restarts gracefully
      retry: (failureCount, error) => {
        // Don't retry if we've already tried once
        if (failureCount >= 1) return false;
        // Retry on network errors or 5xx server errors
        const errorMsg = error?.message || '';
        if (errorMsg.includes('session_expired')) return false; // Don't retry auth errors
        if (errorMsg.includes('500') || errorMsg.includes('502') || errorMsg.includes('503')) return true;
        if (errorMsg.includes('Failed to fetch') || errorMsg.includes('Network')) return true;
        return false;
      },
      retryDelay: 1000, // 1 second delay before retry
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
