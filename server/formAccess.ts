import { and, eq } from 'drizzle-orm';
import { db } from './db';
import { coach_assignments, guardian_relationships, role_permissions } from '@shared/schema';
import { isNotesWriterRole } from '@shared/notesFeed';
import type { AuthUser } from './auth';

type PermissionLevel = 'can_view' | 'can_modify' | 'can_delete';

export async function hasFormPermission(user: AuthUser, level: PermissionLevel): Promise<boolean> {
  if (user.role === 'Administrator') return true;
  const [permission] = await db.select({ allowed: role_permissions[level] })
    .from(role_permissions)
    .where(and(
      eq(role_permissions.role, user.role),
      eq(role_permissions.feature, 'form_responses'),
    ));
  return Boolean(permission?.allowed);
}

/**
 * Form ACL intentionally scopes non-admin users to the same relationships as
 * the existing employee endpoints: managers can access their shift, coaches
 * their assignments, and guardians their linked family member.
 */
export async function canAccessScooper(user: AuthUser, employeeId: string): Promise<boolean> {
  if (user.role === 'Administrator' || user.role === 'Shift Lead' || user.role === 'Assistant Manager') {
    return true;
  }
  if (user.userType === 'employee' && user.id === employeeId) {
    return true;
  }
  if (user.role === 'Job Coach') {
    const [assignment] = await db.select({ id: coach_assignments.id })
      .from(coach_assignments)
      .where(and(eq(coach_assignments.coach_id, user.id), eq(coach_assignments.scooper_id, employeeId)));
    return Boolean(assignment);
  }
  if (user.role === 'Guardian') {
    const [relationship] = await db.select({ id: guardian_relationships.id })
      .from(guardian_relationships)
      .where(and(eq(guardian_relationships.guardian_id, user.id), eq(guardian_relationships.scooper_id, employeeId)));
    return Boolean(relationship);
  }
  return false;
}

export async function canViewScooperForms(user: AuthUser, employeeId: string): Promise<boolean> {
  const [hasPermission, hasAccess] = await Promise.all([
    hasFormPermission(user, 'can_view'),
    canAccessScooper(user, employeeId),
  ]);
  return hasPermission && hasAccess;
}

export async function canModifyScooperForms(user: AuthUser, employeeId: string): Promise<boolean> {
  const [hasPermission, hasAccess] = await Promise.all([
    hasFormPermission(user, 'can_modify'),
    canAccessScooper(user, employeeId),
  ]);
  return hasPermission && hasAccess;
}

/**
 * Notes use the same profile relationship ACL as the profile itself, with a
 * smaller, explicit list of roles allowed to write. Super Scoopers can view
 * their own profile but are never writers.
 */
export async function canWriteNotes(user: AuthUser, employeeId: string): Promise<boolean> {
  if (!isNotesWriterRole(user.role)) return false;
  return canAccessScooper(user, employeeId);
}

/**
 * External invitations are a separate capability from profile editing. This
 * keeps the default Administrator-only behavior while allowing an
 * Administrator to opt another role in through Permissions Manager.
 */
export async function canInviteExternalUser(user: AuthUser): Promise<boolean> {
  if (user.role === 'Administrator') return true;
  const [permission] = await db.select({ allowed: role_permissions.can_modify })
    .from(role_permissions)
    .where(and(
      eq(role_permissions.role, user.role),
      eq(role_permissions.feature, 'external_user_invites'),
    ));
  return Boolean(permission?.allowed);
}