import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../lib/auth';
import type { PermissionFeature } from '@shared/schema';
import { permissionCache, CACHE_TTL, getCacheKey, invalidatePermissionsCache } from '../lib/permissionsCache';

export { invalidatePermissionsCache };

type PermissionsMap = Record<string, { can_view: boolean; can_modify: boolean; can_delete: boolean }>;

export function usePermissions() {
  const { user } = useAuth();

  const getCached = (): PermissionsMap | null => {
    if (!user) return null;
    const key = getCacheKey(user.id, user.role);
    const entry = permissionCache.get(key);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
      return entry.permissions;
    }
    return null;
  };

  const [permissions, setPermissions] = useState<PermissionsMap>(() => getCached() || {});
  const [loading, setLoading] = useState(() => !getCached());

  useEffect(() => {
    if (!user) {
      setPermissions({});
      return;
    }

    if (user.role === 'Administrator') {
      setLoading(false);
      return;
    }

    const cached = getCached();
    if (cached) {
      setPermissions(cached);
      setLoading(false);
      return;
    }

    loadPermissions();
  }, [user?.id, user?.role]);

  const loadPermissions = async () => {
    if (!user) return;
    try {
      const res = await apiRequest('/api/permissions/me');
      if (!res.ok) return;
      const data = await res.json();

      const map: PermissionsMap = {};
      const userRole = user.role;

      for (const perm of data) {
        if (perm.role === userRole) {
          map[perm.feature] = {
            can_view: perm.can_view ?? false,
            can_modify: perm.can_modify ?? false,
            can_delete: perm.can_delete ?? false,
          };
        }
      }

      const key = getCacheKey(user.id, userRole);
      permissionCache.set(key, { permissions: map, timestamp: Date.now() });
      setPermissions(map);
    } catch (error) {
      console.error('Failed to load permissions:', error);
    }
    setLoading(false);
  };

  const canView = useCallback((feature: PermissionFeature): boolean => {
    if (!user) return false;
    if (user.role === 'Administrator') return true;
    return permissions[feature]?.can_view ?? false;
  }, [user, permissions]);

  const canModify = useCallback((feature: PermissionFeature): boolean => {
    if (!user) return false;
    if (user.role === 'Administrator') return true;
    return permissions[feature]?.can_modify ?? false;
  }, [user, permissions]);

  const canDelete = useCallback((feature: PermissionFeature): boolean => {
    if (!user) return false;
    if (user.role === 'Administrator') return true;
    return permissions[feature]?.can_delete ?? false;
  }, [user, permissions]);

  const refreshPermissions = useCallback(() => {
    if (!user) return;
    permissionCache.delete(getCacheKey(user.id, user.role));
    loadPermissions();
  }, [user?.id, user?.role]);

  return { canView, canModify, canDelete, loading, refreshPermissions };
}
