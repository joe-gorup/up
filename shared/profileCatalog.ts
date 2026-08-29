export const PROFILE_FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

export const DEFAULT_PROFILE_FIELDS = [
  {
    key: 'interests_motivators',
    label: 'Interests & Motivators',
    description: 'Activities, preferences, and encouragements that help this employee engage.',
    sort_order: 10,
  },
  {
    key: 'challenges',
    label: 'Challenges',
    description: 'Tasks, situations, or environments that may require additional support.',
    sort_order: 20,
  },
  {
    key: 'regulation_strategies',
    label: 'Regulation Strategies',
    description: 'Approaches that help this employee stay regulated and ready to learn.',
    sort_order: 30,
  },
  {
    key: 'accommodations',
    label: 'Accommodations',
    description: 'Tools and environmental supports that help this employee succeed.',
    sort_order: 40,
  },
  {
    key: 'allergies',
    label: 'Health Conditions',
    description: 'Health conditions, allergies, or restrictions staff should know about.',
    sort_order: 50,
  },
] as const;

export const DEFAULT_CONTACT_RELATIONSHIP_OPTIONS = [
  { key: 'parent_guardian', label: 'Parent/Guardian', sort_order: 10 },
  { key: 'parent', label: 'Parent', sort_order: 20 },
  { key: 'legal_guardian', label: 'Legal Guardian', sort_order: 30 },
  { key: 'case_manager', label: 'Case Manager', sort_order: 40 },
  { key: 'family_member', label: 'Family Member', sort_order: 50 },
  { key: 'employer', label: 'Employer', sort_order: 60 },
  { key: 'other', label: 'Other', sort_order: 70 },
] as const;

export function normalizeCatalogKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

export function isCatalogRoleMatch(appliesToRoles: unknown, role: string): boolean {
  if (!Array.isArray(appliesToRoles) || appliesToRoles.length === 0) return true;
  return appliesToRoles.includes(role);
}

export function cleanProfileFieldValues(values: unknown): Record<string, string[]> | null {
  if (!values || typeof values !== 'object' || Array.isArray(values)) return null;
  const cleaned: Record<string, string[]> = {};
  for (const [key, rawValue] of Object.entries(values as Record<string, unknown>)) {
    if (!PROFILE_FIELD_KEY_PATTERN.test(key) || !Array.isArray(rawValue)) return null;
    if (rawValue.some(item => typeof item !== 'string')) return null;
    const items = rawValue
      .filter((item): item is string => typeof item === 'string')
      .map(item => item.trim())
      .filter(Boolean);
    if (items.length > 100 || items.some(item => item.length > 500)) return null;
    cleaned[key] = items;
  }
  return cleaned;
}