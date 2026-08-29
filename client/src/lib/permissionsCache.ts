type PermissionsMap = Record<string, { can_view: boolean; can_modify: boolean; can_delete: boolean }>;

interface CacheEntry {
  permissions: PermissionsMap;
  timestamp: number;
}

export const permissionCache = new Map<string, CacheEntry>();
export const CACHE_TTL = 60000;

export function getCacheKey(userId: string, role: string): string {
  return `${userId}:${role}`;
}

export function invalidatePermissionsCache(userId?: string, role?: string) {
  if (userId && role) {
    permissionCache.delete(getCacheKey(userId, role));
  } else {
    permissionCache.clear();
  }
}
