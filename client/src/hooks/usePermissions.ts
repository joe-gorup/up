import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../lib/auth';
import type { PermissionFeature } from '@shared/schema';

interface PermissionState {
  can_view: boolean;
  can_modify: boolean;
  can_delete: boolean;
}

type PermissionsMap = Record<string, PermissionState>;

let cachedPermissions: PermissionsMap | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000;

export function usePermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<PermissionsMap>(cachedPermissions || {});
  const [loading, setLoading] = useState(!cachedPermissions);

  useEffect(() => {
    if (!user) return;

    if (user.role === 'Administrator') {
      setLoading(false);
      return;
    }

    if (cachedPermissions && Date.now() - cacheTimestamp < CACHE_TTL) {
      setPermissions(cachedPermissions);
      setLoading(false);
      return;
    }

    loadPermissions();
  }, [user?.id, user?.role]);

  const loadPermissions = async () => {
    try {
      const res = await apiRequest('/api/permissions/me');
      if (!res.ok) return;
      const data = await res.json();

      const map: PermissionsMap = {};
      const userRole = user?.role || '';

      for (const perm of data) {
        if (perm.role === userRole) {
          map[perm.feature] = {
            can_view: perm.can_view ?? false,
            can_modify: perm.can_modify ?? false,
            can_delete: perm.can_delete ?? false,
          };
        }
      }

      cachedPermissions = map;
      cacheTimestamp = Date.now();
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
    cachedPermissions = null;
    cacheTimestamp = 0;
    loadPermissions();
  }, [user?.id]);

  return { canView, canModify, canDelete, loading, refreshPermissions };
}

export function invalidatePermissionsCache() {
  cachedPermissions = null;
  cacheTimestamp = 0;
}
