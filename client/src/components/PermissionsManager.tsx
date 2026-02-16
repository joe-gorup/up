import { useState, useEffect, useMemo } from 'react';
import { Shield, Lock, Search, Save, RefreshCw, Eye, Pencil, Trash2, AlertTriangle, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../lib/auth';
import { PERMISSION_FEATURES, PERMISSION_FEATURE_LABELS, CONFIGURABLE_ROLES, type PermissionFeature } from '@shared/schema';
import { invalidatePermissionsCache } from '../hooks/usePermissions';

const FEATURE_DESCRIPTIONS: Record<PermissionFeature, string> = {
  my_shift: 'The working shift page where Shift Leads and Admins search, pin, and manage employees for the day.',
  my_scoopers: 'The Job Coach view showing their assigned mentees. Only applicable to the Job Coach role.',
  my_loved_ones: 'The Guardian view showing their linked family members. Only applicable to the Guardian role.',
  employee_profiles: 'View and manage individual employee profile details, support information, and demographics.',
  goal_assessment: 'Document and record step-by-step progress on employee development goals during shifts.',
  goal_assignment: 'Assign development goal templates to individual employees.',
  goal_templates: 'Create, edit, and manage reusable goal templates with steps and mastery criteria.',
  employee_management: 'Add, edit, and manage employee records, roles, and account access.',
  user_management: 'Manage system users, invitations, and login credentials.',
  promotion_certifications: 'Track and manage Mentor and Shift Lead promotion certifications for employees.',
  roi_compliance: 'Manage ROI consent forms, legal agreements, signatures, and service provider tracking.',
  coach_notes: 'Rich text notes written by Job Coaches about their assigned scoopers.',
  coach_files: 'File uploads and attachments managed by Job Coaches for their scoopers.',
  guardian_notes: 'Notes written by Guardians about their linked family members.',
  contacts: 'Manage emergency contacts, parent/guardian info, and other contact records for employees.',
  past_assessments: 'View historical assessment session records and documented progress.',
};

const FEATURE_ROLE_NA: Partial<Record<PermissionFeature, string[]>> = {
  my_scoopers: ['Shift Lead', 'Assistant Manager', 'Guardian'],
  my_loved_ones: ['Shift Lead', 'Assistant Manager', 'Job Coach'],
};

interface PermissionEntry {
  role: string;
  feature: string;
  can_view: boolean;
  can_modify: boolean;
  can_delete: boolean;
}

type PermissionMap = Record<string, Record<string, PermissionEntry>>;

export default function PermissionsManager() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<PermissionMap>({});
  const [originalPermissions, setOriginalPermissions] = useState<PermissionMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const allRoles = ['Administrator', ...CONFIGURABLE_ROLES] as const;

  useEffect(() => {
    loadPermissions();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/api/permissions');
      const data = await res.json();

      if (Array.isArray(data) && data.length === 0) {
        const seedRes = await apiRequest('/api/permissions/seed', { method: 'POST' });
        const seedData = await seedRes.json();
        if (seedData.permissions) {
          buildPermissionMap(seedData.permissions);
        } else {
          const reloadRes = await apiRequest('/api/permissions');
          const reloadData = await reloadRes.json();
          buildPermissionMap(reloadData);
        }
      } else {
        buildPermissionMap(data);
      }
    } catch (error) {
      console.error('Failed to load permissions:', error);
      setToast({ message: 'Failed to load permissions', type: 'error' });
    }
    setLoading(false);
  };

  const buildPermissionMap = (data: any[]) => {
    const map: PermissionMap = {};

    for (const role of CONFIGURABLE_ROLES) {
      map[role] = {};
      for (const feature of PERMISSION_FEATURES) {
        map[role][feature] = { role, feature, can_view: false, can_modify: false, can_delete: false };
      }
    }

    for (const perm of data) {
      if (map[perm.role]) {
        map[perm.role][perm.feature] = {
          role: perm.role,
          feature: perm.feature,
          can_view: perm.can_view ?? false,
          can_modify: perm.can_modify ?? false,
          can_delete: perm.can_delete ?? false,
        };
      }
    }

    setPermissions(JSON.parse(JSON.stringify(map)));
    setOriginalPermissions(JSON.parse(JSON.stringify(map)));
  };

  const togglePermission = (role: string, feature: string, type: 'can_view' | 'can_modify' | 'can_delete') => {
    if (role === 'Administrator') return;

    setPermissions(prev => {
      const updated = JSON.parse(JSON.stringify(prev));
      const entry = updated[role][feature];

      if (type === 'can_view') {
        entry.can_view = !entry.can_view;
        if (!entry.can_view) {
          entry.can_modify = false;
          entry.can_delete = false;
        }
      } else if (type === 'can_modify') {
        if (!entry.can_view) return prev;
        entry.can_modify = !entry.can_modify;
      } else if (type === 'can_delete') {
        if (!entry.can_view) return prev;
        entry.can_delete = !entry.can_delete;
      }

      return updated;
    });
  };

  const hasChanges = useMemo(() => {
    return JSON.stringify(permissions) !== JSON.stringify(originalPermissions);
  }, [permissions, originalPermissions]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const permList: PermissionEntry[] = [];
      for (const role of CONFIGURABLE_ROLES) {
        for (const feature of PERMISSION_FEATURES) {
          permList.push(permissions[role][feature]);
        }
      }

      const res = await apiRequest('/api/permissions', {
        method: 'PUT',
        body: JSON.stringify({ permissions: permList }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.permissions) {
          buildPermissionMap(data.permissions);
        }
        invalidatePermissionsCache();
        setToast({ message: 'Permissions saved successfully', type: 'success' });
      } else {
        setToast({ message: 'Failed to save permissions', type: 'error' });
      }
    } catch (error) {
      setToast({ message: 'Failed to save permissions', type: 'error' });
    }
    setSaving(false);
  };

  const handleDiscard = () => {
    setPermissions(JSON.parse(JSON.stringify(originalPermissions)));
  };

  const filteredFeatures = useMemo(() => {
    if (!searchQuery.trim()) return [...PERMISSION_FEATURES];
    const q = searchQuery.toLowerCase();
    return PERMISSION_FEATURES.filter(f =>
      PERMISSION_FEATURE_LABELS[f].toLowerCase().includes(q) || f.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {toast.message}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-amber-100 rounded-xl">
            <Shield className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Permission Settings</h1>
            <p className="text-sm text-gray-500">Configure what each role can view, modify, and delete</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hasChanges && (
            <button
              onClick={handleDiscard}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Discard
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-amber-600 rounded-xl hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </button>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search features..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full sm:w-80 pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
          />
        </div>
      </div>

      {hasChanges && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>You have unsaved changes. Click <strong>Save Changes</strong> to apply.</span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 sticky left-0 bg-gray-50 z-10 min-w-[200px]">
                  Feature
                </th>
                {allRoles.map(role => (
                  <th key={role} className="px-3 py-3 text-center min-w-[140px]">
                    <div className="flex items-center justify-center gap-1.5">
                      {role === 'Administrator' && <Lock className="h-3.5 w-3.5 text-gray-400" />}
                      <span className="text-sm font-semibold text-gray-700">{role}</span>
                    </div>
                    <div className="flex justify-center gap-3 mt-1.5">
                      <span className="text-[10px] uppercase tracking-wider text-gray-400 w-8 text-center">View</span>
                      <span className="text-[10px] uppercase tracking-wider text-gray-400 w-8 text-center">Edit</span>
                      <span className="text-[10px] uppercase tracking-wider text-gray-400 w-8 text-center">Del</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredFeatures.map((feature, idx) => (
                <tr key={feature} className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-amber-50/30 transition-colors`}>
                  <td className={`px-4 py-3 text-sm font-medium text-gray-800 sticky left-0 z-10 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <div className="flex items-center gap-1.5">
                      <span>{PERMISSION_FEATURE_LABELS[feature]}</span>
                      <div className="relative group">
                        <Info className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                        <div className="absolute left-5 top-1/2 -translate-y-1/2 z-50 hidden group-hover:block w-64 px-3 py-2 text-xs text-gray-700 bg-white border border-gray-200 rounded-lg shadow-lg">
                          {FEATURE_DESCRIPTIONS[feature]}
                        </div>
                      </div>
                    </div>
                  </td>
                  {allRoles.map(role => {
                    const isAdmin = role === 'Administrator';
                    const isNA = FEATURE_ROLE_NA[feature]?.includes(role);
                    const perm = isAdmin ? null : permissions[role]?.[feature];
                    const origPerm = isAdmin ? null : originalPermissions[role]?.[feature];

                    return (
                      <td key={role} className="px-3 py-3">
                        <div className="flex justify-center gap-3">
                          {isAdmin ? (
                            <>
                              <LockedToggle />
                              <LockedToggle />
                              <LockedToggle />
                            </>
                          ) : isNA ? (
                            <span className="text-xs text-gray-400 font-medium py-1.5">N/A</span>
                          ) : (
                            <>
                              <PermToggle
                                enabled={perm?.can_view ?? false}
                                changed={perm?.can_view !== origPerm?.can_view}
                                icon={<Eye className="h-3 w-3" />}
                                color="blue"
                                onClick={() => togglePermission(role, feature, 'can_view')}
                              />
                              <PermToggle
                                enabled={perm?.can_modify ?? false}
                                changed={perm?.can_modify !== origPerm?.can_modify}
                                icon={<Pencil className="h-3 w-3" />}
                                color="amber"
                                disabled={!perm?.can_view}
                                onClick={() => togglePermission(role, feature, 'can_modify')}
                              />
                              <PermToggle
                                enabled={perm?.can_delete ?? false}
                                changed={perm?.can_delete !== origPerm?.can_delete}
                                icon={<Trash2 className="h-3 w-3" />}
                                color="red"
                                disabled={!perm?.can_view}
                                onClick={() => togglePermission(role, feature, 'can_delete')}
                              />
                            </>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <Lock className="h-3 w-3" />
          <span>Administrator permissions are locked to full access</span>
        </div>
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3" />
          <span>Edit and Delete require View to be enabled</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-gray-400">N/A</span>
          <span>Feature not applicable to that role</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Info className="h-3 w-3" />
          <span>Hover the info icon for feature descriptions</span>
        </div>
      </div>
    </div>
  );
}

function LockedToggle() {
  return (
    <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 border border-gray-200 cursor-not-allowed" title="Administrator — always enabled">
      <Lock className="h-3 w-3 text-gray-400" />
    </div>
  );
}

function PermToggle({ enabled, changed, icon, color, disabled, onClick }: {
  enabled: boolean;
  changed: boolean;
  icon: React.ReactNode;
  color: 'blue' | 'amber' | 'red';
  disabled?: boolean;
  onClick: () => void;
}) {
  const colorMap = {
    blue: { on: 'bg-blue-100 border-blue-300 text-blue-600', ring: 'ring-blue-200' },
    amber: { on: 'bg-amber-100 border-amber-300 text-amber-600', ring: 'ring-amber-200' },
    red: { on: 'bg-red-100 border-red-300 text-red-600', ring: 'ring-red-200' },
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all ${
        disabled
          ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed opacity-50'
          : enabled
            ? `${colorMap[color].on} hover:opacity-80 ${changed ? `ring-2 ${colorMap[color].ring}` : ''}`
            : `bg-white border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-500 ${changed ? 'ring-2 ring-gray-200' : ''}`
      }`}
      title={disabled ? 'Enable View first' : enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}
    >
      {icon}
    </button>
  );
}
