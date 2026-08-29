import { apiRequest } from './auth';

interface CachedResponse {
  status: number;
  ok: boolean;
  body: string;
  headers: Record<string, string>;
}

const inflight = new Map<string, Promise<CachedResponse>>();

const profileCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function buildResponse(cached: CachedResponse): Response {
  return new Response(cached.body, {
    status: cached.status,
    headers: cached.headers,
  });
}

export async function cachedApiRequest(url: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    return apiRequest(url, options);
  }

  const key = url;
  const existing = inflight.get(key);
  if (existing) {
    const cached = await existing;
    return buildResponse(cached);
  }

  const promise = apiRequest(url, options).then(async (res) => {
    const body = await res.text();
    const cached: CachedResponse = {
      status: res.status,
      ok: res.ok,
      body,
      headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
    };
    inflight.delete(key);
    return cached;
  }).catch((err) => {
    inflight.delete(key);
    throw err;
  });

  inflight.set(key, promise);

  const cached = await promise;
  return buildResponse(cached);
}

export function getCachedProfileData<T>(key: string): T | null {
  const entry = profileCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    profileCache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCachedProfileData<T>(key: string, data: T): void {
  profileCache.set(key, { data, timestamp: Date.now() });
}

export function invalidateProfileCache(keyPrefix: string): void {
  for (const key of Array.from(profileCache.keys())) {
    if (key.startsWith(keyPrefix)) {
      profileCache.delete(key);
    }
  }
}

export function clearAllProfileCache(): void {
  profileCache.clear();
}
