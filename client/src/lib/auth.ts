/**
 * Utility functions for authentication and API requests
 */

interface SessionData {
  user: any;
  token: string;
  loginTime: number;
  lastActivity: number;
}

/**
 * Get JWT token from stored session
 */
export function getAuthToken(): string | null {
  try {
    const sessionStr = localStorage.getItem('golden-scoop-session');
    if (!sessionStr) return null;
    
    const session: SessionData = JSON.parse(sessionStr);
    return session.token || null;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
}

/**
 * Create authenticated API request headers
 */
export function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

/**
 * Make an authenticated API request
 */
export async function apiRequest(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  
  // Build headers - don't set Content-Type for FormData (browser sets it with boundary)
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> || {}) };
  
  // Only set Content-Type if body is not FormData
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  
  // Always add Authorization if we have a token
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  // Handle unauthorized responses - but only clear session if we had a token
  if (response.status === 401 && getAuthToken()) {
    // Token expired or invalid - clear session and let AuthContext handle the redirect
    localStorage.removeItem('golden-scoop-session');
    // Don't reload - let the app handle the logout naturally
  }
  
  return response;
}