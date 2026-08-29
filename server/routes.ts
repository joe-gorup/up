import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { PassThrough } from "stream";
import { db } from "./db";
import { logger } from "./logger";
import { 
  employees, goal_templates, goal_template_steps,
  development_goals, goal_steps, assessment_sessions, step_progress, assessment_summaries,
  coach_assignments, guardian_relationships, account_invitations, promotion_certifications, guardian_notes, coach_checkins, coach_files, coach_notes, employee_contacts, role_permissions, employee_reviews,
  form_templates, form_sections, form_questions, form_response_sets, form_answers,
  insertCoachAssignmentSchema, insertGuardianRelationshipSchema, insertPromotionCertificationSchema, insertGuardianNoteSchema, insertCoachCheckinSchema, insertCoachNoteSchema, insertEmployeeContactSchema, insertEmployeeReviewSchema,
  insertFormTemplateSchema, insertFormSectionSchema, insertFormQuestionSchema,
  videos, goal_template_videos, goal_template_step_videos, insertVideoSchema, updateVideoSchema,
  PERMISSION_FEATURES, CONFIGURABLE_ROLES,
  calculateDateFromRelativeDuration, getAccommodationWriteError, hasAccommodationUpdate
} from "@shared/schema";
import { buildNotesFeed, plainTextFromRichContent, type NotesFeedEntry } from "@shared/notesFeed";
import crypto from "crypto";
import { eq, and, desc, sql, inArray, isNull } from "drizzle-orm";
import { ObjectStorageService, objectStorageClient } from "./objectStorage";

function parseCoachFilePath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) path = `/${path}`;
  const parts = path.split("/");
  return { bucketName: parts[1], objectName: parts.slice(2).join("/") };
}
import multer from "multer";
import csvParser from "csv-parser";
import { 
  hashPassword, comparePassword, generateToken, authenticateToken, requireRole, requirePermission,
  type AuthUser 
} from "./auth";
import { canAccessScooper, canModifyScooperForms, canViewScooperForms, canWriteNotes, hasFormPermission } from "./formAccess";
import { isMeaningfullyAnswered, isQuestionRequired, isQuestionVisible, missingRequiredQuestionPrompts, normalizeConditionalAnswers } from "@shared/formLogic";

// One-shot backfill: for any goal_steps row that has no template_step_id yet
// but whose parent development_goal references a template, look up the matching
// template step by step_order and link them. Idempotent: only updates rows
// whose template_step_id is currently NULL.
async function backfillGoalStepTemplateLinks() {
  try {
    const result: { rowCount?: number | null } = await db.execute(sql`
      UPDATE goal_steps AS gs
      SET template_step_id = sub.template_step_id
      FROM (
        SELECT gs2.id AS goal_step_id, gts.id AS template_step_id
        FROM goal_steps gs2
        JOIN development_goals dg ON dg.id = gs2.goal_id
        JOIN goal_template_steps gts
          ON gts.template_id = dg.template_id
         AND gts.step_order = gs2.step_order
        WHERE gs2.template_step_id IS NULL
          AND dg.template_id IS NOT NULL
      ) AS sub
      WHERE gs.id = sub.goal_step_id
    `);
    const updated = result.rowCount ?? 0;
    if (updated > 0) {
      logger.info({ updated }, 'Backfilled goal_steps.template_step_id from template step order');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to backfill goal_steps.template_step_id — non-fatal, continuing');
  }
}

// Auto-fill any missing role_permissions rows so new features never block existing users
async function ensureDefaultPermissions() {
  try {
    const existing = await db.select({ role: role_permissions.role, feature: role_permissions.feature }).from(role_permissions);
    const existingSet = new Set(existing.map(r => `${r.role}|${r.feature}`));

    const toInsert: Array<{ role: string; feature: string; can_view: boolean; can_modify: boolean; can_delete: boolean }> = [];

    for (const feature of PERMISSION_FEATURES) {
      for (const role of CONFIGURABLE_ROLES) {
        if (existingSet.has(`${role}|${feature}`)) continue;

        let can_view = false;
        let can_modify = false;
        let can_delete = false;

        if (role === 'Shift Lead' || role === 'Assistant Manager') {
          can_view = feature !== 'external_user_invites' && (feature !== 'form_responses' || role === 'Shift Lead');
          can_modify = ['my_shift', 'employee_profiles', 'goal_assessment', 'goal_assignment', 'promotion_certifications', 'form_responses', 'roi_compliance', 'contacts', 'past_assessments'].includes(feature);
          can_delete = false;
        } else if (role === 'Job Coach') {
          can_view = ['my_scoopers', 'employee_profiles', 'goal_assessment', 'coach_notes', 'coach_files', 'guardian_notes', 'contacts', 'past_assessments'].includes(feature);
          can_modify = ['coach_notes', 'coach_files'].includes(feature);
          can_delete = ['coach_notes', 'coach_files'].includes(feature);
        } else if (role === 'Guardian') {
          can_view = ['my_loved_ones', 'employee_profiles', 'guardian_notes', 'past_assessments'].includes(feature);
          can_modify = ['guardian_notes'].includes(feature);
          can_delete = false;
        }

        toInsert.push({ role, feature, can_view, can_modify, can_delete });
      }
    }

    if (toInsert.length > 0) {
      for (const row of toInsert) {
        await db.insert(role_permissions).values(row);
      }
      logger.info({ count: toInsert.length }, 'Auto-filled missing default permission rows');
    }
    // Form responses were introduced before Shift Leads were allowed to fill
    // them. Upgrade only the former default (view enabled, modify disabled)
    // while preserving a full opt-out that an Administrator intentionally set.
    await db.update(role_permissions).set({ can_modify: true }).where(and(
      eq(role_permissions.role, 'Shift Lead'),
      eq(role_permissions.feature, 'form_responses'),
      eq(role_permissions.can_view, true),
      eq(role_permissions.can_modify, false),
    ));
  } catch (error) {
    logger.error({ error }, 'Failed to auto-fill default permissions — non-fatal, continuing startup');
  }
}

// Helper to strip sensitive fields from employee objects before sending to clients
function stripSensitiveFields<T extends Record<string, any>>(obj: T): Omit<T, 'password'> {
  const { password, ...safe } = obj;
  return safe;
}

function stripSensitiveFieldsArray<T extends Record<string, any>>(arr: T[]): Omit<T, 'password'>[] {
  return arr.map(stripSensitiveFields);
}

// Allowlisted fields for employee create/update to prevent mass-assignment
const EMPLOYEE_ALLOWED_FIELDS = [
  'first_name', 'last_name', 'email', 'role', 'date_of_birth',
  'is_active', 'has_system_access', 'password',
  'allergies', 'emergency_contacts', 'interests_motivators', 'challenges',
  'regulation_strategies', 'accommodations', 'has_service_provider', 'service_providers',
  'profile_image_url', 'location',
  'roi_status', 'roi_signed_at', 'roi_signature', 'roi_consent_type',
  'roi_no_release_details', 'roi_guardian_name', 'roi_guardian_address',
  'roi_guardian_city_state_zip', 'roi_guardian_phone', 'roi_guardian_relationship'
];

function pickAllowedFields(body: Record<string, any>, allowedFields: string[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      result[field] = body[field];
    }
  }
  return result;
}

function noteAuthorName(employee: { name?: string | null; first_name?: string | null; last_name?: string | null } | undefined): string {
  if (!employee) return 'Unknown';
  return `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || employee.name || 'Unknown';
}

function noteDate(value: Date | string | null | undefined, fallback?: Date | string | null): string {
  const candidate = value || fallback;
  const parsed = candidate ? new Date(candidate) : new Date(0);
  return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
}

async function loadUnifiedNotes(scooperId: string, viewerId: string, viewerRole: string) {
  const [guardianRows, coachRows, checkinRows] = await Promise.all([
    db.select().from(guardian_notes).where(eq(guardian_notes.scooper_id, scooperId)),
    db.select().from(coach_notes).where(eq(coach_notes.employee_id, scooperId)),
    db.select().from(coach_checkins).where(eq(coach_checkins.employee_id, scooperId)),
  ]);

  const authorIds = Array.from(new Set([
    ...guardianRows.map(note => note.guardian_id),
    ...coachRows.map(note => note.coach_id),
    ...checkinRows.map(checkin => checkin.coach_id),
  ]));
  const authorRows = authorIds.length > 0
    ? await db.select({
        id: employees.id,
        name: employees.name,
        first_name: employees.first_name,
        last_name: employees.last_name,
        role: employees.role,
      }).from(employees).where(inArray(employees.id, authorIds))
    : [];
  const authorMap = new Map(authorRows.map(author => [author.id, author]));

  const entries: NotesFeedEntry[] = [
    ...guardianRows.map(note => {
      const author = authorMap.get(note.guardian_id);
      return {
        id: `guardian:${note.id}`,
        sourceType: 'guardian' as const,
        sourceId: note.id,
        body: note.note,
        title: null,
        authorId: note.guardian_id,
        authorName: noteAuthorName(author),
        authorRole: author?.role || 'Guardian',
        createdAt: noteDate(note.created_at, note.updated_at),
        updatedAt: note.updated_at ? noteDate(note.updated_at) : null,
      };
    }),
    ...coachRows.map(note => {
      const author = authorMap.get(note.coach_id);
      return {
        id: `coach:${note.id}`,
        sourceType: 'coach' as const,
        sourceId: note.id,
        body: plainTextFromRichContent(note.content),
        title: note.title,
        authorId: note.coach_id,
        authorName: noteAuthorName(author),
        authorRole: author?.role || 'Job Coach',
        createdAt: noteDate(note.created_at, note.updated_at),
        updatedAt: note.updated_at ? noteDate(note.updated_at) : null,
      };
    }),
    ...checkinRows
      .filter(checkin => Boolean(checkin.notes?.trim()))
      .map(checkin => {
        const author = authorMap.get(checkin.coach_id);
        return {
          id: `checkin:${checkin.id}`,
          sourceType: 'checkin' as const,
          sourceId: checkin.id,
          body: checkin.notes!.trim(),
          title: 'Coach Check-In summary',
          authorId: checkin.coach_id,
          authorName: noteAuthorName(author),
          authorRole: author?.role || 'Job Coach',
          createdAt: noteDate(checkin.created_at, checkin.checkin_date),
          updatedAt: null,
          linked: true,
        };
      }),
  ];

  return buildNotesFeed(entries).map(entry => ({
    ...entry,
    createdAt: noteDate(entry.createdAt),
    updatedAt: entry.updatedAt ? noteDate(entry.updatedAt) : null,
    canEdit: entry.sourceType !== 'checkin' && entry.authorId === viewerId,
    canDelete: viewerRole === 'Administrator' && entry.sourceType !== 'checkin',
  }));
}

export function buildCoachCheckinPayload({
  template,
  responses,
  legacyRows,
  coachMap,
}: {
  template: any | null;
  responses: any[];
  legacyRows: any[];
  coachMap: Record<string, string>;
}) {
  return {
    template,
    responses: responses.filter(Boolean),
    legacy: legacyRows.map(checkin => ({
      ...checkin,
      coach_name: coachMap[checkin.coach_id] || 'Unknown',
    })),
  };
}
export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication endpoints
  app.post("/api/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      // Validate input
      if (!email || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }
      
      // Support both full email and username (part before @)
      // If no @ symbol, try to find employee by matching the email local part
      let loginEmail = email;
      if (!email.includes('@')) {
        // Username provided - find employee where email starts with username@
        const allEmployees = await db.select().from(employees).where(
          eq(employees.has_system_access, true)
        );
        const matchedEmployee = allEmployees.find(emp => 
          emp.email && emp.email.startsWith(`${email}@`)
        );
        if (matchedEmployee) {
          loginEmail = matchedEmployee.email;
        }
      }
      
      // Check database for employee with system access
      const employee = await db.select().from(employees).where(
        and(
          eq(employees.email, loginEmail),
          eq(employees.has_system_access, true)
        )
      ).limit(1);
      
      if (employee.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const foundEmployee = employee[0];
      
      // Check if employee is active
      if (!foundEmployee.is_active) {
        return res.status(401).json({ error: 'Account is inactive' });
      }
      
      // Check if password exists
      if (!foundEmployee.password) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Compare password with hashed version
      const passwordMatch = await comparePassword(password, foundEmployee.password);
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Update last login
      await db.update(employees)
        .set({ last_login: new Date() })
        .where(eq(employees.id, foundEmployee.id));
      
      // Create user object for JWT - use name field for compatibility or combine first/last
      const displayName = foundEmployee.name || `${foundEmployee.first_name || ''} ${foundEmployee.last_name || ''}`.trim();
      
      const authUser: AuthUser = {
        id: foundEmployee.id,
        email: foundEmployee.email || '',
        name: displayName,
        first_name: foundEmployee.first_name || undefined,
        last_name: foundEmployee.last_name || undefined,
        role: foundEmployee.role,
        userType: 'employee'
      };
      
      // Generate JWT token
      const token = generateToken(authUser);
      
      res.json({
        user: {
          id: foundEmployee.id,
          email: foundEmployee.email || undefined,
          name: displayName,
          first_name: foundEmployee.first_name,
          last_name: foundEmployee.last_name,
          role: foundEmployee.role,
          is_active: foundEmployee.is_active,
          roi_status: foundEmployee.roi_status ?? false
        },
        token
      });
    } catch (error) {
      logger.error({ error, email: req.body?.email }, 'Authentication failed');
      res.status(500).json({ error: 'Internal server error' });
    }
  });


  // Onboarding/Compliance endpoints
  // Verify DOB - for Guardians, verifies against their linked Super Scooper's DOB
  app.post("/api/onboarding/verify-dob", authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthUser;
      const { date_of_birth } = req.body;

      if (!date_of_birth) {
        return res.status(400).json({ error: 'Date of birth is required' });
      }

      // Normalize the input date to YYYY-MM-DD format
      const inputDOB = new Date(date_of_birth).toISOString().split('T')[0];

      if (user.role === 'Guardian') {
        // For Guardians, look up their linked Super Scooper and verify against that DOB
        const relationships = await db.select().from(guardian_relationships)
          .where(eq(guardian_relationships.guardian_id, user.id));

        if (relationships.length === 0) {
          return res.status(400).json({ error: 'No linked family member found' });
        }

        // Get the first linked Super Scooper (primary relationship)
        const scooperId = relationships[0].scooper_id;
        const [scooper] = await db.select().from(employees)
          .where(eq(employees.id, scooperId))
          .limit(1);

        if (!scooper) {
          return res.status(400).json({ error: 'Linked family member not found' });
        }

        if (!scooper.date_of_birth) {
          return res.status(400).json({ error: 'Family member date of birth not set in system' });
        }

        // Compare DOBs
        const scooperDOB = new Date(scooper.date_of_birth).toISOString().split('T')[0];
        if (inputDOB !== scooperDOB) {
          logger.warn({ guardianId: user.id, scooperId }, 'DOB verification failed for Guardian');
          return res.status(400).json({ error: 'Date of birth does not match our records' });
        }

        logger.info({ guardianId: user.id, scooperId }, 'DOB verification successful for Guardian');
        return res.json({
          verified: true,
          message: 'Date of birth verified successfully',
          employee: {
            name: `${scooper.first_name || ''} ${scooper.last_name || ''}`.trim() || scooper.name,
            date_of_birth: scooper.date_of_birth,
            email: scooper.email || '',
            has_service_provider: scooper.has_service_provider || false,
            service_providers: scooper.service_providers || [],
          }
        });
      } else {
        // For Super Scoopers/Employees, verify against their own DOB
        const [employee] = await db.select().from(employees)
          .where(eq(employees.id, user.id))
          .limit(1);

        if (!employee) {
          return res.status(404).json({ error: 'Employee not found' });
        }

        if (!employee.date_of_birth) {
          return res.status(400).json({ error: 'Date of birth not set in system' });
        }

        // Compare DOBs
        const employeeDOB = new Date(employee.date_of_birth).toISOString().split('T')[0];
        if (inputDOB !== employeeDOB) {
          logger.warn({ employeeId: user.id }, 'DOB verification failed for Employee');
          return res.status(400).json({ error: 'Date of birth does not match our records' });
        }

        logger.info({ employeeId: user.id }, 'DOB verification successful for Employee');
        return res.json({
          verified: true,
          message: 'Date of birth verified successfully',
          employee: {
            name: `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || employee.name,
            date_of_birth: employee.date_of_birth,
            email: employee.email || '',
            has_service_provider: employee.has_service_provider || false,
            service_providers: employee.service_providers || [],
          }
        });
      }
    } catch (error) {
      logger.error({ error, userId: (req as any).user?.id }, 'DOB verification failed');
      res.status(500).json({ error: 'Verification failed' });
    }
  });

  // Sign ROI - marks the user (and their linked Super Scooper for Guardians) as having signed
  app.post("/api/onboarding/sign-roi", authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthUser;
      const now = new Date();
      const { 
        signature, 
        consent_type, 
        no_release_details,
        guardian_name,
        guardian_address,
        guardian_city_state_zip,
        guardian_phone,
        guardian_relationship,
        service_providers
      } = req.body;

      const updateData: any = { 
        roi_status: true, 
        roi_signed_at: now,
        updated_at: now,
        roi_signature: signature || null,
        roi_consent_type: consent_type || 'release_all',
        roi_no_release_details: no_release_details || null,
      };

      if (user.role === 'Guardian') {
        updateData.roi_guardian_name = guardian_name || null;
        updateData.roi_guardian_address = guardian_address || null;
        updateData.roi_guardian_city_state_zip = guardian_city_state_zip || null;
        updateData.roi_guardian_phone = guardian_phone || null;
        updateData.roi_guardian_relationship = guardian_relationship || null;
      }

      if (service_providers && Array.isArray(service_providers)) {
        const cleanProviders = service_providers.filter((p: any) => p.name && p.name.trim() !== '');
        updateData.has_service_provider = cleanProviders.length > 0;
        updateData.service_providers = cleanProviders;
      }

      // Update the current user's ROI status
      await db.update(employees)
        .set(updateData)
        .where(eq(employees.id, user.id));

      // For Guardians, also update their linked Super Scooper's ROI status
      if (user.role === 'Guardian') {
        const relationships = await db.select().from(guardian_relationships)
          .where(eq(guardian_relationships.guardian_id, user.id));

        const scooperUpdate: any = { 
          roi_status: true, 
          roi_signed_at: now,
          updated_at: now
        };
        if (service_providers && Array.isArray(service_providers)) {
          const cleanProviders = service_providers.filter((p: any) => p.name && p.name.trim() !== '');
          scooperUpdate.has_service_provider = cleanProviders.length > 0;
          scooperUpdate.service_providers = cleanProviders;
        }
        for (const rel of relationships) {
          await db.update(employees)
            .set(scooperUpdate)
            .where(eq(employees.id, rel.scooper_id));
        }

        logger.info({ 
          guardianId: user.id, 
          scooperIds: relationships.map(r => r.scooper_id) 
        }, 'ROI signed by Guardian for self and linked Super Scoopers');
      } else {
        logger.info({ employeeId: user.id }, 'ROI signed by Employee');
      }

      res.json({ success: true, message: 'ROI signed successfully', roi_status: true });
    } catch (error) {
      logger.error({ error, userId: (req as any).user?.id }, 'ROI signing failed');
      res.status(500).json({ error: 'Failed to sign ROI' });
    }
  });

  // Get current user's onboarding status
  app.get("/api/onboarding/status", authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthUser;

      const [employee] = await db.select().from(employees)
        .where(eq(employees.id, user.id))
        .limit(1);

      if (!employee) {
        return res.status(404).json({ error: 'Employee not found' });
      }

      // Determine if onboarding is required based on role
      const requiresOnboarding = (user.role === 'Super Scooper' || user.role === 'Guardian') 
        && !employee.roi_status;

      res.json({
        roi_status: employee.roi_status ?? false,
        roi_signed_at: employee.roi_signed_at,
        requires_onboarding: requiresOnboarding
      });
    } catch (error) {
      logger.error({ error, userId: (req as any).user?.id }, 'Failed to get onboarding status');
      res.status(500).json({ error: 'Failed to get onboarding status' });
    }
  });

  // NOTE: Users management has been consolidated into employees table
  // All user management is now handled through /api/employees endpoints


  // Employees endpoints
  app.get("/api/employees", authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;

      if (user.role === 'Job Coach') {
        const assignments = await db.select().from(coach_assignments).where(eq(coach_assignments.coach_id, user.id));
        const scooperIds = assignments.map(a => a.scooper_id);
        if (scooperIds.length === 0) {
          return res.json([]);
        }
        const assignedScoopers = await db.select().from(employees)
          .where(and(eq(employees.is_active, true), inArray(employees.id, scooperIds)))
          .orderBy(employees.first_name);
        logger.info({ count: assignedScoopers.length, coachId: user.id }, 'Scoped employees fetched for Job Coach');
        return res.json(stripSensitiveFieldsArray(assignedScoopers));
      }

      if (user.role === 'Guardian') {
        const relationships = await db.select().from(guardian_relationships).where(eq(guardian_relationships.guardian_id, user.id));
        const scooperIds = relationships.map(r => r.scooper_id);
        if (scooperIds.length === 0) {
          return res.json([]);
        }
        const relatedScoopers = await db.select().from(employees)
          .where(and(eq(employees.is_active, true), inArray(employees.id, scooperIds)))
          .orderBy(employees.first_name);
        logger.info({ count: relatedScoopers.length, guardianId: user.id }, 'Scoped employees fetched for Guardian');
        return res.json(stripSensitiveFieldsArray(relatedScoopers));
      }

      const allEmployees = await db
        .select()
        .from(employees)
        .where(eq(employees.is_active, true))
        .orderBy(employees.email, employees.created_at);
      
      logger.info({ count: allEmployees.length }, 'Employees fetched successfully');
      res.json(stripSensitiveFieldsArray(allEmployees));
    } catch (error) {
      logger.error({ error }, 'Failed to fetch employees');
      res.status(500).json({ error: 'Failed to fetch employees' });
    }
  });

  app.post("/api/employees", authenticateToken, requirePermission('employee_profiles', 'can_modify'), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthUser;
      if (hasAccommodationUpdate(req.body)) {
        const accommodationError = getAccommodationWriteError(
          user.role,
          req.body.role ?? 'Super Scooper',
        );
        if (accommodationError) {
          return res.status(accommodationError.status).json({ error: accommodationError.message });
        }
      }

      // Check for existing employee with same email to prevent duplicates (only if email provided)
      if (req.body.email && req.body.email.trim() !== '') {
        const existingEmployee = await db.select().from(employees).where(eq(employees.email, req.body.email)).limit(1);
        
        if (existingEmployee.length > 0) {
          return res.status(409).json({ error: 'Employee with this email already exists' });
        }
      }

      const employeeData: Record<string, any> = { ...pickAllowedFields(req.body, EMPLOYEE_ALLOWED_FIELDS) };
      
      // Handle empty email for Super Scoopers without system access
      if (!employeeData.email || employeeData.email.trim() === '') {
        if (employeeData.role === 'Super Scooper' && !employeeData.has_system_access) {
          // Set email to null in database for Super Scoopers who don't need login credentials
          employeeData.email = null;
        } else {
          // For management roles, email is required
          return res.status(400).json({ error: 'Email/username is required for management roles' });
        }
      }
      
      // Generate name field from first_name and last_name (legacy field requirement)
      if (employeeData.first_name && employeeData.last_name) {
        employeeData.name = `${employeeData.first_name} ${employeeData.last_name}`;
      } else {
        employeeData.name = employeeData.first_name || employeeData.last_name || 'Unknown';
      }
      
      // Hash password if provided for employees with system access
      if (employeeData.password) {
        employeeData.password = await hashPassword(employeeData.password);
      }
      
      const [newEmployee] = await db.insert(employees).values(employeeData as any).returning();
      logger.info({ employeeId: newEmployee.id, name: `${newEmployee.first_name} ${newEmployee.last_name}` }, 'Employee created successfully');
      
      // Don't return the hashed password
      const { password, ...employeeWithoutPassword } = newEmployee;
      res.json(employeeWithoutPassword);
    } catch (error) {
      logger.error({ error, employeeData: req.body }, 'Failed to create employee');
      res.status(500).json({ error: 'Failed to create employee' });
    }
  });

  app.put("/api/employees/:id", authenticateToken, requirePermission('employee_profiles', 'can_modify'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = (req as any).user as AuthUser;
      if (hasAccommodationUpdate(req.body)) {
        // Reject the sensitive-field write before looking up the target so a
        // non-administrator consistently receives the authorization response.
        const actorError = getAccommodationWriteError(user.role, 'Super Scooper');
        if (actorError) {
          return res.status(actorError.status).json({ error: actorError.message });
        }

        const [currentEmployee] = await db
          .select({ role: employees.role })
          .from(employees)
          .where(eq(employees.id, id))
          .limit(1);
        if (!currentEmployee) {
          return res.status(404).json({ error: 'Employee not found' });
        }
        const accommodationError = getAccommodationWriteError(
          user.role,
          req.body.role ?? currentEmployee.role,
        );
        if (accommodationError) {
          return res.status(accommodationError.status).json({ error: accommodationError.message });
        }
      }

      const updateData: Record<string, any> = { ...pickAllowedFields(req.body, EMPLOYEE_ALLOWED_FIELDS), updated_at: new Date() };
      
      // Generate name field from first_name and last_name (legacy field requirement)
      if (updateData.first_name && updateData.last_name) {
        updateData.name = `${updateData.first_name} ${updateData.last_name}`;
      } else if (updateData.first_name || updateData.last_name) {
        updateData.name = updateData.first_name || updateData.last_name;
      }
      
      // Hash password if provided
      if (updateData.password) {
        updateData.password = await hashPassword(updateData.password);
      }
      
      const [updatedEmployee] = await db
        .update(employees)
        .set(updateData)
        .where(eq(employees.id, id))
        .returning();

      res.json(stripSensitiveFields(updatedEmployee));
    } catch (error) {
      logger.error({ error, employeeId: req.params.id }, 'Failed to update employee');
      res.status(500).json({ error: 'Failed to update employee' });
    }
  });

  // Goal templates endpoints
  app.get("/api/goal-templates", authenticateToken, async (req: Request, res: Response) => {
    try {
      // Optimized query: Fetch templates and steps in a single query using aggregation
      const templatesWithSteps = await db
        .select({
          id: goal_templates.id,
          name: goal_templates.name,
          goal_statement: goal_templates.goal_statement,
          default_mastery_criteria: goal_templates.default_mastery_criteria,
          default_target_date: goal_templates.default_target_date,
          relative_target_duration: goal_templates.relative_target_duration,
          status: goal_templates.status,
          created_at: goal_templates.created_at,
          updated_at: goal_templates.updated_at,
          steps: sql<any[]>`
            COALESCE(
              json_agg(
                json_build_object(
                  'id', ${goal_template_steps.id},
                  'step_order', ${goal_template_steps.step_order},
                  'step_description', ${goal_template_steps.step_description},
                  'is_required', ${goal_template_steps.is_required},
                  'timer_type', ${goal_template_steps.timer_type}
                )
                ORDER BY ${goal_template_steps.step_order}
              ) FILTER (WHERE ${goal_template_steps.id} IS NOT NULL),
              '[]'::json
            )
          `
        })
        .from(goal_templates)
        .leftJoin(goal_template_steps, eq(goal_templates.id, goal_template_steps.template_id))
        .where(eq(goal_templates.status, 'active'))
        .groupBy(goal_templates.id);
      
      logger.info({ count: templatesWithSteps.length }, 'Goal templates fetched efficiently');
      res.json(templatesWithSteps);
    } catch (error) {
      logger.error({ error }, 'Failed to fetch goal templates');
      res.status(500).json({ error: 'Failed to fetch goal templates' });
    }
  });

  app.post("/api/goal-templates", authenticateToken, requireRole('Administrator'), async (req: Request, res: Response) => {
    try {
      const { steps, ...templateData } = req.body;
      const [newTemplate] = await db.insert(goal_templates).values(templateData).returning();
      
      if (steps && steps.length > 0) {
        const stepInserts = steps.map((step: any, index: number) => ({
          template_id: newTemplate.id,
          step_order: index + 1,
          step_description: step.stepDescription,
          is_required: step.isRequired,
          timer_type: step.timerType || 'none'
        }));
        await db.insert(goal_template_steps).values(stepInserts);
      }
      
      res.json(newTemplate);
    } catch (error) {
      logger.error({ error, templateData: req.body }, 'Failed to create goal template');
      res.status(500).json({ error: 'Failed to create goal template' });
    }
  });

  app.put("/api/goal-templates/:id", authenticateToken, requireRole('Administrator'), async (req: Request, res: Response) => {
    try {
      const templateId = req.params.id;
      const { steps, ...templateData } = req.body;
      
      // Update the template
      const [updatedTemplate] = await db
        .update(goal_templates)
        .set(templateData)
        .where(eq(goal_templates.id, templateId))
        .returning();
      
      if (!updatedTemplate) {
        res.status(404).json({ error: 'Goal template not found' });
        return;
      }
      
      // If steps are provided, sync them while preserving existing step IDs
      // (so any per-step video links and goal_steps references survive).
      if (steps && Array.isArray(steps)) {
        const existing = await db.select().from(goal_template_steps)
          .where(eq(goal_template_steps.template_id, templateId));
        const existingById = new Map(existing.map(s => [s.id, s]));
        const incomingIds = new Set<string>();

        for (let index = 0; index < steps.length; index++) {
          const step: any = steps[index];
          const incomingId = step?.id as string | undefined;
          const stepValues = {
            step_order: index + 1,
            step_description: step.stepDescription,
            is_required: step.isRequired,
            timer_type: step.timerType || 'none',
          };
          if (incomingId && existingById.has(incomingId)) {
            await db.update(goal_template_steps)
              .set(stepValues)
              .where(eq(goal_template_steps.id, incomingId));
            incomingIds.add(incomingId);
          } else {
            const [inserted] = await db.insert(goal_template_steps).values({
              template_id: templateId,
              ...stepValues,
            }).returning();
            incomingIds.add(inserted.id);
          }
        }

        const toDelete = existing.filter(s => !incomingIds.has(s.id)).map(s => s.id);
        if (toDelete.length > 0) {
          await db.delete(goal_template_steps).where(inArray(goal_template_steps.id, toDelete));
        }
      }
      
      res.json(updatedTemplate);
    } catch (error) {
      logger.error({ error, templateId: req.params.id, templateData: req.body }, 'Failed to update goal template');
      res.status(500).json({ error: 'Failed to update goal template' });
    }
  });

  // Development goals endpoints
  app.get("/api/development-goals", authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      let scopedEmployeeIds: string[] | null = null;

      if (user.role === 'Job Coach') {
        const assignments = await db.select().from(coach_assignments).where(eq(coach_assignments.coach_id, user.id));
        scopedEmployeeIds = assignments.map(a => a.scooper_id);
        if (scopedEmployeeIds.length === 0) {
          return res.json([]);
        }
      }

      if (user.role === 'Guardian') {
        const relationships = await db.select().from(guardian_relationships).where(eq(guardian_relationships.guardian_id, user.id));
        scopedEmployeeIds = relationships.map(r => r.scooper_id);
        if (scopedEmployeeIds.length === 0) {
          return res.json([]);
        }
      }

      const query = db
        .select({
          id: development_goals.id,
          employee_id: development_goals.employee_id,
          title: development_goals.title,
          description: development_goals.description,
          start_date: development_goals.start_date,
          target_end_date: development_goals.target_end_date,
          status: development_goals.status,
          mastery_achieved: development_goals.mastery_achieved,
          mastery_date: development_goals.mastery_date,
          consecutive_all_correct: development_goals.consecutive_all_correct,
          created_at: development_goals.created_at,
          updated_at: development_goals.updated_at,
          steps: sql<any[]>`
            COALESCE(
              json_agg(
                json_build_object(
                  'id', ${goal_steps.id},
                  'template_step_id', ${goal_steps.template_step_id},
                  'step_order', ${goal_steps.step_order},
                  'step_description', ${goal_steps.step_description},
                  'is_required', ${goal_steps.is_required},
                  'timer_type', ${goal_steps.timer_type}
                )
                ORDER BY ${goal_steps.step_order}
              ) FILTER (WHERE ${goal_steps.id} IS NOT NULL),
              '[]'::json
            )
          `
        })
        .from(development_goals)
        .leftJoin(goal_steps, eq(development_goals.id, goal_steps.goal_id));

      let goalsWithSteps;
      if (scopedEmployeeIds) {
        goalsWithSteps = await query
          .where(inArray(development_goals.employee_id, scopedEmployeeIds))
          .groupBy(development_goals.id);
      } else {
        goalsWithSteps = await query.groupBy(development_goals.id);
      }
      
      // Enrich each goal with the last 5 assessment sessions and their aggregate outcomes
      let enrichedGoals: any[] = goalsWithSteps;
      if (goalsWithSteps.length > 0) {
        const goalIds = goalsWithSteps.map(g => g.id);
        const recentSessionsRows = await db.execute(sql`
          SELECT development_goal_id, assessment_session_id, session_date, outcome
          FROM (
            SELECT
              sp.development_goal_id,
              sp.assessment_session_id,
              sp.date AS session_date,
              CASE
                WHEN bool_or(sp.outcome = 'incorrect') THEN 'incorrect'
                WHEN bool_or(sp.outcome = 'verbal_prompt') THEN 'verbal_prompt'
                WHEN bool_and(sp.outcome IN ('correct','na')) AND bool_or(sp.outcome = 'correct') THEN 'all_correct'
                ELSE 'na'
              END AS outcome,
              ROW_NUMBER() OVER (
                PARTITION BY sp.development_goal_id
                ORDER BY sp.date DESC, MAX(sp.created_at) DESC
              ) AS rn
            FROM step_progress sp
            WHERE sp.development_goal_id IN (${sql.join(goalIds.map(id => sql`${id}`), sql`, `)})
              AND sp.status = 'submitted'
              AND sp.assessment_session_id IS NOT NULL
            GROUP BY sp.development_goal_id, sp.assessment_session_id, sp.date
          ) ranked
          WHERE rn <= 5
          ORDER BY development_goal_id, rn
        `);

        const sessionsByGoal: Record<string, Array<{ date: string; outcome: string }>> = {};
        for (const row of recentSessionsRows.rows as any[]) {
          if (!sessionsByGoal[row.development_goal_id]) sessionsByGoal[row.development_goal_id] = [];
          sessionsByGoal[row.development_goal_id].push({
            date: row.session_date,
            outcome: row.outcome,
          });
        }

        enrichedGoals = goalsWithSteps.map(g => ({
          ...g,
          recentSessions: sessionsByGoal[g.id] ?? [],
        }));
      }

      logger.info({ count: enrichedGoals.length }, 'Development goals fetched efficiently');
      res.json(enrichedGoals);
    } catch (error) {
      logger.error({ error }, 'Failed to fetch development goals');
      res.status(500).json({ error: 'Failed to fetch development goals' });
    }
  });

  // Shared helper: insert a development goal + its steps for one employee.
  // Used by both single-goal and bulk-goal endpoints to keep behavior in sync.
  type GoalStepInput = {
    id?: string | null;
    template_step_id?: string | null;
    templateStepId?: string | null;
    step_order?: number | null;
    stepOrder?: number | null;
    step_description?: string | null;
    stepDescription?: string | null;
    is_required?: boolean | null;
    isRequired?: boolean | null;
    timer_type?: string | null;
    timerType?: string | null;
  };
  type DevelopmentGoalInsert = typeof development_goals.$inferInsert;
  type DevelopmentGoalRow = typeof development_goals.$inferSelect;

  type DbExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

  async function insertGoalWithSteps(
    executor: DbExecutor,
    goalData: DevelopmentGoalInsert,
    steps: GoalStepInput[],
  ): Promise<DevelopmentGoalRow> {
    const [newGoal] = await executor.insert(development_goals).values(goalData).returning();
    if (steps.length > 0) {
      const stepInserts = steps.map((step) => ({
        goal_id: newGoal.id,
        // Track which template step this goal_step came from so per-step
        // videos can be rendered alongside the assigned employee's goal.
        template_step_id:
          (step.template_step_id ?? step.templateStepId ?? step.id) ?? null,
        step_order: (step.step_order ?? step.stepOrder) as number,
        step_description: (step.step_description ?? step.stepDescription) as string,
        is_required: step.is_required ?? step.isRequired ?? true,
        timer_type: step.timer_type ?? step.timerType ?? 'none',
      }));
      await executor.insert(goal_steps).values(stepInserts);
    }
    return newGoal;
  }

  app.post("/api/development-goals", authenticateToken, requirePermission('goal_assignment', 'can_modify'), async (req: Request, res: Response) => {
    try {
      const { steps, ...goalData } = req.body as { steps?: GoalStepInput[] } & DevelopmentGoalInsert;
      const newGoal = await insertGoalWithSteps(db, goalData, steps ?? []);
      res.json(newGoal);
    } catch (error) {
      logger.error({ error, goalData: req.body }, 'Failed to create development goal');
      res.status(500).json({ error: 'Failed to create development goal' });
    }
  });

  app.post("/api/development-goals/bulk", authenticateToken, requirePermission('goal_assignment', 'can_modify'), async (req: Request, res: Response) => {
    try {
      const { template_id, employee_ids, skip_existing } = req.body as {
        template_id?: string;
        employee_ids?: string[];
        skip_existing?: boolean;
      };

      if (!template_id || !Array.isArray(employee_ids) || employee_ids.length === 0) {
        return res.status(400).json({ error: 'template_id and employee_ids are required' });
      }

      // Deduplicate employee_ids while preserving order; reject empty/non-string entries
      const seen = new Set<string>();
      const uniqueEmployeeIds: string[] = [];
      for (const id of employee_ids) {
        if (typeof id !== 'string' || id.trim() === '') {
          return res.status(400).json({ error: 'employee_ids must contain non-empty strings' });
        }
        if (!seen.has(id)) {
          seen.add(id);
          uniqueEmployeeIds.push(id);
        }
      }

      const [template] = await db.select().from(goal_templates).where(eq(goal_templates.id, template_id)).limit(1);
      if (!template) {
        return res.status(404).json({ error: 'Goal template not found' });
      }

      // Validate that all referenced employees exist before creating any goals,
      // so a malformed payload doesn't leave a partial bulk assignment behind.
      const existingEmployees = await db
        .select({ id: employees.id })
        .from(employees)
        .where(inArray(employees.id, uniqueEmployeeIds));
      const existingEmployeeIds = new Set(existingEmployees.map(e => e.id));
      const unknownEmployeeIds = uniqueEmployeeIds.filter(id => !existingEmployeeIds.has(id));
      if (unknownEmployeeIds.length > 0) {
        return res.status(400).json({
          error: 'Some employee_ids do not exist',
          unknownEmployeeIds,
        });
      }

      const templateSteps = await db.select().from(goal_template_steps)
        .where(eq(goal_template_steps.template_id, template_id));

      const targetEndDate = calculateDateFromRelativeDuration(template.relative_target_duration || '90 days');
      const startDate = new Date().toISOString().split('T')[0];

      // Run all inserts in a single transaction so a mid-loop failure rolls back
      // every goal created in this request — strict all-or-nothing semantics.
      const { created, skipped } = await db.transaction(async (tx) => {
        const createdGoals: DevelopmentGoalRow[] = [];
        const skippedIds: string[] = [];

        for (const employeeId of uniqueEmployeeIds) {
          if (skip_existing) {
            const existing = await tx.select({ id: development_goals.id }).from(development_goals)
              .where(and(
                eq(development_goals.employee_id, employeeId),
                eq(development_goals.title, template.name),
                eq(development_goals.status, 'active')
              ))
              .limit(1);
            if (existing.length > 0) {
              skippedIds.push(employeeId);
              continue;
            }
          }

          const goalData: DevelopmentGoalInsert = {
            employee_id: employeeId,
            template_id: template.id,
            title: template.name,
            description: template.goal_statement,
            start_date: startDate,
            target_end_date: targetEndDate,
            status: 'active',
            mastery_achieved: false,
            consecutive_all_correct: 0,
          };
          const newGoal = await insertGoalWithSteps(tx, goalData, templateSteps);
          createdGoals.push(newGoal);
        }

        return { created: createdGoals, skipped: skippedIds };
      });

      logger.info({ templateId: template_id, createdCount: created.length, skippedCount: skipped.length }, 'Bulk goal assignment completed');
      res.json({ created, skipped, createdCount: created.length, skippedCount: skipped.length });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Failed bulk goal assignment');
      res.status(500).json({ error: 'Failed to bulk assign goals' });
    }
  });

  app.put("/api/development-goals/:id", authenticateToken, requirePermission('goal_assignment', 'can_modify'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const [updatedGoal] = await db
        .update(development_goals)
        .set({ ...req.body, updated_at: new Date() })
        .where(eq(development_goals.id, id))
        .returning();
      res.json(updatedGoal);
    } catch (error) {
      logger.error({ error, goalId: req.params.id }, 'Failed to update development goal');
      res.status(500).json({ error: 'Failed to update development goal' });
    }
  });


  // Step progress endpoints
  app.get("/api/step-progress", authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;

      if (user.role === 'Job Coach') {
        const assignments = await db.select().from(coach_assignments).where(eq(coach_assignments.coach_id, user.id));
        const scooperIds = assignments.map(a => a.scooper_id);
        if (scooperIds.length === 0) {
          return res.json([]);
        }
        const progress = await db.select().from(step_progress)
          .where(and(eq(step_progress.status, 'submitted'), inArray(step_progress.employee_id, scooperIds)))
          .orderBy(desc(step_progress.created_at));
        return res.json(progress);
      }

      if (user.role === 'Guardian') {
        const relationships = await db.select().from(guardian_relationships).where(eq(guardian_relationships.guardian_id, user.id));
        const scooperIds = relationships.map(r => r.scooper_id);
        if (scooperIds.length === 0) {
          return res.json([]);
        }
        const progress = await db.select().from(step_progress)
          .where(and(eq(step_progress.status, 'submitted'), inArray(step_progress.employee_id, scooperIds)))
          .orderBy(desc(step_progress.created_at));
        return res.json(progress);
      }

      const progress = await db.select().from(step_progress)
        .where(eq(step_progress.status, 'submitted'))
        .orderBy(desc(step_progress.created_at));
      res.json(progress);
    } catch (error) {
      logger.error({ error }, 'Failed to fetch step progress');
      res.status(500).json({ error: 'Failed to fetch step progress' });
    }
  });

  // Get user-specific drafts
  app.get("/api/step-progress/drafts/:documenterId", authenticateToken, async (req: Request, res: Response) => {
    try {
      const { documenterId } = req.params;
      
      // Return only this user's draft progress
      const drafts = await db.select().from(step_progress)
        .where(and(
          eq(step_progress.documenter_user_id, documenterId),
          eq(step_progress.status, 'draft')
        ))
        .orderBy(desc(step_progress.created_at));
      
      res.json(drafts);
    } catch (error) {
      logger.error({ error, documenterId: req.params.documenterId }, 'Failed to fetch user drafts');
      res.status(500).json({ error: 'Failed to fetch user drafts' });
    }
  });

  // Helper function to map camelCase fields to snake_case for database
  const mapProgressDataToDb = (data: any) => {
    const mapped = { ...data };
    // Map camelCase to snake_case for database fields
    if (data.developmentGoalId !== undefined) mapped.development_goal_id = data.developmentGoalId;
    if (data.goalStepId !== undefined) mapped.goal_step_id = data.goalStepId;
    if (data.employeeId !== undefined) mapped.employee_id = data.employeeId;
    if (data.assessmentSessionId !== undefined) mapped.assessment_session_id = data.assessmentSessionId;
    if (data.documenterUserId !== undefined) mapped.documenter_user_id = data.documenterUserId;
    if (data.completionTimeSeconds !== undefined) mapped.completion_time_seconds = data.completionTimeSeconds;
    if (data.timerManuallyEntered !== undefined) mapped.timer_manually_entered = data.timerManuallyEntered;
    
    // Remove camelCase fields that shouldn't be in database
    delete mapped.developmentGoalId;
    delete mapped.goalStepId;
    delete mapped.employeeId;
    delete mapped.assessmentSessionId;
    delete mapped.documenterUserId;
    delete mapped.completionTimeSeconds;
    delete mapped.timerManuallyEntered;
    
    return mapped;
  };

  app.post("/api/step-progress", authenticateToken, requirePermission('goal_assessment', 'can_modify'), async (req: Request, res: Response) => {
    try {
      const mappedData = mapProgressDataToDb(req.body);
      const [newProgress] = await db.insert(step_progress).values(mappedData).returning();
      res.json(newProgress);
    } catch (error) {
      logger.error({ error, progressData: req.body }, 'Failed to create step progress');
      res.status(500).json({ error: 'Failed to create step progress' });
    }
  });

  // Save step progress as draft
  app.post("/api/step-progress/draft", authenticateToken, requirePermission('goal_assessment', 'can_modify'), async (req: Request, res: Response) => {
    try {
      const mappedData = mapProgressDataToDb({ ...req.body, status: 'draft' });
      const user = (req as any).user as AuthUser;
      
      // Require documenter_user_id for drafts
      if (!mappedData.documenter_user_id) {
        return res.status(400).json({ error: 'documenter_user_id is required for draft progress' });
      }

      // Check if draft already exists for this step/employee/session/documenter
      const existingDraft = await db.select().from(step_progress)
        .where(and(
          eq(step_progress.goal_step_id, mappedData.goal_step_id),
          eq(step_progress.employee_id, mappedData.employee_id),
          eq(step_progress.documenter_user_id, mappedData.documenter_user_id),
          mappedData.assessment_session_id 
            ? eq(step_progress.assessment_session_id, mappedData.assessment_session_id)
            : sql`false`, // Legacy support removed
          eq(step_progress.date, mappedData.date),
          eq(step_progress.status, 'draft')
        ))
        .limit(1);

      let result;
      if (existingDraft.length > 0) {
        // Update existing draft - include all fields that may have changed
        const updateData: any = {
          outcome: mappedData.outcome,
          notes: mappedData.notes,
          updated_at: new Date()
        };
        
        // Include timer fields if provided
        if (mappedData.completion_time_seconds !== undefined) {
          updateData.completion_time_seconds = mappedData.completion_time_seconds;
        }
        if (mappedData.timer_manually_entered !== undefined) {
          updateData.timer_manually_entered = mappedData.timer_manually_entered;
        }
        
        [result] = await db.update(step_progress)
          .set(updateData)
          .where(eq(step_progress.id, existingDraft[0].id))
          .returning();
      } else {
        // Create new draft
        [result] = await db.insert(step_progress).values(mappedData).returning();
      }

      logger.info({ stepId: result.goal_step_id, employeeId: result.employee_id, documenterId: result.documenter_user_id }, 'Step progress draft saved');
      res.json(result);
    } catch (error) {
      logger.error({ error, progressData: req.body }, 'Failed to save step progress draft');
      res.status(500).json({ error: 'Failed to save step progress draft' });
    }
  });

  // Submit step progress (convert draft to submitted or create new submitted)
  app.post("/api/step-progress/submit", authenticateToken, requirePermission('goal_assessment', 'can_modify'), async (req: Request, res: Response) => {
    try {
      const { employee_id, assessment_session_id, date, documenter_user_id } = req.body;
      const user = (req as any).user as AuthUser;
      
      logger.info({ 
        employeeId: employee_id,
        sessionId: assessment_session_id,
        documenterId: documenter_user_id,
        date
      }, 'Attempting to submit step progress');
      
      // Require documenter_user_id for submission
      if (!documenter_user_id) {
        return res.status(400).json({ error: 'documenter_user_id is required for submission' });
      }

      // Get all draft progress for this employee/session/date/documenter
      const draftProgress = await db.select().from(step_progress)
        .where(and(
          eq(step_progress.employee_id, employee_id),
          eq(step_progress.documenter_user_id, documenter_user_id),
          assessment_session_id 
            ? eq(step_progress.assessment_session_id, assessment_session_id)
            : sql`false`, // Legacy support removed
          eq(step_progress.date, date),
          eq(step_progress.status, 'draft')
        ));

      if (draftProgress.length === 0) {
        logger.warn({ 
          employeeId: employee_id,
          sessionId: assessment_session_id,
          documenterId: documenter_user_id,
          date
        }, 'No draft progress found to submit');
        return res.status(400).json({ error: 'No draft progress found to submit' });
      }

      // Convert all drafts to submitted
      const updatedProgress = [];
      for (const draft of draftProgress) {
        const [updated] = await db.update(step_progress)
          .set({
            status: 'submitted',
            updated_at: new Date()
          })
          .where(eq(step_progress.id, draft.id))
          .returning();
        updatedProgress.push(updated);
      }

      // Check if any goals should be marked as completed
      const goalIds = Array.from(new Set(draftProgress.map(p => p.development_goal_id).filter(Boolean)));
      
      for (const goalId of goalIds) {
        if (goalId) {
          // Get all steps for this goal
          const goalSteps = await db.select().from(goal_steps)
            .where(eq(goal_steps.goal_id, goalId));

          // Get only TODAY's submitted progress for this goal/employee
          const submittedProgress = await db.select().from(step_progress)
            .where(and(
              eq(step_progress.development_goal_id, goalId),
              eq(step_progress.employee_id, employee_id),
              eq(step_progress.date, date),
              eq(step_progress.status, 'submitted')
            ));

          // Check outcomes for required steps in today's session
          const requiredSteps = goalSteps.filter(step => step.is_required);

          // Build a map of goal_step_id → outcome for today's submitted records
          const requiredStepOutcomes = new Map<string | null, string>();
          for (const p of submittedProgress) {
            if (requiredSteps.some(s => s.id === p.goal_step_id)) {
              requiredStepOutcomes.set(p.goal_step_id, p.outcome);
            }
          }

          // Increment: all required steps documented AND all are 'correct'
          const allRequiredCorrectToday = requiredSteps.length > 0 &&
            requiredSteps.every(s => requiredStepOutcomes.get(s.id) === 'correct');

          // Reset: at least one required step explicitly marked incorrect or verbal_prompt
          const anyRequiredFailed = requiredSteps.some(s => {
            const outcome = requiredStepOutcomes.get(s.id);
            return outcome === 'incorrect' || outcome === 'verbal_prompt';
          });

          const [goal] = await db.select().from(development_goals)
            .where(eq(development_goals.id, goalId))
            .limit(1);

          if (goal) {
            let newConsecutive: number;
            if (allRequiredCorrectToday) {
              newConsecutive = (goal.consecutive_all_correct || 0) + 1;
            } else if (anyRequiredFailed) {
              newConsecutive = 0;
            } else {
              // Steps were skipped/na or not all documented — leave counter unchanged
              newConsecutive = goal.consecutive_all_correct || 0;
            }

            const masteryAchieved = newConsecutive >= 3;

            await db.update(development_goals)
              .set({
                consecutive_all_correct: newConsecutive,
                mastery_achieved: masteryAchieved,
                mastery_date: masteryAchieved && !goal.mastery_achieved
                  ? new Date().toISOString().split('T')[0]
                  : goal.mastery_date,
                status: masteryAchieved ? 'completed' : 'active',
                updated_at: new Date()
              })
              .where(eq(development_goals.id, goalId));

            logger.info({ 
              goalId,
              employeeId: employee_id,
              sessionId: assessment_session_id,
              documenterId: documenter_user_id,
              allRequiredCorrectToday,
              anyRequiredFailed,
              consecutive: newConsecutive,
              masteryAchieved,
              requiredStepsCount: requiredSteps.length,
              documentedRequiredCount: requiredStepOutcomes.size
            }, masteryAchieved ? 'MASTERY ACHIEVED - Goal completed!' : 'Goal progress updated after submission');
          }
        }
      }

      logger.info({ 
        employeeId: employee_id,
        sessionId: assessment_session_id,
        documenterId: documenter_user_id,
        date,
        stepsSubmittedCount: updatedProgress.length,
        goalsAffected: goalIds.length,
        goalIds: goalIds
      }, 'Step progress submitted successfully');
      
      res.json({ 
        message: 'Progress submitted successfully', 
        submittedItems: updatedProgress.length,
        updatedProgress 
      });
    } catch (error) {
      logger.error({ 
        error, 
        employeeId: req.body.employee_id,
        sessionId: req.body.assessment_session_id,
        documenterId: req.body.documenter_user_id,
        stepsCount: req.body.steps?.length || 0
      }, 'Failed to submit step progress');
      res.status(500).json({ error: 'Failed to submit step progress' });
    }
  });

  // Assessment sessions endpoints - NEW GOAL DOCUMENTATION SYSTEM
  app.get("/api/assessment-sessions", authenticateToken, async (req: Request, res: Response) => {
    try {
      const sessions = await db.select().from(assessment_sessions).orderBy(desc(assessment_sessions.created_at));
      res.json(sessions);
    } catch (error) {
      logger.error({ error }, 'Failed to fetch assessment sessions');
      res.status(500).json({ error: 'Failed to fetch assessment sessions' });
    }
  });

  app.get("/api/employees/:employeeId/assessment-history", authenticateToken, async (req: Request, res: Response) => {
    try {
      const { employeeId } = req.params;
      const sessions = await db.select({
        id: assessment_sessions.id,
        manager_id: assessment_sessions.manager_id,
        date: assessment_sessions.date,
        location: assessment_sessions.location,
        status: assessment_sessions.status,
        created_at: assessment_sessions.created_at,
        updated_at: assessment_sessions.updated_at,
        managerFirstName: employees.first_name,
        managerLastName: employees.last_name,
      })
        .from(assessment_sessions)
        .leftJoin(employees, eq(assessment_sessions.manager_id, employees.id))
        .where(sql`${assessment_sessions.employee_ids}::jsonb @> ${JSON.stringify([employeeId])}::jsonb AND ${assessment_sessions.status} = 'completed'`)
        .orderBy(desc(assessment_sessions.date), desc(assessment_sessions.created_at))
        .limit(20);
      res.json(sessions);
    } catch (error) {
      logger.error({ error, employeeId: req.params.employeeId }, 'Failed to fetch assessment history');
      res.status(500).json({ error: 'Failed to fetch assessment history' });
    }
  });

  app.get("/api/employees/:employeeId/assessment-history-details", authenticateToken, async (req: Request, res: Response) => {
    try {
      const { employeeId } = req.params;

      const sessions = await db.select({
        id: assessment_sessions.id,
        manager_id: assessment_sessions.manager_id,
        date: assessment_sessions.date,
        location: assessment_sessions.location,
        status: assessment_sessions.status,
        created_at: assessment_sessions.created_at,
        updated_at: assessment_sessions.updated_at,
        managerFirstName: employees.first_name,
        managerLastName: employees.last_name,
      })
        .from(assessment_sessions)
        .leftJoin(employees, eq(assessment_sessions.manager_id, employees.id))
        .where(sql`${assessment_sessions.employee_ids}::jsonb @> ${JSON.stringify([employeeId])}::jsonb AND ${assessment_sessions.status} = 'completed'`)
        .orderBy(desc(assessment_sessions.date), desc(assessment_sessions.created_at))
        .limit(20);

      if (sessions.length === 0) {
        return res.json([]);
      }

      const sessionIds = sessions.map(s => s.id);

      const [allProgress, allSummaries] = await Promise.all([
        db.select({
          assessmentSessionId: step_progress.assessment_session_id,
          developmentGoalId: step_progress.development_goal_id,
          goalStepId: step_progress.goal_step_id,
          outcome: step_progress.outcome,
          notes: step_progress.notes,
          completionTimeSeconds: step_progress.completion_time_seconds,
          timerManuallyEntered: step_progress.timer_manually_entered,
          date: step_progress.date,
          goalTitle: development_goals.title,
          stepOrder: goal_steps.step_order,
          stepDescription: goal_steps.step_description,
        })
          .from(step_progress)
          .leftJoin(development_goals, eq(step_progress.development_goal_id, development_goals.id))
          .leftJoin(goal_steps, eq(step_progress.goal_step_id, goal_steps.id))
          .where(
            and(
              inArray(step_progress.assessment_session_id, sessionIds),
              eq(step_progress.employee_id, employeeId),
              eq(step_progress.status, 'submitted')
            )
          )
          .orderBy(development_goals.title, goal_steps.step_order),
        db.select()
          .from(assessment_summaries)
          .where(
            and(
              inArray(assessment_summaries.assessment_session_id, sessionIds),
              eq(assessment_summaries.employee_id, employeeId)
            )
          )
      ]);

      const progressBySession: Record<string, typeof allProgress> = {};
      for (const row of allProgress) {
        const sid = row.assessmentSessionId || '';
        if (!progressBySession[sid]) progressBySession[sid] = [];
        progressBySession[sid].push(row);
      }

      const summaryBySession: Record<string, string | null> = {};
      for (const row of allSummaries) {
        if (row.assessment_session_id) {
          summaryBySession[row.assessment_session_id] = row.summary;
        }
      }

      const result = sessions.map(session => {
        const progressRows = progressBySession[session.id] || [];
        const goalMap: Record<string, { goalId: string; goalTitle: string; steps: any[] }> = {};
        for (const row of progressRows) {
          const gid = row.developmentGoalId || '';
          if (!goalMap[gid]) {
            goalMap[gid] = { goalId: gid, goalTitle: row.goalTitle || 'Unknown Goal', steps: [] };
          }
          goalMap[gid].steps.push({
            stepId: row.goalStepId,
            stepOrder: row.stepOrder,
            stepDescription: row.stepDescription,
            outcome: row.outcome,
            notes: row.notes,
            completionTimeSeconds: row.completionTimeSeconds,
            timerManuallyEntered: row.timerManuallyEntered,
          });
        }

        return {
          ...session,
          details: {
            goals: Object.values(goalMap),
            summary: summaryBySession[session.id] || null,
            totalSteps: progressRows.length,
          }
        };
      });

      res.json(result);
    } catch (error) {
      logger.error({ error, employeeId: req.params.employeeId }, 'Failed to fetch assessment history details');
      res.status(500).json({ error: 'Failed to fetch assessment history details' });
    }
  });

  app.get("/api/assessment-sessions/:sessionId/details", authenticateToken, async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const employeeId = req.query.employeeId as string;
      if (!employeeId) {
        return res.status(400).json({ error: 'employeeId query parameter is required' });
      }

      const [progressRows, summaryRows] = await Promise.all([
        db.select({
          id: step_progress.id,
          developmentGoalId: step_progress.development_goal_id,
          goalStepId: step_progress.goal_step_id,
          outcome: step_progress.outcome,
          notes: step_progress.notes,
          completionTimeSeconds: step_progress.completion_time_seconds,
          timerManuallyEntered: step_progress.timer_manually_entered,
          date: step_progress.date,
          goalTitle: development_goals.title,
          stepOrder: goal_steps.step_order,
          stepDescription: goal_steps.step_description,
        })
          .from(step_progress)
          .leftJoin(development_goals, eq(step_progress.development_goal_id, development_goals.id))
          .leftJoin(goal_steps, eq(step_progress.goal_step_id, goal_steps.id))
          .where(
            and(
              eq(step_progress.assessment_session_id, sessionId),
              eq(step_progress.employee_id, employeeId),
              eq(step_progress.status, 'submitted')
            )
          )
          .orderBy(development_goals.title, goal_steps.step_order),
        db.select()
          .from(assessment_summaries)
          .where(
            and(
              eq(assessment_summaries.assessment_session_id, sessionId),
              eq(assessment_summaries.employee_id, employeeId)
            )
          )
          .limit(1)
      ]);

      const goalMap: Record<string, { goalId: string; goalTitle: string; steps: any[] }> = {};
      for (const row of progressRows) {
        const gid = row.developmentGoalId || '';
        if (!goalMap[gid]) {
          goalMap[gid] = { goalId: gid, goalTitle: row.goalTitle || 'Unknown Goal', steps: [] };
        }
        goalMap[gid].steps.push({
          stepId: row.goalStepId,
          stepOrder: row.stepOrder,
          stepDescription: row.stepDescription,
          outcome: row.outcome,
          notes: row.notes,
          completionTimeSeconds: row.completionTimeSeconds,
          timerManuallyEntered: row.timerManuallyEntered,
        });
      }

      res.json({
        goals: Object.values(goalMap),
        summary: summaryRows[0]?.summary || null,
        totalSteps: progressRows.length,
      });
    } catch (error) {
      logger.error({ error, sessionId: req.params.sessionId }, 'Failed to fetch session details');
      res.status(500).json({ error: 'Failed to fetch session details' });
    }
  });

  app.post("/api/assessment-sessions", authenticateToken, requirePermission('goal_assessment', 'can_modify'), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthUser;
      const { employee_ids, location, date } = req.body;

      logger.info({ 
        managerId: user.id,
        managerName: user.name,
        employeeIds: employee_ids,
        employeeCount: employee_ids?.length || 0,
        location,
        date
      }, 'Attempting to create assessment session');

      // Wrap lock check and session creation in transaction to prevent race conditions
      const newSession = await db.transaction(async (tx) => {
        // Acquire advisory locks for each employee to serialize concurrent session creation
        // This prevents race conditions even when no existing sessions exist
        if (employee_ids && employee_ids.length > 0) {
          // Sort employee IDs to prevent deadlocks when multiple managers try to lock same employees in different order
          const sortedEmployeeIds = [...employee_ids].sort();
          
          // Acquire advisory locks for all employees (using hashtext to convert UUID to integer)
          for (const employeeId of sortedEmployeeIds) {
            await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${employeeId}))`);
          }
          
          // Now check for conflicts - the locks ensure no other transaction can proceed until this one completes
          const activeSessions = await tx.select()
            .from(assessment_sessions)
            .where(
              sql`${assessment_sessions.status} IN ('draft', 'in_progress') 
                  AND ${assessment_sessions.employee_ids}::jsonb ?| array[${sql.join(employee_ids.map((id: string) => sql`${id}`), sql`, `)}]`
            );

          if (activeSessions.length > 0) {
            const ownSessions = activeSessions.filter(s => s.locked_by === user.id);
            const otherSessions = activeSessions.filter(s => s.locked_by !== user.id);

            if (ownSessions.length > 0) {
              logger.info({
                managerId: user.id,
                ownSessionIds: ownSessions.map(s => s.id),
                count: ownSessions.length
              }, 'Auto-completing own prior sessions before creating new one');

              for (const session of ownSessions) {
                await tx.update(assessment_sessions)
                  .set({
                    status: 'completed',
                    locked_by: null,
                    locked_at: null,
                    updated_at: new Date()
                  })
                  .where(eq(assessment_sessions.id, session.id));
              }
            }

            if (otherSessions.length > 0) {
              const lockedEmployees: string[] = [];
              const lockedByManagers: any[] = [];

              for (const session of otherSessions) {
                const sessionEmployeeIds = session.employee_ids as string[];
                const conflictingIds = employee_ids.filter((id: string) => sessionEmployeeIds.includes(id));
                lockedEmployees.push(...conflictingIds);
                
                if (session.locked_by && !lockedByManagers.find(m => m.id === session.locked_by)) {
                  const manager = await tx.select().from(employees).where(eq(employees.id, session.locked_by)).limit(1);
                  if (manager.length > 0) {
                    lockedByManagers.push(manager[0]);
                  }
                }
              }

              const uniqueLockedEmployees = Array.from(new Set(lockedEmployees));
              
              logger.warn({ 
                managerId: user.id,
                requestedEmployees: employee_ids,
                lockedEmployees: uniqueLockedEmployees,
                lockingManagers: lockedByManagers.map(m => ({ id: m.id, name: `${m.first_name} ${m.last_name}` })),
                conflictingSessions: otherSessions.map(s => s.id)
              }, 'Session creation blocked - employees locked by other managers');

              const error: any = new Error('Some employees are currently being assessed by another manager');
              error.statusCode = 409;
              error.lockedEmployees = uniqueLockedEmployees;
              error.lockedByManagers = lockedByManagers;
              throw error;
            }
          }
        }

        // Set lock expiry to 30 minutes from now
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 30);

        // Create session with lock
        const sessionData = {
          ...req.body,
          status: 'in_progress',
          locked_by: user.id,
          locked_at: new Date(),
          expires_at: expiresAt
        };

        const [session] = await tx.insert(assessment_sessions).values(sessionData).returning();
        return session;
      });
      
      // Only proceed with success response if session was created
      if (newSession?.id) {
        logger.info({ 
          sessionId: newSession.id,
          managerId: user.id,
          managerName: user.name,
          employeeIds: employee_ids,
          employeeCount: employee_ids?.length || 0,
          location,
          expiresAt: newSession.expires_at
        }, 'Assessment session created successfully with employee locks acquired');
        
        res.json(newSession);
      } else {
        throw new Error('Session creation failed - no session returned from transaction');
      }
    } catch (error: any) {
      // Handle lock conflict errors (thrown from transaction)
      if (error.statusCode === 409) {
        return res.status(409).json({ 
          error: error.message,
          lockedEmployees: error.lockedEmployees,
          lockedByManagers: error.lockedByManagers
        });
      }
      
      logger.error({ 
        error, 
        managerId: (req as any).user?.id,
        employeeIds: req.body.employee_ids,
        location: req.body.location 
      }, 'Failed to create assessment session');
      res.status(500).json({ error: 'Failed to create assessment session' });
    }
  });

  app.put("/api/assessment-sessions/:id", authenticateToken, requirePermission('goal_assessment', 'can_modify'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = (req as any).user as AuthUser;

      logger.info({ 
        sessionId: id, 
        userId: user.id, 
        userName: user.name,
        updateData: req.body 
      }, 'Attempting to update assessment session');

      // Get the existing session to check ownership
      const [existingSession] = await db.select().from(assessment_sessions).where(eq(assessment_sessions.id, id)).limit(1);
      
      if (!existingSession) {
        logger.warn({ sessionId: id }, 'Assessment session not found');
        return res.status(404).json({ error: 'Assessment session not found' });
      }

      logger.info({ 
        sessionId: id,
        sessionStatus: existingSession.status,
        sessionLockedBy: existingSession.locked_by,
        requestUserId: user.id,
        permissionCheck: {
          statusCompleted: existingSession.status === 'completed',
          lockedByUser: existingSession.locked_by === user.id,
          willAllow: existingSession.status === 'completed' || existingSession.locked_by === user.id
        }
      }, 'Session ownership check');

      // Only allow updates if user owns the lock or if session is completed
      if (existingSession.status !== 'completed' && existingSession.locked_by !== user.id) {
        logger.warn({ 
          sessionId: id,
          userId: user.id,
          lockedBy: existingSession.locked_by,
          status: existingSession.status
        }, 'Permission denied: user does not own lock');
        return res.status(403).json({ error: 'You do not have permission to modify this session' });
      }

      // Calculate which employees were added/removed
      // NOTE: Employee locks are implicit - an employee is considered "locked" if they appear
      // in the employee_ids array of any active session. When we remove an employee from this
      // array, they are automatically unlocked because the check-locks endpoint won't find them
      // in any active session's employee_ids. No explicit unlock operation is needed.
      const oldEmployeeIds = existingSession.employee_ids as string[] || [];
      const newEmployeeIds = req.body.employee_ids as string[] || [];
      const removedEmployeeIds = oldEmployeeIds.filter(id => !newEmployeeIds.includes(id));
      const addedEmployeeIds = newEmployeeIds.filter(id => !oldEmployeeIds.includes(id));

      const [updatedSession] = await db
        .update(assessment_sessions)
        .set({ ...req.body, updated_at: new Date() })
        .where(eq(assessment_sessions.id, id))
        .returning();
      
      logger.info({ 
        sessionId: id, 
        userId: user.id,
        updatedEmployeeIds: updatedSession.employee_ids,
        employeeCount: (updatedSession.employee_ids as string[])?.length || 0,
        removedEmployeeIds,
        removedCount: removedEmployeeIds.length,
        addedEmployeeIds,
        addedCount: addedEmployeeIds.length
      }, 'Assessment session updated - employee locks automatically released for removed employees (implicit via employee_ids array)');
      
      res.json(updatedSession);
    } catch (error) {
      logger.error({ error, sessionId: req.params.id }, 'Failed to update assessment session');
      res.status(500).json({ error: 'Failed to update assessment session' });
    }
  });

  // Complete/end an assessment session (releases lock)
  app.post("/api/assessment-sessions/:id/complete", authenticateToken, requirePermission('goal_assessment', 'can_modify'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = (req as any).user as AuthUser;

      // Get the existing session
      const [existingSession] = await db.select().from(assessment_sessions).where(eq(assessment_sessions.id, id)).limit(1);
      
      if (!existingSession) {
        return res.status(404).json({ error: 'Assessment session not found' });
      }

      // Only allow completion if user owns the lock
      if (existingSession.locked_by !== user.id) {
        return res.status(403).json({ error: 'You do not have permission to complete this session' });
      }

      const [completedSession] = await db
        .update(assessment_sessions)
        .set({ 
          status: 'completed',
          locked_by: null,
          locked_at: null,
          expires_at: null,
          updated_at: new Date() 
        })
        .where(eq(assessment_sessions.id, id))
        .returning();
      
      logger.info({ 
        sessionId: id, 
        managerId: user.id,
        managerName: user.name,
        employeeIds: existingSession.employee_ids,
        employeeCount: (existingSession.employee_ids as string[])?.length || 0,
        location: existingSession.location
      }, 'Assessment session completed - employee locks released');
      
      res.json(completedSession);
    } catch (error) {
      logger.error({ error, sessionId: req.params.id, managerId: (req as any).user?.id }, 'Failed to complete assessment session');
      res.status(500).json({ error: 'Failed to complete assessment session' });
    }
  });

  // Renew session lock (extends expiry time)
  app.post("/api/assessment-sessions/:id/renew", authenticateToken, requirePermission('goal_assessment', 'can_modify'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = (req as any).user as AuthUser;

      // Get the existing session
      const [existingSession] = await db.select().from(assessment_sessions).where(eq(assessment_sessions.id, id)).limit(1);
      
      if (!existingSession) {
        return res.status(404).json({ error: 'Assessment session not found' });
      }

      // Only allow renewal if user owns the lock
      if (existingSession.locked_by !== user.id) {
        return res.status(403).json({ error: 'You do not have permission to renew this session' });
      }

      // Extend lock expiry by 30 minutes
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 30);

      const [renewedSession] = await db
        .update(assessment_sessions)
        .set({ 
          expires_at: expiresAt,
          updated_at: new Date() 
        })
        .where(eq(assessment_sessions.id, id))
        .returning();
      
      res.json(renewedSession);
    } catch (error) {
      logger.error({ error, sessionId: req.params.id }, 'Failed to renew assessment session');
      res.status(500).json({ error: 'Failed to renew assessment session' });
    }
  });

  // Admin takeover of an active assessment session
  app.post("/api/assessment-sessions/:id/takeover", authenticateToken, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = (req as any).user as AuthUser;

      if (user.role !== 'Administrator') {
        return res.status(403).json({ error: 'Only Administrators can take over assessment sessions' });
      }

      const [existingSession] = await db.select().from(assessment_sessions)
        .where(eq(assessment_sessions.id, id)).limit(1);

      if (!existingSession) {
        return res.status(404).json({ error: 'Assessment session not found' });
      }

      if (existingSession.status === 'completed' || existingSession.status === 'abandoned') {
        return res.status(400).json({ error: 'This session is already finished' });
      }

      if (existingSession.locked_by === user.id) {
        return res.status(400).json({ error: 'You already own this session' });
      }

      const previousOwnerId = existingSession.locked_by;
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 30);

      const [updatedSession] = await db
        .update(assessment_sessions)
        .set({
          locked_by: user.id,
          locked_at: new Date(),
          expires_at: expiresAt,
          taken_over_from: previousOwnerId,
          taken_over_at: new Date(),
          updated_at: new Date()
        })
        .where(eq(assessment_sessions.id, id))
        .returning();

      let previousOwnerName = 'the previous manager';
      if (previousOwnerId) {
        const [prev] = await db.select().from(employees).where(eq(employees.id, previousOwnerId)).limit(1);
        if (prev) previousOwnerName = `${prev.first_name} ${prev.last_name}`;
      }

      logger.info({
        sessionId: id,
        adminId: user.id,
        adminName: user.name,
        previousOwnerId,
        previousOwnerName
      }, 'Assessment session taken over by administrator');

      res.json({ session: updatedSession, previousOwnerName });
    } catch (error) {
      logger.error({ error, sessionId: req.params.id }, 'Failed to take over assessment session');
      res.status(500).json({ error: 'Failed to take over session' });
    }
  });

  // Check if employees are locked in active sessions
  app.post("/api/assessment-sessions/check-locks", authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthUser;
      const { employee_ids } = req.body;

      logger.info({ 
        managerId: user.id, 
        managerName: user.name,
        employeeIds: employee_ids,
        employeeCount: employee_ids?.length || 0
      }, 'Checking employee locks');

      if (!employee_ids || employee_ids.length === 0) {
        return res.json({ locked: [], available: [] });
      }

      // First, clean up any expired sessions (status still active but past expiration)
      const now = new Date();
      const expiredSessions = await db
        .update(assessment_sessions)
        .set({ 
          status: 'abandoned',
          locked_by: null,
          locked_at: null,
          expires_at: null,
          updated_at: now
        })
        .where(
          sql`${assessment_sessions.status} IN ('draft', 'in_progress') 
              AND ${assessment_sessions.expires_at} < ${now}`
        )
        .returning();

      if (expiredSessions.length > 0) {
        logger.info({ 
          count: expiredSessions.length,
          sessionIds: expiredSessions.map(s => s.id)
        }, 'Auto-abandoned expired sessions during lock check');
      }

      // Find active sessions that include any of these employees
      const activeSessions = await db.select()
        .from(assessment_sessions)
        .where(
          sql`${assessment_sessions.status} IN ('draft', 'in_progress') 
              AND ${assessment_sessions.employee_ids}::jsonb ?| array[${sql.join(employee_ids.map((id: string) => sql`${id}`), sql`, `)}]`
        );

      const locked: any[] = [];
      const available: string[] = [];

      for (const employeeId of employee_ids) {
        const lockingSession = activeSessions.find(session => 
          (session.employee_ids as string[]).includes(employeeId)
        );

        if (lockingSession) {
          // Check if this is the current user's own lock
          if (lockingSession.locked_by === user.id) {
            // User owns this lock - employee is available to them
            available.push(employeeId);
            continue;
          }
          
          // Lock belongs to another manager
          let managerName = 'Another Manager';
          if (lockingSession.locked_by) {
            const [manager] = await db.select().from(employees).where(eq(employees.id, lockingSession.locked_by)).limit(1);
            if (manager) {
              managerName = `${manager.first_name} ${manager.last_name}`;
            } else {
              // Manager ID doesn't exist - this is a data integrity issue
              logger.warn({ 
                sessionId: lockingSession.id,
                invalidManagerId: lockingSession.locked_by,
                employeeId
              }, 'Session has invalid locked_by ID - manager not found');
              managerName = 'Another Manager (session needs cleanup)';
            }
          }

          locked.push({
            employeeId,
            sessionId: lockingSession.id,
            lockedBy: lockingSession.locked_by,
            managerName,
            lockedAt: lockingSession.locked_at,
            expiresAt: lockingSession.expires_at
          });
        } else {
          available.push(employeeId);
        }
      }

      logger.info({ 
        managerId: user.id,
        lockedCount: locked.length,
        availableCount: available.length,
        lockedEmployees: locked.map(l => ({ id: l.employeeId, lockedBy: l.managerName, sessionId: l.sessionId }))
      }, 'Lock check completed');

      res.json({ locked, available });
    } catch (error) {
      logger.error({ error, employeeIds: req.body.employee_ids }, 'Failed to check session locks');
      res.status(500).json({ error: 'Failed to check session locks' });
    }
  });

  // Get presence/lock status for a single employee — who has an active session and who is actively documenting
  app.get("/api/employees/:employeeId/lock-status", authenticateToken, async (req: Request, res: Response) => {
    try {
      const { employeeId } = req.params;
      const user = (req as any).user as AuthUser;
      const now = new Date();

      // Clean up expired sessions first
      await db.update(assessment_sessions)
        .set({ status: 'abandoned', locked_by: null, locked_at: null, expires_at: null, updated_at: now })
        .where(sql`${assessment_sessions.status} IN ('draft', 'in_progress') AND ${assessment_sessions.expires_at} < ${now}`);

      // Find active session that includes this employee
      const [lockingSession] = await db.select()
        .from(assessment_sessions)
        .where(
          sql`${assessment_sessions.status} IN ('draft', 'in_progress')
              AND ${assessment_sessions.employee_ids}::jsonb ? ${employeeId}`
        )
        .limit(1);

      if (!lockingSession || !lockingSession.locked_by) {
        return res.json({ locked: false });
      }

      // Resolve session owner name
      let ownerName = 'Another Manager';
      const [owner] = await db.select().from(employees)
        .where(eq(employees.id, lockingSession.locked_by)).limit(1);
      if (owner) ownerName = `${owner.first_name} ${owner.last_name}`;

      // Find who else has been actively documenting in this session in the last 20 minutes
      const twentyMinsAgo = new Date(now.getTime() - 20 * 60 * 1000);
      const recentProgress = await db
        .selectDistinct({ documenterId: step_progress.documenter_user_id })
        .from(step_progress)
        .where(
          and(
            eq(step_progress.assessment_session_id, lockingSession.id),
            eq(step_progress.employee_id, employeeId),
            sql`${step_progress.updated_at} >= ${twentyMinsAgo}`
          )
        );

      // Look up names for active documenters (exclude the caller)
      const presenceNames: string[] = [];
      const seenIds = new Set<string>([lockingSession.locked_by]);
      for (const row of recentProgress) {
        if (!row.documenterId || seenIds.has(row.documenterId)) continue;
        seenIds.add(row.documenterId);
        const [emp] = await db.select().from(employees).where(eq(employees.id, row.documenterId)).limit(1);
        if (emp) presenceNames.push(`${emp.first_name} ${emp.last_name}`);
      }

      const ownSession = lockingSession.locked_by === user.id;

      res.json({
        locked: !ownSession,
        ownSession,
        sessionId: lockingSession.id,
        location: lockingSession.location,
        lockedById: lockingSession.locked_by,
        ownerName,
        lockedAt: lockingSession.locked_at,
        expiresAt: lockingSession.expires_at,
        activeDocumenters: presenceNames  // Others (not the owner) who recently saved progress
      });
    } catch (error) {
      logger.error({ error, employeeId: req.params.employeeId }, 'Failed to get employee lock status');
      res.status(500).json({ error: 'Failed to get lock status' });
    }
  });

  // Assessment summaries endpoints
  app.get("/api/assessment-summaries", authenticateToken, async (req: Request, res: Response) => {
    try {
      const summaries = await db
        .select({
          id: assessment_summaries.id,
          employee_id: assessment_summaries.employee_id,
          assessment_session_id: assessment_summaries.assessment_session_id,
          date: assessment_summaries.date,
          summary: assessment_summaries.summary,
          created_at: assessment_summaries.created_at,
          updated_at: assessment_summaries.updated_at,
          manager_id: assessment_sessions.manager_id
        })
        .from(assessment_summaries)
        .leftJoin(assessment_sessions, eq(assessment_summaries.assessment_session_id, assessment_sessions.id))
        .orderBy(desc(assessment_summaries.created_at));
      res.json(summaries);
    } catch (error) {
      logger.error({ error }, 'Failed to fetch assessment summaries');
      res.status(500).json({ error: 'Failed to fetch assessment summaries' });
    }
  });

  app.post("/api/assessment-summaries", authenticateToken, requirePermission('goal_assessment', 'can_modify'), async (req: Request, res: Response) => {
    try {
      const [newSummary] = await db.insert(assessment_summaries).values(req.body).returning();
      res.json(newSummary);
    } catch (error: any) {
      // Handle duplicate summary case (unique constraint violation)
      if (error.code === '23505' && error.constraint === 'assessment_summaries_employee_session_unique') {
        // Update existing summary instead of creating duplicate
        const { employee_id, assessment_session_id, summary } = req.body;
        try {
          const [updatedSummary] = await db
            .update(assessment_summaries)
            .set({ summary, updated_at: new Date() })
            .where(and(
              eq(assessment_summaries.employee_id, employee_id),
              eq(assessment_summaries.assessment_session_id, assessment_session_id)
            ))
            .returning();
          logger.info({ employeeId: employee_id, sessionId: assessment_session_id }, 'Updated existing assessment summary');
          res.json(updatedSummary);
        } catch (updateError) {
          logger.error({ error: updateError, summaryData: req.body }, 'Failed to update existing assessment summary');
          res.status(500).json({ error: 'Failed to update assessment summary' });
        }
      } else {
        logger.error({ error, summaryData: req.body }, 'Failed to create assessment summary');
        res.status(500).json({ error: 'Failed to create assessment summary' });
      }
    }
  });


  // Create demo users endpoint (replaces Supabase Edge Function)
  app.post("/api/create-demo-users", authenticateToken, requireRole('Administrator'), async (req: Request, res: Response) => {
    try {
      // Insert demo data if not exists
      const existingEmployees = await db.select().from(employees);
      
      // Always update passwords for demo users even if they exist
      const hashedPassword = await hashPassword('password');
      
      // Update demo employees passwords if they exist
      if (existingEmployees.length > 0) {
        await db.update(employees)
          .set({ has_system_access: true, password: hashedPassword })
          .where(eq(employees.email, 'alex.johnson@goldenscoop.org'));
        
        await db.update(employees)
          .set({ has_system_access: true, password: hashedPassword })
          .where(eq(employees.email, 'emma.davis@goldenscoop.org'));
          
        await db.update(employees)
          .set({ has_system_access: true, password: hashedPassword })
          .where(eq(employees.email, 'jordan.smith@goldenscoop.org'));
          
        logger.info('Demo user passwords updated successfully');
        return res.json({ message: 'Demo user passwords updated successfully' });
      }
      
      if (existingEmployees.length === 0) {
        // Insert demo employees
        const demoEmployees = [
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            name: 'Alex Johnson',
            first_name: 'Alex',
            last_name: 'Johnson',
            email: 'alex.johnson@goldenscoopice.org',
            role: 'Super Scooper',
            profile_image_url: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=2',
            is_active: true,
            has_system_access: false,
            allergies: ['Nuts', 'Dairy'],
            emergency_contacts: [{ name: 'Sarah Johnson', relationship: 'Mother', phone: '555-0123' }],
            interests_motivators: ['Music', 'Art', 'Praise and recognition'],
            challenges: ['Loud noises', 'Sudden changes'],
            regulation_strategies: ['5-minute breaks', 'Visual schedules', 'Calm voice']
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440002',
            name: 'Emma Davis',
            first_name: 'Emma',
            last_name: 'Davis',
            email: 'emma.davis@goldenscoopice.org',
            role: 'Super Scooper',
            profile_image_url: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=2',
            is_active: true,
            has_system_access: false,
            allergies: [],
            emergency_contacts: [{ name: 'Mike Davis', relationship: 'Father', phone: '555-0456' }],
            interests_motivators: ['Animals', 'Colorful stickers', 'Team activities'],
            challenges: ['Complex instructions'],
            regulation_strategies: ['Break tasks into steps', 'Use positive reinforcement']
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440003',
            name: 'Jordan Smith',
            first_name: 'Jordan',
            last_name: 'Smith',
            email: 'jordan.smith@goldenscoopice.org',
            role: 'Super Scooper',
            profile_image_url: 'https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=2',
            is_active: true,
            has_system_access: false,
            allergies: ['Shellfish'],
            emergency_contacts: [{ name: 'Lisa Smith', relationship: 'Guardian', phone: '555-0789' }],
            interests_motivators: ['Video games', 'Technology', 'Problem solving'],
            challenges: ['Social interactions', 'Eye contact'],
            regulation_strategies: ['Written instructions', 'Quiet workspace', 'Regular check-ins']
          }
        ];

        await db.insert(employees).values(demoEmployees);

        // Insert demo users for authentication with password "password"
        const demoUsers = [
          {
            id: '770e8400-e29b-41d4-a716-446655440001',
            email: 'alex.johnson@goldenscoopice.org',
            password: 'password',
            name: 'Alex Johnson',
            role: 'Shift Lead',
            is_active: true
          },
          {
            id: '770e8400-e29b-41d4-a716-446655440002',
            email: 'emma.davis@goldenscoopice.org',
            password: 'password',
            name: 'Emma Davis',
            role: 'Shift Lead',
            is_active: true
          },
          {
            id: '770e8400-e29b-41d4-a716-446655440003',
            email: 'jordan.smith@goldenscoopice.org',
            password: 'password',
            name: 'Jordan Smith',
            role: 'Shift Lead',
            is_active: true
          }
        ];

        // NOTE: User management consolidated into employees table - no separate users table needed

        // Hash the demo password
        const hashedPassword = await hashPassword('password');

        // Update demo employees to have system access and set passwords
        await db.update(employees)
          .set({ has_system_access: true, password: hashedPassword })
          .where(eq(employees.email, 'alex.johnson@goldenscoopice.org'));
        
        await db.update(employees)
          .set({ has_system_access: true, password: hashedPassword })
          .where(eq(employees.email, 'emma.davis@goldenscoopice.org'));
          
        await db.update(employees)
          .set({ has_system_access: true, password: hashedPassword })
          .where(eq(employees.email, 'jordan.smith@goldenscoopice.org'));

        // Insert demo goal templates
        const demoTemplates = [
          {
            id: '660e8400-e29b-41d4-a716-446655440001',
            name: 'Ice Cream Flavors Knowledge',
            goal_statement: 'Employee will demonstrate comprehensive knowledge of all ice cream flavors, their ingredients, and allergen information to provide excellent customer service',
            default_mastery_criteria: '3 consecutive assessments with all required steps Correct',
            default_target_date: '2024-04-15',
            status: 'active'
          },
          {
            id: '660e8400-e29b-41d4-a716-446655440002',
            name: 'Customer Service Excellence',
            goal_statement: 'Employee will consistently provide friendly, helpful customer service including greeting customers, taking orders accurately, and handling special requests',
            default_mastery_criteria: '3 consecutive assessments with all required steps Correct',
            default_target_date: '2024-05-01',
            status: 'active'
          }
        ];

        await db.insert(goal_templates).values(demoTemplates);

        // Insert template steps
        const templateSteps = [
          // Ice Cream Flavors Knowledge steps
          { template_id: '660e8400-e29b-41d4-a716-446655440001', step_order: 1, step_description: 'Name all available ice cream flavors without prompting', is_required: true },
          { template_id: '660e8400-e29b-41d4-a716-446655440001', step_order: 2, step_description: 'Identify key ingredients in each flavor when asked', is_required: true },
          { template_id: '660e8400-e29b-41d4-a716-446655440001', step_order: 3, step_description: 'Correctly identify allergens in flavors (nuts, dairy, etc.)', is_required: true },
          { template_id: '660e8400-e29b-41d4-a716-446655440001', step_order: 4, step_description: 'Recommend flavors based on customer preferences', is_required: false },
          
          // Customer Service Excellence steps
          { template_id: '660e8400-e29b-41d4-a716-446655440002', step_order: 1, step_description: 'Greet every customer with a smile and friendly welcome', is_required: true },
          { template_id: '660e8400-e29b-41d4-a716-446655440002', step_order: 2, step_description: 'Listen actively to customer orders and repeat back for confirmation', is_required: true },
          { template_id: '660e8400-e29b-41d4-a716-446655440002', step_order: 3, step_description: 'Handle special requests and dietary restrictions appropriately', is_required: true },
          { template_id: '660e8400-e29b-41d4-a716-446655440002', step_order: 4, step_description: 'Thank customers and invite them to return', is_required: true }
        ];

        await db.insert(goal_template_steps).values(templateSteps);
      }

      logger.info('Demo data created successfully');
      res.json({ message: 'Demo data created successfully' });
    } catch (error) {
      logger.error({ error }, 'Failed to create demo data');
      res.status(500).json({ error: 'Failed to create demo data' });
    }
  });

  // Bulk upload goal templates endpoint
  const upload = multer({ storage: multer.memoryStorage() });
  
  app.post("/api/goal-templates/bulk-upload", authenticateToken, requireRole('Administrator'), upload.single('csvFile'), async (req: Request & { file?: Express.Multer.File }, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'CSV file is required' });
      }

      const results: Array<{ line: number; templateId: string; name: string; stepsCount: number }> = [];
      const errors: string[] = [];
      let lineNumber = 1; // Start at 1 for header

      // Parse CSV from buffer
      const csvContent = req.file.buffer.toString('utf8');
      const lines = csvContent.split('\n');
      
      // Check if we have a header
      if (lines.length < 2) {
        return res.status(400).json({ error: 'CSV file must contain at least a header and one data row' });
      }

      const header = lines[0].split(',').map((h: string) => h.replace(/"/g, '').trim());
      
      // Validate required columns for template-per-row format
      const requiredColumns = ['name', 'goal_statement', 'steps'];
      const missingColumns = requiredColumns.filter(col => !header.includes(col));
      if (missingColumns.length > 0) {
        return res.status(400).json({ 
          error: `Missing required columns: ${missingColumns.join(', ')}` 
        });
      }

      // Parse each row as a complete goal template
      for (let i = 1; i < lines.length; i++) {
        lineNumber = i + 1;
        const line = lines[i].trim();
        if (!line) continue; // Skip empty lines

        try {
          // Parse CSV line (basic CSV parser that handles quotes properly)
          const values: string[] = [];
          let currentValue = '';
          let inQuotes = false;
          let quoteEscaped = false;
          
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            const nextChar = line[j + 1];
            
            if (char === '"' && !quoteEscaped) {
              if (inQuotes && nextChar === '"') {
                // Double quote escape
                currentValue += '"';
                j++; // Skip next quote
                quoteEscaped = true;
              } else {
                // Toggle quote state
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              values.push(currentValue.trim());
              currentValue = '';
              quoteEscaped = false;
            } else {
              currentValue += char;
              quoteEscaped = false;
            }
          }
          values.push(currentValue.trim()); // Add the last value

          if (values.length !== header.length) {
            errors.push(`Line ${lineNumber}: Column count mismatch. Expected ${header.length}, got ${values.length}`);
            continue;
          }

          // Create row object
          const rowData: { [key: string]: string } = {};
          header.forEach((col: string, index: number) => {
            let value = values[index];
            // Remove surrounding quotes if they exist
            if (value.startsWith('"') && value.endsWith('"')) {
              value = value.slice(1, -1);
            }
            rowData[col] = value;
          });

          // Validate required fields
          if (!rowData.name || !rowData.goal_statement || !rowData.steps) {
            errors.push(`Line ${lineNumber}: Missing required fields (name, goal_statement, steps)`);
            continue;
          }

          // Parse steps JSON
          let stepsArray: any[] = [];
          try {
            stepsArray = JSON.parse(rowData.steps);
            if (!Array.isArray(stepsArray)) {
              errors.push(`Line ${lineNumber}: Steps must be a JSON array`);
              continue;
            }
          } catch (e) {
            errors.push(`Line ${lineNumber}: Invalid steps JSON format`);
            continue;
          }

          // Generate unique template ID
          const templateId = `template-${Date.now()}-${lineNumber}`;
          
          // Create template record
          const templateRecord = {
            id: templateId,
            name: rowData.name.trim(),
            goal_statement: rowData.goal_statement,
            default_mastery_criteria: rowData.default_mastery_criteria || "3 consecutive shifts with all required steps Correct",
            relative_target_duration: rowData.relative_target_duration || "90 days",
            status: rowData.status || "active"
          };

          // Insert template into database
          await db.insert(goal_templates).values(templateRecord);

          // Process and insert steps
          const stepRecords = stepsArray.map((step, index) => {
            // Strip leading numbers from step descriptions (e.g., "1. Clean up" -> "Clean up")
            let description = step.step_description;
            if (description) {
              description = description.replace(/^\d+\.\s*/, '');
            }
            
            return {
              template_id: templateId,
              step_order: step.step_order || index + 1,
              step_description: description,
              is_required: step.is_required !== false // Default to true unless explicitly false
            };
          });

          if (stepRecords.length > 0) {
            await db.insert(goal_template_steps).values(stepRecords);
          }

          results.push({
            line: lineNumber,
            templateId: templateId,
            name: rowData.name.trim(),
            stepsCount: stepRecords.length
          });

        } catch (rowError) {
          const errorMessage = rowError instanceof Error ? rowError.message : String(rowError);
          errors.push(`Line ${lineNumber}: ${errorMessage}`);
        }
      }

      logger.info({ 
        successCount: results.length, 
        errorCount: errors.length 
      }, 'Bulk goal template upload completed');

      res.json({
        message: `Bulk upload completed. ${results.length} templates created successfully.`,
        success: results,
        errors: errors,
        summary: {
          totalProcessed: lineNumber - 1,
          successful: results.length,
          failed: errors.length
        }
      });

    } catch (error) {
      logger.error({ error }, 'Failed to process bulk upload');
      res.status(500).json({ error: 'Failed to process bulk upload' });
    }
  });

  // Generate CSV template with ID mappings
  app.get("/api/bulk-upload/template/:type", authenticateToken, requireRole('Administrator'), async (req: Request, res: Response) => {
    try {
      const { type } = req.params;
      
      // Get all employees and templates for ID mapping
      const allEmployees = await db.select({
        id: employees.id,
        name: employees.name,
        first_name: employees.first_name,
        last_name: employees.last_name,
        role: employees.role
      }).from(employees).where(eq(employees.is_active, true)).orderBy(employees.name);
      
      const allTemplates = await db.select({
        id: goal_templates.id,
        name: goal_templates.name
      }).from(goal_templates).where(eq(goal_templates.status, 'active')).orderBy(goal_templates.name);

      let csvContent = '';

      if (type === 'assessments') {
        // Header row
        csvContent += 'Date,Employee ID,Manager ID,Template ID,Step 1,Step 2,Step 3\n';
        csvContent += '# Example (replace with your data):\n';
        if (allEmployees.length > 0 && allTemplates.length > 0) {
          csvContent += `3/16/25,${allEmployees[0].id},${allEmployees[0].id},${allTemplates[0].id},1,1,1\n`;
        }
        csvContent += '# Notes: 1=correct, v=verbal prompt, n/a=not applicable\n';
        csvContent += '#\n';
        csvContent += '# === EMPLOYEE ID REFERENCE ===\n';
        allEmployees.forEach(emp => {
          const displayName = emp.first_name && emp.last_name 
            ? `${emp.first_name} ${emp.last_name}` 
            : emp.name;
          csvContent += `# ${emp.id},${displayName},${emp.role}\n`;
        });
        csvContent += '#\n';
        csvContent += '# === TEMPLATE ID REFERENCE ===\n';
        allTemplates.forEach(tmpl => {
          csvContent += `# ${tmpl.id},${tmpl.name}\n`;
        });
      } else if (type === 'mastered') {
        // Header row
        csvContent += 'Employee ID,Template ID,Mastery Date (optional)\n';
        csvContent += '# Example (replace with your data):\n';
        if (allEmployees.length > 0 && allTemplates.length > 0) {
          csvContent += `${allEmployees[0].id},${allTemplates[0].id},3/15/25\n`;
        }
        csvContent += '#\n';
        csvContent += '# === EMPLOYEE ID REFERENCE ===\n';
        allEmployees.forEach(emp => {
          const displayName = emp.first_name && emp.last_name 
            ? `${emp.first_name} ${emp.last_name}` 
            : emp.name;
          csvContent += `# ${emp.id},${displayName},${emp.role}\n`;
        });
        csvContent += '#\n';
        csvContent += '# === TEMPLATE ID REFERENCE ===\n';
        allTemplates.forEach(tmpl => {
          csvContent += `# ${tmpl.id},${tmpl.name}\n`;
        });
      } else if (type === 'goal-templates') {
        csvContent += 'Template Name,Goal Statement,Duration Number,Duration Unit,Step 1,Step 2,Step 3,Step 4,Step 5\n';
        csvContent += '# Example (replace with your data):\n';
        csvContent += 'Ice Cream Scooping,Employee will demonstrate proper ice cream scooping technique,3,months,Wash hands before starting,Select correct scoop size,Scoop with proper wrist motion,Place scoop neatly in cup/cone,Clean scoop after use\n';
        csvContent += '#\n';
        csvContent += '# === FORMAT INSTRUCTIONS ===\n';
        csvContent += '# Template Name: Required - unique name for the goal template\n';
        csvContent += '# Goal Statement: Required - description of what the employee will achieve\n';
        csvContent += '# Duration Number: Required - number for the target timeframe (e.g. 3)\n';
        csvContent += '# Duration Unit: Required - days, weeks, months, or years\n';
        csvContent += '# Step columns: At least 1 step required - add more columns as needed (Step 6, Step 7, etc.)\n';
        csvContent += '# Empty step columns at the end of a row are ignored\n';
      } else {
        return res.status(400).json({ error: 'Invalid template type' });
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${type}-template.csv"`);
      res.send(csvContent);

    } catch (error) {
      logger.error({ error }, 'Failed to generate CSV template');
      res.status(500).json({ error: 'Failed to generate template' });
    }
  });

  // Bulk upload assessment history
  app.post("/api/bulk-upload/assessments", authenticateToken, requireRole('Administrator'), upload.single('file'), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthUser;
      
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      logger.info({ 
        uploadedBy: user.id,
        uploaderName: user.name,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype
      }, 'Starting bulk assessment history upload');

      const results: any[] = [];
      const errors: string[] = [];
      const rows: any[] = [];
      let lineNumber = 0;

      // Parse CSV
      const bufferStream = new PassThrough();
      bufferStream.end(req.file.buffer);

      await new Promise((resolve, reject) => {
        bufferStream
          .pipe(csvParser())
          .on('data', (data: any) => {
            lineNumber++;
            // Skip comment lines (rows where first column starts with #)
            const firstValue = Object.values(data)[0];
            if (firstValue && String(firstValue).trim().startsWith('#')) {
              return;
            }
            rows.push({ ...data, lineNumber });
          })
          .on('end', resolve)
          .on('error', reject);
      });

      // Get all employees and goal templates for matching
      const allEmployees = await db.select().from(employees);
      const allTemplates = await db.select().from(goal_templates);

      // Process each row
      for (const row of rows) {
        try {
          const date = row.Date || row.date;
          const employeeId = (row['Employee ID'] || row.employee_id || '').trim();
          const managerId = (row['Manager ID'] || row.manager_id || '').trim() || null;
          const templateId = (row['Template ID'] || row.template_id || '').trim();

          if (!date || !employeeId || !templateId) {
            errors.push(`Line ${row.lineNumber}: Missing date, employee ID, or template ID`);
            continue;
          }

          // Find employee by ID
          const employee = allEmployees.find(emp => emp.id === employeeId);

          if (!employee) {
            errors.push(`Line ${row.lineNumber}: Employee ID not found: ${employeeId}`);
            continue;
          }

          // Find template by ID
          const template = allTemplates.find(t => t.id === templateId);

          if (!template) {
            errors.push(`Line ${row.lineNumber}: Template ID not found: ${templateId}`);
            continue;
          }

          // Find manager by ID (optional)
          let manager = null;
          if (managerId) {
            manager = allEmployees.find(emp => emp.id === managerId);
            if (!manager) {
              errors.push(`Line ${row.lineNumber}: Manager ID not found: ${managerId}`);
              continue;
            }
          }

          // Parse date (MM/DD/YY or MM/DD/YYYY)
          const dateParts = date.split('/');
          let parsedDate = new Date();
          if (dateParts.length === 3) {
            const month = parseInt(dateParts[0]) - 1;
            const day = parseInt(dateParts[1]);
            let year = parseInt(dateParts[2]);
            if (year < 100) year += 2000;
            parsedDate = new Date(year, month, day);
          }

          // Find or create development goal for this employee + template
          let devGoal = await db.select().from(development_goals).where(
            and(
              eq(development_goals.employee_id, employee.id),
              eq(development_goals.title, template.name)
            )
          ).limit(1);

          if (devGoal.length === 0) {
            // Create development goal from template
            const targetDate = new Date(parsedDate);
            targetDate.setDate(targetDate.getDate() + 90);

            const [newGoal] = await db.insert(development_goals).values({
              employee_id: employee.id,
              title: template.name,
              description: template.goal_statement,
              start_date: parsedDate.toISOString().split('T')[0],
              target_end_date: targetDate.toISOString().split('T')[0],
              status: 'active'
            }).returning();

            // Copy template steps to goal steps
            const templateSteps = await db.select().from(goal_template_steps)
              .where(eq(goal_template_steps.template_id, template.id))
              .orderBy(goal_template_steps.step_order);

            if (templateSteps.length > 0) {
              const goalSteps = templateSteps.map(step => ({
                goal_id: newGoal.id,
                template_step_id: step.id,
                step_order: step.step_order,
                step_description: step.step_description,
                is_required: step.is_required,
                timer_type: step.timer_type || 'none'
              }));
              await db.insert(goal_steps).values(goalSteps);
            }

            devGoal = [newGoal];
          }

          const developmentGoal = devGoal[0];

          // Get goal steps
          const goalStepsList = await db.select().from(goal_steps)
            .where(eq(goal_steps.goal_id, developmentGoal.id))
            .orderBy(goal_steps.step_order);

          // Create assessment session (completed status bypasses locking for historical data)
          const [session] = await db.insert(assessment_sessions).values({
            manager_id: manager?.id || null,
            date: parsedDate.toISOString().split('T')[0],
            location: 'Imported from CSV',
            employee_ids: JSON.stringify([employee.id]),
            status: 'completed',
            locked_by: null,
            locked_at: null,
            expires_at: null
          }).returning();

          // Extract step outcomes from remaining columns (skip known columns)
          const stepOutcomes: any[] = [];
          const skipColumns = ['Date', 'date', 'Employee ID', 'employee_id', 'Manager ID', 'manager_id', 'Template ID', 'template_id', 'lineNumber'];
          
          // Get all step columns and sort them by step number
          const stepColumns = Object.keys(row)
            .filter(key => !skipColumns.includes(key) && key.toLowerCase().startsWith('step'))
            .sort((a, b) => {
              // Extract step number from "Step 1", "Step 2", etc.
              const numA = parseInt(a.match(/\d+/)?.[0] || '0');
              const numB = parseInt(b.match(/\d+/)?.[0] || '0');
              return numA - numB;
            });
          
          stepColumns.forEach(key => {
            const value = row[key]?.trim();
            if (value) {
              stepOutcomes.push({ value });
            }
          });

          // Process each step outcome and match to goal steps by order
          let stepSuccessCount = 0;
          for (let i = 0; i < stepOutcomes.length && i < goalStepsList.length; i++) {
            const stepOutcome = stepOutcomes[i];
            const goalStep = goalStepsList[i];

            // Parse outcome code and notes
            // Split on either " - " or just "-" for flexibility
            let parts: string[];
            if (stepOutcome.value.includes(' - ')) {
              parts = stepOutcome.value.split(' - ');
            } else if (stepOutcome.value.includes('-')) {
              parts = stepOutcome.value.split('-');
            } else {
              parts = [stepOutcome.value];
            }
            
            const outcomeCode = parts[0].toLowerCase().trim();
            const notes = parts.slice(1).join('-').trim() || null;

            let outcome = 'n/a';
            if (outcomeCode === '1') outcome = 'correct';
            else if (outcomeCode === 'v' || outcomeCode === 'x') outcome = 'verbal_prompt';
            else if (outcomeCode === 'n/a' || outcomeCode === 'na') outcome = 'n/a';

            // Create step progress record
            await db.insert(step_progress).values({
              development_goal_id: developmentGoal.id,
              goal_step_id: goalStep.id,
              employee_id: employee.id,
              assessment_session_id: session.id,
              documenter_user_id: manager?.id || null,
              date: parsedDate.toISOString().split('T')[0],
              outcome: outcome,
              notes: notes,
              status: 'submitted'
            });

            stepSuccessCount++;
          }

          // Create assessment summary for this assessment
          await db.insert(assessment_summaries).values({
            employee_id: employee.id,
            assessment_session_id: session.id,
            date: parsedDate.toISOString().split('T')[0],
            summary: `Historical assessment data imported from CSV. ${stepSuccessCount} steps assessed for ${template.name}.`
          });

          results.push({
            line: row.lineNumber,
            employeeId: employeeId,
            templateId: templateId,
            date: parsedDate.toISOString().split('T')[0],
            stepsProcessed: stepSuccessCount
          });

        } catch (rowError) {
          const errorMessage = rowError instanceof Error ? rowError.message : String(rowError);
          errors.push(`Line ${row.lineNumber}: ${errorMessage}`);
        }
      }

      logger.info({ 
        uploadedBy: (req as any).user?.id,
        fileName: req.file?.originalname,
        totalRowsProcessed: rows.length,
        successCount: results.length, 
        errorCount: errors.length,
        employeesAffected: Array.from(new Set(results.map(r => r.employeeId))).length,
        templatesUsed: Array.from(new Set(results.map(r => r.templateId))).length,
        firstErrors: errors.slice(0, 5)
      }, 'Bulk assessment upload completed');

      res.json({
        message: `Upload completed. ${results.length} assessments processed successfully.`,
        details: {
          totalRows: rows.length,
          successCount: results.length,
          errorCount: errors.length,
          errors: errors.slice(0, 20)
        }
      });

    } catch (error) {
      logger.error({ 
        error,
        uploadedBy: (req as any).user?.id,
        fileName: req.file?.originalname 
      }, 'Failed to process assessment bulk upload');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.status(500).json({ 
        error: 'Failed to process bulk upload', 
        details: {
          totalRows: 0,
          successCount: 0,
          errorCount: 1,
          errors: [errorMessage]
        }
      });
    }
  });

  // Bulk upload mastered goals
  app.post("/api/bulk-upload/mastered-goals", authenticateToken, requireRole('Administrator'), upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const results: any[] = [];
      const errors: string[] = [];
      const rows: any[] = [];
      let lineNumber = 0;

      // Parse CSV
      const bufferStream = new PassThrough();
      bufferStream.end(req.file.buffer);

      await new Promise((resolve, reject) => {
        bufferStream
          .pipe(csvParser())
          .on('data', (data: any) => {
            lineNumber++;
            // Skip comment lines (rows where first column starts with #)
            const firstValue = Object.values(data)[0];
            if (firstValue && String(firstValue).trim().startsWith('#')) {
              return;
            }
            rows.push({ ...data, lineNumber });
          })
          .on('end', resolve)
          .on('error', reject);
      });

      // Get all employees and goal templates
      const allEmployees = await db.select().from(employees);
      const allTemplates = await db.select().from(goal_templates);

      for (const row of rows) {
        try {
          const employeeId = (row['Employee ID'] || row.employee_id || '').trim();
          const templateId = (row['Template ID'] || row.template_id || '').trim();
          const masteryDateStr = row['Mastery Date'] || row.mastery_date;

          if (!employeeId || !templateId) {
            errors.push(`Line ${row.lineNumber}: Missing employee ID or template ID`);
            continue;
          }

          // Find employee by ID
          const employee = allEmployees.find(emp => emp.id === employeeId);

          if (!employee) {
            errors.push(`Line ${row.lineNumber}: Employee ID not found: ${employeeId}`);
            continue;
          }

          // Find template by ID
          const template = allTemplates.find(t => t.id === templateId);

          if (!template) {
            errors.push(`Line ${row.lineNumber}: Template ID not found: ${templateId}`);
            continue;
          }

          // Parse mastery date if provided
          let masteryDate = null;
          if (masteryDateStr && masteryDateStr.trim()) {
            const dateParts = masteryDateStr.trim().split('/');
            if (dateParts.length === 3) {
              const month = parseInt(dateParts[0]) - 1;
              const day = parseInt(dateParts[1]);
              let year = parseInt(dateParts[2]);
              if (year < 100) year += 2000;
              masteryDate = new Date(year, month, day).toISOString().split('T')[0];
            }
          }

          // Check if goal already exists (by title match)
          const existingGoal = await db.select().from(development_goals).where(
            and(
              eq(development_goals.employee_id, employee.id),
              eq(development_goals.title, template.name)
            )
          ).limit(1);

          if (existingGoal.length > 0) {
            errors.push(`Line ${row.lineNumber}: Goal already exists for employee ID ${employeeId}`);
            continue;
          }

          // Calculate target end date (90 days from mastery date or today)
          const baseDate = masteryDate ? new Date(masteryDate) : new Date();
          const targetDate = new Date(baseDate);
          targetDate.setDate(targetDate.getDate() + 90);

          // Create mastered goal - copy template data
          const [newGoal] = await db.insert(development_goals).values({
            employee_id: employee.id,
            title: template.name,
            description: template.goal_statement,
            status: 'mastered',
            mastery_achieved: true,
            mastery_date: masteryDate,
            start_date: masteryDate || new Date().toISOString().split('T')[0],
            target_end_date: targetDate.toISOString().split('T')[0]
          }).returning();

          // Copy template steps to goal steps
          const templateSteps = await db.select().from(goal_template_steps)
            .where(eq(goal_template_steps.template_id, template.id))
            .orderBy(goal_template_steps.step_order);

          if (templateSteps.length > 0) {
            const goalSteps = templateSteps.map(step => ({
              goal_id: newGoal.id,
              template_step_id: step.id,
              step_order: step.step_order,
              step_description: step.step_description,
              is_required: step.is_required,
              timer_type: step.timer_type || 'none'
            }));
            await db.insert(goal_steps).values(goalSteps);
          }

          results.push({
            line: row.lineNumber,
            employeeId: employeeId,
            templateId: templateId,
            masteryDate: masteryDate
          });

        } catch (rowError) {
          const errorMessage = rowError instanceof Error ? rowError.message : String(rowError);
          errors.push(`Line ${row.lineNumber}: ${errorMessage}`);
        }
      }

      logger.info({ 
        successCount: results.length, 
        errorCount: errors.length 
      }, 'Bulk mastered goals upload completed');

      res.json({
        message: `Upload completed. ${results.length} mastered goals created successfully.`,
        details: {
          totalRows: rows.length,
          successCount: results.length,
          errorCount: errors.length,
          errors: errors.slice(0, 20)
        }
      });

    } catch (error) {
      logger.error({ error }, 'Failed to process mastered goals bulk upload');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.status(500).json({ 
        error: 'Failed to process bulk upload',
        details: {
          totalRows: 0,
          successCount: 0,
          errorCount: 1,
          errors: [errorMessage]
        }
      });
    }
  });

  // Object storage routes for employee images
  app.get("/objects/:objectPath(*)", async (req: Request, res: Response) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      logger.error({ error, path: req.path }, "Error accessing object");
      if (error instanceof Error && error.message.includes("not configured")) {
        res.status(503).json({ error: "Object storage service not configured" });
      } else {
        res.status(404).json({ error: "File not found" });
      }
    }
  });

  app.post("/api/objects/upload", authenticateToken, requireRole('Administrator', 'Shift Lead', 'Assistant Manager'), async (req: Request, res: Response) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      logger.error({ error }, "Error generating upload URL");
      if (error instanceof Error && error.message.includes("not configured")) {
        res.status(503).json({ error: "Object storage service not configured" });
      } else {
        res.status(500).json({ error: "Failed to generate upload URL" });
      }
    }
  });

  const photoUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'));
      }
    },
  });

  app.post("/api/employees/photo", authenticateToken, requirePermission('employee_profiles', 'can_modify'), photoUpload.single('photo'), async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      const objectStorageService = new ObjectStorageService();
      const privateDir = objectStorageService.getPrivateObjectDir();
      if (!privateDir) {
        return res.status(503).json({ error: 'Object storage not configured' });
      }
      const fileId = crypto.randomUUID();
      const ext = (file.originalname.split('.').pop() || 'jpg').toLowerCase();
      const objectPath = `${privateDir}/profile-photos/${fileId}.${ext}`;
      const { bucketName, objectName } = parseCoachFilePath(objectPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const blob = bucket.file(objectName);
      await blob.save(file.buffer, { contentType: file.mimetype });
      res.json({ path: `/objects/profile-photos/${fileId}.${ext}` });
    } catch (error) {
      logger.error({ error }, 'Failed to upload employee photo');
      res.status(500).json({ error: 'Failed to upload photo' });
    }
  });

  app.put("/api/employee-images", authenticateToken, requirePermission('employee_profiles', 'can_modify'), async (req: Request, res: Response) => {
    try {
      const { imageURL } = req.body;
      if (!imageURL) {
        return res.status(400).json({ error: "imageURL is required" });
      }

      const objectStorageService = new ObjectStorageService();
      const objectPath = objectStorageService.normalizeObjectEntityPath(imageURL);
      
      // For now, we just return the path without setting ACL since employees images are public
      res.json({ objectPath });
    } catch (error) {
      logger.error({ error }, "Error processing employee image");
      res.status(500).json({ error: "Failed to process image" });
    }
  });

  // Account Invitation Routes
  app.post("/api/invitations", authenticateToken, requireRole('Administrator'), async (req: Request, res: Response) => {
    try {
      const { employee_id, email } = req.body;
      const user = (req as any).user;

      if (!employee_id || !email) {
        return res.status(400).json({ error: 'employee_id and email are required' });
      }

      const [emp] = await db.select().from(employees).where(eq(employees.id, employee_id)).limit(1);
      if (!emp) {
        return res.status(404).json({ error: 'Employee not found' });
      }

      if (!['Job Coach', 'Guardian'].includes(emp.role)) {
        return res.status(400).json({ error: 'Invitations can only be sent to Job Coach or Guardian roles' });
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const [invitation] = await db.insert(account_invitations).values({
        employee_id,
        email,
        token,
        expires_at: expiresAt,
        created_by: user.id,
      }).returning();

      await db.update(employees)
        .set({ email, has_system_access: true })
        .where(eq(employees.id, employee_id));

      const setupUrl = `${req.protocol}://${req.get('host')}?setup=${token}`;

      logger.info({ employeeId: employee_id, email, invitationId: invitation.id }, 'Account invitation created');
      res.json({ invitation, setupUrl });
    } catch (error) {
      logger.error({ error }, 'Failed to create invitation');
      res.status(500).json({ error: 'Failed to create invitation' });
    }
  });

  app.get("/api/invitations/validate/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const [invitation] = await db.select().from(account_invitations)
        .where(eq(account_invitations.token, token)).limit(1);

      if (!invitation) {
        return res.status(404).json({ error: 'Invalid invitation link' });
      }
      if (invitation.used_at) {
        return res.status(400).json({ error: 'This invitation has already been used' });
      }
      if (new Date() > new Date(invitation.expires_at)) {
        return res.status(400).json({ error: 'This invitation has expired' });
      }

      const [emp] = await db.select().from(employees)
        .where(eq(employees.id, invitation.employee_id)).limit(1);

      res.json({
        valid: true,
        employee: emp ? {
          id: emp.id,
          first_name: emp.first_name,
          last_name: emp.last_name,
          role: emp.role,
          email: invitation.email,
        } : null,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to validate invitation');
      res.status(500).json({ error: 'Failed to validate invitation' });
    }
  });

  app.post("/api/invitations/complete/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const { password, username } = req.body;

      if (!password || password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      const [invitation] = await db.select().from(account_invitations)
        .where(eq(account_invitations.token, token)).limit(1);

      if (!invitation) {
        return res.status(404).json({ error: 'Invalid invitation link' });
      }
      if (invitation.used_at) {
        return res.status(400).json({ error: 'This invitation has already been used' });
      }
      if (new Date() > new Date(invitation.expires_at)) {
        return res.status(400).json({ error: 'This invitation has expired' });
      }

      const hashedPassword = await hashPassword(password);
      const emailToUse = username || invitation.email;

      await db.update(employees).set({
        password: hashedPassword,
        email: emailToUse,
        has_system_access: true,
        updated_at: new Date(),
      }).where(eq(employees.id, invitation.employee_id));

      await db.update(account_invitations).set({
        used_at: new Date(),
      }).where(eq(account_invitations.id, invitation.id));

      logger.info({ employeeId: invitation.employee_id }, 'Account setup completed via invitation');
      res.json({ success: true, message: 'Account setup complete. You can now log in.' });
    } catch (error) {
      logger.error({ error }, 'Failed to complete account setup');
      res.status(500).json({ error: 'Failed to complete account setup' });
    }
  });

  app.get("/api/invitations/employee/:employeeId", authenticateToken, requireRole('Administrator'), async (req: Request, res: Response) => {
    try {
      const { employeeId } = req.params;
      const invitations = await db.select().from(account_invitations)
        .where(eq(account_invitations.employee_id, employeeId))
        .orderBy(desc(account_invitations.created_at));
      res.json(invitations);
    } catch (error) {
      logger.error({ error }, 'Failed to fetch invitations');
      res.status(500).json({ error: 'Failed to fetch invitations' });
    }
  });

  // Coach Assignment Routes
  app.get("/api/coach-assignments", authenticateToken, requireRole('Administrator'), async (req: Request, res: Response) => {
    try {
      const allAssignments = await db.select().from(coach_assignments);
      res.json(allAssignments);
    } catch (error) {
      logger.error({ error }, 'Failed to fetch coach assignments');
      res.status(500).json({ error: 'Failed to fetch coach assignments' });
    }
  });

  app.get("/api/coach-assignments/coach/:coachId", authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { coachId } = req.params;
      if (user.role === 'Job Coach' && user.id !== coachId) {
        return res.status(403).json({ error: 'You can only view your own assignments' });
      }
      if (user.role === 'Guardian' || user.role === 'Super Scooper') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      const assignments = await db.select().from(coach_assignments).where(eq(coach_assignments.coach_id, coachId));
      res.json(assignments);
    } catch (error) {
      logger.error({ error, coachId: req.params.coachId }, 'Failed to fetch coach assignments by coach');
      res.status(500).json({ error: 'Failed to fetch coach assignments' });
    }
  });

  app.get("/api/coach-assignments/scooper/:scooperId", authenticateToken, requireRole('Administrator', 'Shift Lead', 'Assistant Manager'), async (req: Request, res: Response) => {
    try {
      const { scooperId } = req.params;
      const assignments = await db.select().from(coach_assignments).where(eq(coach_assignments.scooper_id, scooperId));
      res.json(assignments);
    } catch (error) {
      logger.error({ error, scooperId: req.params.scooperId }, 'Failed to fetch coach assignments by scooper');
      res.status(500).json({ error: 'Failed to fetch coach assignments' });
    }
  });

  app.post("/api/coach-assignments", authenticateToken, requireRole('Administrator'), async (req: Request, res: Response) => {
    try {
      const parsed = insertCoachAssignmentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request body', details: parsed.error.errors });
      }

      const { coach_id, scooper_id } = parsed.data;

      const [coach] = await db.select().from(employees).where(eq(employees.id, coach_id)).limit(1);
      if (!coach) {
        return res.status(404).json({ error: 'Coach employee not found' });
      }
      if (coach.role !== 'Job Coach') {
        return res.status(400).json({ error: 'Referenced employee is not a Job Coach' });
      }

      const [scooper] = await db.select().from(employees).where(eq(employees.id, scooper_id)).limit(1);
      if (!scooper) {
        return res.status(404).json({ error: 'Scooper employee not found' });
      }
      if (scooper.role !== 'Super Scooper') {
        return res.status(400).json({ error: 'Referenced employee is not a Super Scooper' });
      }

      const [newAssignment] = await db.insert(coach_assignments).values(parsed.data).returning();
      res.json(newAssignment);
    } catch (error: any) {
      if (error?.code === '23505') {
        return res.status(409).json({ error: 'This coach-scooper assignment already exists' });
      }
      logger.error({ error }, 'Failed to create coach assignment');
      res.status(500).json({ error: 'Failed to create coach assignment' });
    }
  });

  app.delete("/api/coach-assignments/:id", authenticateToken, requireRole('Administrator'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await db.delete(coach_assignments).where(eq(coach_assignments.id, id));
      res.json({ success: true });
    } catch (error) {
      logger.error({ error, id: req.params.id }, 'Failed to delete coach assignment');
      res.status(500).json({ error: 'Failed to delete coach assignment' });
    }
  });

  // Employee Contacts Routes
  app.get("/api/employees/:employeeId/contacts", authenticateToken, async (req: Request, res: Response) => {
    try {
      const { employeeId } = req.params;
      const user = (req as any).user;
      if (user.role === 'Guardian') {
        const rels = await db.select().from(guardian_relationships).where(eq(guardian_relationships.guardian_id, user.id));
        const scooperIds = rels.map(r => r.scooper_id);
        if (!scooperIds.includes(employeeId)) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }
      const contacts = await db.select().from(employee_contacts)
        .where(eq(employee_contacts.employee_id, employeeId))
        .orderBy(employee_contacts.created_at);
      res.json(contacts);
    } catch (error) {
      logger.error({ error, employeeId: req.params.employeeId }, 'Failed to fetch employee contacts');
      res.status(500).json({ error: 'Failed to fetch contacts' });
    }
  });

  app.post("/api/employees/:employeeId/contacts", authenticateToken, requirePermission('contacts', 'can_modify'), async (req: Request, res: Response) => {
    try {
      const { employeeId } = req.params;
      const user = (req as any).user;
      const { first_name, last_name, relationship_type, phone, email, is_emergency_contact } = req.body;

      if (!first_name || !last_name) {
        return res.status(400).json({ error: 'First name and last name are required' });
      }
      if (is_emergency_contact && (!phone || phone.trim() === '')) {
        return res.status(400).json({ error: 'Phone number is required for emergency contacts' });
      }

      const [contact] = await db.insert(employee_contacts).values({
        employee_id: employeeId,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        relationship_type: relationship_type || 'Parent/Guardian',
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        is_emergency_contact: is_emergency_contact || false,
        has_app_access: false,
        created_by: user.id,
      }).returning();

      logger.info({ contactId: contact.id, employeeId }, 'Employee contact created');
      res.json(contact);
    } catch (error) {
      logger.error({ error, employeeId: req.params.employeeId }, 'Failed to create employee contact');
      res.status(500).json({ error: 'Failed to create contact' });
    }
  });

  app.patch("/api/contacts/:contactId", authenticateToken, requirePermission('contacts', 'can_modify'), async (req: Request, res: Response) => {
    try {
      const { contactId } = req.params;
      const { first_name, last_name, relationship_type, phone, email, is_emergency_contact } = req.body;

      if (is_emergency_contact && (!phone || phone.trim() === '')) {
        return res.status(400).json({ error: 'Phone number is required for emergency contacts' });
      }

      const updateData: any = { updated_at: new Date() };
      if (first_name !== undefined) updateData.first_name = first_name.trim();
      if (last_name !== undefined) updateData.last_name = last_name.trim();
      if (relationship_type !== undefined) updateData.relationship_type = relationship_type;
      if (phone !== undefined) updateData.phone = phone?.trim() || null;
      if (email !== undefined) updateData.email = email?.trim() || null;
      if (is_emergency_contact !== undefined) updateData.is_emergency_contact = is_emergency_contact;

      const [updated] = await db.update(employee_contacts)
        .set(updateData)
        .where(eq(employee_contacts.id, contactId))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      logger.info({ contactId }, 'Employee contact updated');
      res.json(updated);
    } catch (error) {
      logger.error({ error, contactId: req.params.contactId }, 'Failed to update contact');
      res.status(500).json({ error: 'Failed to update contact' });
    }
  });

  app.delete("/api/contacts/:contactId", authenticateToken, requirePermission('contacts', 'can_delete'), async (req: Request, res: Response) => {
    try {
      const { contactId } = req.params;
      const [contact] = await db.select().from(employee_contacts).where(eq(employee_contacts.id, contactId)).limit(1);
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      await db.delete(employee_contacts).where(eq(employee_contacts.id, contactId));
      logger.info({ contactId, employeeId: contact.employee_id }, 'Employee contact deleted');
      res.json({ success: true });
    } catch (error) {
      logger.error({ error, contactId: req.params.contactId }, 'Failed to delete contact');
      res.status(500).json({ error: 'Failed to delete contact' });
    }
  });

  app.post("/api/contacts/:contactId/grant-access", authenticateToken, requireRole('Administrator'), async (req: Request, res: Response) => {
    try {
      const { contactId } = req.params;
      const user = (req as any).user;

      const [contact] = await db.select().from(employee_contacts).where(eq(employee_contacts.id, contactId)).limit(1);
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      if (!['Parent/Guardian', 'Parent'].includes(contact.relationship_type)) {
        return res.status(400).json({ error: 'App access can only be granted to Parent/Guardian or Parent relationships' });
      }

      if (!contact.email || contact.email.trim() === '') {
        return res.status(400).json({ error: 'Email is required to grant app access' });
      }

      if (contact.linked_guardian_id) {
        return res.status(400).json({ error: 'App access already granted for this contact' });
      }

      const existingEmail = await db.select().from(employees).where(eq(employees.email, contact.email)).limit(1);
      if (existingEmail.length > 0) {
        return res.status(409).json({ error: 'An account with this email already exists' });
      }

      const [newGuardian] = await db.insert(employees).values({
        first_name: contact.first_name,
        last_name: contact.last_name,
        name: `${contact.first_name} ${contact.last_name}`,
        email: contact.email,
        role: 'Guardian',
        is_active: true,
        has_system_access: true,
      }).returning();

      await db.insert(guardian_relationships).values({
        guardian_id: newGuardian.id,
        scooper_id: contact.employee_id,
        relationship_type: contact.relationship_type,
        assigned_by: user.id,
      });

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await db.insert(account_invitations).values({
        employee_id: newGuardian.id,
        email: contact.email,
        token,
        expires_at: expiresAt,
        created_by: user.id,
      });

      const [updatedContact] = await db.update(employee_contacts)
        .set({
          has_app_access: true,
          linked_guardian_id: newGuardian.id,
          invite_token: token,
          invite_status: 'invited',
          updated_at: new Date(),
        })
        .where(eq(employee_contacts.id, contactId))
        .returning();

      const setupUrl = `${req.protocol}://${req.get('host')}?setup=${token}`;

      logger.info({ contactId, guardianId: newGuardian.id, employeeId: contact.employee_id }, 'App access granted to contact');
      res.json({ contact: updatedContact, setupUrl });
    } catch (error: any) {
      if (error?.code === '23505') {
        return res.status(409).json({ error: 'This guardian relationship already exists' });
      }
      logger.error({ error, contactId: req.params.contactId }, 'Failed to grant app access');
      res.status(500).json({ error: 'Failed to grant app access' });
    }
  });

  // Guardian Relationship Routes
  app.get("/api/guardian-relationships", authenticateToken, requireRole('Administrator'), async (req: Request, res: Response) => {
    try {
      const allRelationships = await db.select().from(guardian_relationships);
      res.json(allRelationships);
    } catch (error) {
      logger.error({ error }, 'Failed to fetch guardian relationships');
      res.status(500).json({ error: 'Failed to fetch guardian relationships' });
    }
  });

  app.get("/api/guardian-relationships/guardian/:guardianId", authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { guardianId } = req.params;
      if (user.role === 'Guardian' && user.id !== guardianId) {
        return res.status(403).json({ error: 'You can only view your own relationships' });
      }
      if (user.role === 'Super Scooper') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      const relationships = await db.select().from(guardian_relationships).where(eq(guardian_relationships.guardian_id, guardianId));
      res.json(relationships);
    } catch (error) {
      logger.error({ error, guardianId: req.params.guardianId }, 'Failed to fetch guardian relationships by guardian');
      res.status(500).json({ error: 'Failed to fetch guardian relationships' });
    }
  });

  app.get("/api/guardian-relationships/scooper/:scooperId", authenticateToken, requireRole('Administrator', 'Shift Lead', 'Assistant Manager'), async (req: Request, res: Response) => {
    try {
      const { scooperId } = req.params;
      const relationships = await db.select().from(guardian_relationships).where(eq(guardian_relationships.scooper_id, scooperId));
      const enriched = await Promise.all(relationships.map(async (rel) => {
        const guardian = await db.select().from(employees).where(eq(employees.id, rel.guardian_id)).limit(1);
        return {
          ...rel,
          guardian_first_name: guardian[0]?.first_name || null,
          guardian_last_name: guardian[0]?.last_name || null,
          guardian_email: guardian[0]?.email || null,
        };
      }));
      res.json(enriched);
    } catch (error) {
      logger.error({ error, scooperId: req.params.scooperId }, 'Failed to fetch guardian relationships by scooper');
      res.status(500).json({ error: 'Failed to fetch guardian relationships' });
    }
  });

  app.post("/api/guardian-relationships", authenticateToken, requireRole('Administrator'), async (req: Request, res: Response) => {
    try {
      const parsed = insertGuardianRelationshipSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request body', details: parsed.error.errors });
      }

      const { guardian_id, scooper_id } = parsed.data;

      const [guardian] = await db.select().from(employees).where(eq(employees.id, guardian_id)).limit(1);
      if (!guardian) {
        return res.status(404).json({ error: 'Guardian employee not found' });
      }
      if (guardian.role !== 'Guardian') {
        return res.status(400).json({ error: 'Referenced employee is not a Guardian' });
      }

      const [scooper] = await db.select().from(employees).where(eq(employees.id, scooper_id)).limit(1);
      if (!scooper) {
        return res.status(404).json({ error: 'Scooper employee not found' });
      }
      if (scooper.role !== 'Super Scooper') {
        return res.status(400).json({ error: 'Referenced employee is not a Super Scooper' });
      }

      const [newRelationship] = await db.insert(guardian_relationships).values(parsed.data).returning();
      res.json(newRelationship);
    } catch (error: any) {
      if (error?.code === '23505') {
        return res.status(409).json({ error: 'This guardian-scooper relationship already exists' });
      }
      logger.error({ error }, 'Failed to create guardian relationship');
      res.status(500).json({ error: 'Failed to create guardian relationship' });
    }
  });

  app.delete("/api/guardian-relationships/:id", authenticateToken, requireRole('Administrator'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await db.delete(guardian_relationships).where(eq(guardian_relationships.id, id));
      res.json({ success: true });
    } catch (error) {
      logger.error({ error, id: req.params.id }, 'Failed to delete guardian relationship');
      res.status(500).json({ error: 'Failed to delete guardian relationship' });
    }
  });

  // Create guardian + link to scooper in one step
  app.post("/api/guardian-relationships/create-with-guardian", authenticateToken, requireRole('Administrator', 'Shift Lead', 'Assistant Manager'), async (req: Request, res: Response) => {
    try {
      const { scooper_id, first_name, last_name, email, phone, relationship_type } = req.body;

      if (!scooper_id || !first_name || !last_name) {
        return res.status(400).json({ error: 'scooper_id, first_name, and last_name are required' });
      }

      const [scooper] = await db.select().from(employees).where(eq(employees.id, scooper_id)).limit(1);
      if (!scooper) {
        return res.status(404).json({ error: 'Super Scooper not found' });
      }
      if (scooper.role !== 'Super Scooper') {
        return res.status(400).json({ error: 'Referenced employee is not a Super Scooper' });
      }

      if (email && email.trim() !== '') {
        const existing = await db.select().from(employees).where(eq(employees.email, email)).limit(1);
        if (existing.length > 0) {
          return res.status(409).json({ error: 'An employee with this email already exists' });
        }
      }

      const user = (req as any).user;
      const guardianData: any = {
        first_name,
        last_name,
        name: `${first_name} ${last_name}`,
        email: email && email.trim() !== '' ? email.trim() : null,
        phone: phone || null,
        role: 'Guardian',
        is_active: true,
        has_system_access: false,
      };

      const [newGuardian] = await db.insert(employees).values(guardianData).returning();

      const [newRelationship] = await db.insert(guardian_relationships).values({
        guardian_id: newGuardian.id,
        scooper_id,
        relationship_type: relationship_type || 'guardian',
        assigned_by: user?.id,
      }).returning();

      const { password: _, ...guardianWithoutPassword } = newGuardian;
      logger.info({ guardianId: newGuardian.id, scooperId: scooper_id }, 'Guardian created and linked to scooper');
      res.json({ guardian: guardianWithoutPassword, relationship: newRelationship });
    } catch (error: any) {
      if (error?.code === '23505') {
        return res.status(409).json({ error: 'This guardian relationship already exists' });
      }
      logger.error({ error }, 'Failed to create guardian with relationship');
      res.status(500).json({ error: 'Failed to create guardian' });
    }
  });

  // Promotion Certifications endpoints
  app.get("/api/certifications/:employeeId", authenticateToken, async (req: Request, res: Response) => {
    try {
      const { employeeId } = req.params;
      const certs = await db.select().from(promotion_certifications)
        .where(eq(promotion_certifications.employee_id, employeeId))
        .orderBy(desc(promotion_certifications.created_at));
      res.json(certs);
    } catch (error) {
      logger.error({ error, employeeId: req.params.employeeId }, 'Failed to fetch certifications');
      res.status(500).json({ error: 'Failed to fetch certifications' });
    }
  });

  app.get("/api/certifications", authenticateToken, async (req: Request, res: Response) => {
    try {
      const certs = await db.select().from(promotion_certifications)
        .orderBy(desc(promotion_certifications.created_at));
      res.json(certs);
    } catch (error) {
      logger.error({ error }, 'Failed to fetch all certifications');
      res.status(500).json({ error: 'Failed to fetch certifications' });
    }
  });

  app.post("/api/certifications", authenticateToken, requirePermission('promotion_certifications', 'can_modify'), async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      if (body.response_set_id) {
        const [responseSet] = await db.select().from(form_response_sets)
          .where(eq(form_response_sets.id, body.response_set_id))
          .limit(1);
        if (!responseSet) return res.status(404).json({ error: 'Certification response not found' });
        if (responseSet.status !== 'submitted') return res.status(409).json({ error: 'Submit the certification form before recording it' });
        if (responseSet.employee_id !== body.employee_id) return res.status(400).json({ error: 'Certification response belongs to a different employee' });

        const template: any = responseSet.template_snapshot_json || await hydrateFormTemplate(responseSet.template_id);
        const expectedFormType = body.certification_type === 'mentor' ? 'mentor_certification' : 'shift_lead_certification';
        if (!template || template.form_type !== expectedFormType) return res.status(400).json({ error: 'Certification response does not match the selected certification type' });

        const [existing] = await db.select().from(promotion_certifications)
          .where(eq(promotion_certifications.response_set_id, responseSet.id))
          .limit(1);
        if (existing) return res.json(existing);

        const answers = await db.select().from(form_answers).where(eq(form_answers.response_set_id, responseSet.id));
        const scoredAnswers = answers.map(answer => String(answer.value_json || '').toLowerCase())
          .filter(value => value === 'yes' || value === 'no');
        const correct = scoredAnswers.filter(value => value === 'yes').length;
        const score = scoredAnswers.length ? Math.round((correct / scoredAnswers.length) * 100) : 0;
        const passingScore = Number((template.settings_json || {}).passing_score || (body.certification_type === 'mentor' ? 84 : 90));
        body.score = score;
        body.passing_score = passingScore;
        body.passed = score >= passingScore;
        body.checklist_results = [];
      }

      const parsed = insertPromotionCertificationSchema.parse(body);
      const [cert] = await db.insert(promotion_certifications).values(parsed).returning();
      logger.info({ certId: cert.id, employeeId: cert.employee_id, type: cert.certification_type, score: cert.score, passed: cert.passed }, 'Promotion certification recorded');
      res.json(cert);
    } catch (error: any) {
      logger.error({ error, body: req.body }, 'Failed to create certification');
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid certification data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create certification' });
    }
  });

  app.delete("/api/certifications/:id", authenticateToken, requirePermission('promotion_certifications', 'can_delete'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await db.delete(promotion_certifications).where(eq(promotion_certifications.id, id));
      logger.info({ certId: id }, 'Promotion certification deleted');
      res.json({ success: true });
    } catch (error) {
      logger.error({ error, id: req.params.id }, 'Failed to delete certification');
      res.status(500).json({ error: 'Failed to delete certification' });
    }
  });

  // Unified Notes Feed
  app.get("/api/scoopers/:scooperId/notes-feed", authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthUser;
      const { scooperId } = req.params;

      if (!(await canAccessScooper(user, scooperId))) {
        return res.status(403).json({ error: 'You do not have access to this profile' });
      }

      const [scooper] = await db.select({ id: employees.id, role: employees.role })
        .from(employees)
        .where(eq(employees.id, scooperId))
        .limit(1);
      if (!scooper || scooper.role !== 'Super Scooper') {
        return res.status(404).json({ error: 'Scooper profile not found' });
      }

      const [notes, canWrite] = await Promise.all([
        loadUnifiedNotes(scooperId, user.id, user.role),
        canWriteNotes(user, scooperId),
      ]);

      res.json({
        scooper_id: scooperId,
        notes,
        permissions: {
          can_write: canWrite,
          can_delete_any: user.role === 'Administrator',
        },
      });
    } catch (error) {
      logger.error({ error, scooperId: req.params.scooperId }, 'Failed to fetch unified notes feed');
      res.status(500).json({ error: 'Failed to fetch notes feed' });
    }
  });

  app.post("/api/scoopers/:scooperId/notes-feed", authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthUser;
      const { scooperId } = req.params;
      const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';

      if (!body) return res.status(400).json({ error: 'Note body is required' });
      if (body.length > 10000) return res.status(400).json({ error: 'Note body is too long' });
      const [scooper] = await db.select({ id: employees.id, role: employees.role })
        .from(employees)
        .where(eq(employees.id, scooperId))
        .limit(1);
      if (!scooper || scooper.role !== 'Super Scooper') {
        return res.status(404).json({ error: 'Scooper profile not found' });
      }
      if (!(await canWriteNotes(user, scooperId))) {
        return res.status(403).json({ error: 'You do not have permission to write notes for this profile' });
      }

      let sourceType: 'guardian' | 'coach';
      let sourceId: string;
      if (user.role === 'Guardian') {
        const [created] = await db.insert(guardian_notes).values({
          guardian_id: user.id,
          scooper_id: scooperId,
          note: body,
        }).returning({ id: guardian_notes.id });
        sourceType = 'guardian';
        sourceId = created.id;
      } else {
        const [created] = await db.insert(coach_notes).values({
          employee_id: scooperId,
          coach_id: user.id,
          title: 'Note',
          content: body,
        }).returning({ id: coach_notes.id });
        sourceType = 'coach';
        sourceId = created.id;
      }

      const notes = await loadUnifiedNotes(scooperId, user.id, user.role);
      const createdNote = notes.find(note => note.sourceType === sourceType && note.sourceId === sourceId);
      logger.info({ scooperId, authorId: user.id, sourceType, sourceId }, 'Unified note created');
      res.status(201).json(createdNote);
    } catch (error) {
      logger.error({ error, scooperId: req.params.scooperId }, 'Failed to create unified note');
      res.status(500).json({ error: 'Failed to create note' });
    }
  });

  app.put("/api/scoopers/:scooperId/notes-feed/:sourceType/:sourceId", authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthUser;
      const { scooperId, sourceType, sourceId } = req.params;
      const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';

      if (!body) return res.status(400).json({ error: 'Note body is required' });
      if (body.length > 10000) return res.status(400).json({ error: 'Note body is too long' });
      const [scooper] = await db.select({ id: employees.id, role: employees.role })
        .from(employees)
        .where(eq(employees.id, scooperId))
        .limit(1);
      if (!scooper || scooper.role !== 'Super Scooper') {
        return res.status(404).json({ error: 'Scooper profile not found' });
      }
      if (!(await canAccessScooper(user, scooperId))) {
        return res.status(403).json({ error: 'You do not have access to this profile' });
      }
      if (sourceType !== 'guardian' && sourceType !== 'coach') {
        return res.status(400).json({ error: 'This feed item cannot be edited' });
      }

      let authorId: string | undefined;
      if (sourceType === 'guardian') {
        const [existing] = await db.select({
          id: guardian_notes.id,
          guardian_id: guardian_notes.guardian_id,
        }).from(guardian_notes).where(and(
          eq(guardian_notes.id, sourceId),
          eq(guardian_notes.scooper_id, scooperId),
        )).limit(1);
        if (!existing) return res.status(404).json({ error: 'Note not found' });
        authorId = existing.guardian_id;
        if (authorId !== user.id) return res.status(403).json({ error: 'You can only edit your own notes' });
        await db.update(guardian_notes)
          .set({ note: body, updated_at: new Date() })
          .where(eq(guardian_notes.id, sourceId));
      } else {
        const [existing] = await db.select({
          id: coach_notes.id,
          coach_id: coach_notes.coach_id,
        }).from(coach_notes).where(and(
          eq(coach_notes.id, sourceId),
          eq(coach_notes.employee_id, scooperId),
        )).limit(1);
        if (!existing) return res.status(404).json({ error: 'Note not found' });
        authorId = existing.coach_id;
        if (authorId !== user.id) return res.status(403).json({ error: 'You can only edit your own notes' });
        await db.update(coach_notes)
          .set({ content: body, updated_at: new Date() })
          .where(eq(coach_notes.id, sourceId));
      }

      const notes = await loadUnifiedNotes(scooperId, user.id, user.role);
      const updated = notes.find(note => note.sourceType === sourceType && note.sourceId === sourceId);
      logger.info({ scooperId, authorId, sourceType, sourceId }, 'Unified note updated');
      res.json(updated);
    } catch (error) {
      logger.error({ error, scooperId: req.params.scooperId, sourceId: req.params.sourceId }, 'Failed to update unified note');
      res.status(500).json({ error: 'Failed to update note' });
    }
  });

  app.delete("/api/scoopers/:scooperId/notes-feed/:sourceType/:sourceId", authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthUser;
      const { scooperId, sourceType, sourceId } = req.params;

      if (user.role !== 'Administrator') {
        return res.status(403).json({ error: 'Only Administrators can delete feed notes' });
      }
      const [scooper] = await db.select({ id: employees.id, role: employees.role })
        .from(employees)
        .where(eq(employees.id, scooperId))
        .limit(1);
      if (!scooper || scooper.role !== 'Super Scooper') {
        return res.status(404).json({ error: 'Scooper profile not found' });
      }
      if (!(await canAccessScooper(user, scooperId))) {
        return res.status(403).json({ error: 'You do not have access to this profile' });
      }
      if (sourceType === 'guardian') {
        const deleted = await db.delete(guardian_notes).where(and(
          eq(guardian_notes.id, sourceId),
          eq(guardian_notes.scooper_id, scooperId),
        )).returning({ id: guardian_notes.id });
        if (deleted.length === 0) return res.status(404).json({ error: 'Note not found' });
      } else if (sourceType === 'coach') {
        const deleted = await db.delete(coach_notes).where(and(
          eq(coach_notes.id, sourceId),
          eq(coach_notes.employee_id, scooperId),
        )).returning({ id: coach_notes.id });
        if (deleted.length === 0) return res.status(404).json({ error: 'Note not found' });
      } else {
        return res.status(400).json({ error: 'This feed item cannot be deleted' });
      }

      logger.info({ scooperId, administratorId: user.id, sourceType, sourceId }, 'Unified note deleted');
      res.json({ success: true });
    } catch (error) {
      logger.error({ error, scooperId: req.params.scooperId, sourceId: req.params.sourceId }, 'Failed to delete unified note');
      res.status(500).json({ error: 'Failed to delete note' });
    }
  });

// Guardian Notes Routes
  // Get all notes for a scooper (viewable by admins/managers/job coaches)
  app.get("/api/guardian-notes/scooper/:scooperId", authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthUser;
      const { scooperId } = req.params;
      
      // Guardians can only see their own notes for their linked scoopers
      if (user.role === 'Guardian') {
        const notes = await db.select().from(guardian_notes)
          .where(and(
            eq(guardian_notes.scooper_id, scooperId),
            eq(guardian_notes.guardian_id, user.id)
          ));
        return res.json(notes);
      }
      
      // Super Scoopers cannot view guardian notes
      if (user.role === 'Super Scooper') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      
      // Admins, managers, and job coaches can see all notes for a scooper
      const notes = await db.select().from(guardian_notes)
        .where(eq(guardian_notes.scooper_id, scooperId))
        .orderBy(desc(guardian_notes.updated_at));
      res.json(notes);
    } catch (error) {
      logger.error({ error, scooperId: req.params.scooperId }, 'Failed to fetch guardian notes for scooper');
      res.status(500).json({ error: 'Failed to fetch guardian notes' });
    }
  });

  // Get notes by guardian (for guardian's own notes)
  app.get("/api/guardian-notes/guardian/:guardianId", authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthUser;
      const { guardianId } = req.params;
      
      // Guardians can only view their own notes
      if (user.role === 'Guardian' && user.id !== guardianId) {
        return res.status(403).json({ error: 'You can only view your own notes' });
      }
      
      // Super Scoopers cannot view guardian notes
      if (user.role === 'Super Scooper') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      
      const notes = await db.select().from(guardian_notes)
        .where(eq(guardian_notes.guardian_id, guardianId))
        .orderBy(desc(guardian_notes.updated_at));
      res.json(notes);
    } catch (error) {
      logger.error({ error, guardianId: req.params.guardianId }, 'Failed to fetch guardian notes by guardian');
      res.status(500).json({ error: 'Failed to fetch guardian notes' });
    }
  });

  // Create a guardian note. Guardian notes are timeline entries; each save
  // creates a new row rather than overwriting the previous entry.
  app.post("/api/guardian-notes", authenticateToken, requirePermission('guardian_notes', 'can_modify'), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthUser;
      
      // Only guardians can create notes
      if (user.role !== 'Guardian') {
        return res.status(403).json({ error: 'Only guardians can create notes' });
      }
      
      const parsed = insertGuardianNoteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request body', details: parsed.error.errors });
      }
      
      const { guardian_id, scooper_id, note } = parsed.data;
      
      // Verify the guardian is creating a note for themselves
      if (guardian_id !== user.id) {
        return res.status(403).json({ error: 'You can only create notes as yourself' });
      }
      
      // Verify guardian-scooper relationship exists
      const [relationship] = await db.select().from(guardian_relationships)
        .where(and(
          eq(guardian_relationships.guardian_id, guardian_id),
          eq(guardian_relationships.scooper_id, scooper_id)
        ))
        .limit(1);
      
      if (!relationship) {
        return res.status(400).json({ error: 'You are not linked to this family member' });
      }
      
      const [newNote] = await db.insert(guardian_notes).values(parsed.data).returning();
      logger.info({ guardianId: guardian_id, scooperId: scooper_id, noteId: newNote.id }, 'Guardian note created');
      return res.json(newNote);
    } catch (error) {
      logger.error({ error, body: req.body }, 'Failed to create/update guardian note');
      res.status(500).json({ error: 'Failed to save guardian note' });
    }
  });

  // Update a guardian note
  app.put("/api/guardian-notes/:id", authenticateToken, requirePermission('guardian_notes', 'can_modify'), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthUser;
      const { id } = req.params;
      const { note } = req.body;
      
      // Get the existing note
      const [existingNote] = await db.select().from(guardian_notes)
        .where(eq(guardian_notes.id, id))
        .limit(1);
      
      if (!existingNote) {
        return res.status(404).json({ error: 'Note not found' });
      }
      
      // Only the guardian who created the note can update it
      if (existingNote.guardian_id !== user.id) {
        return res.status(403).json({ error: 'You can only edit your own notes' });
      }
      
      const [updatedNote] = await db.update(guardian_notes)
        .set({ note, updated_at: new Date() })
        .where(eq(guardian_notes.id, id))
        .returning();
      
      logger.info({ noteId: id, guardianId: user.id }, 'Guardian note updated');
      res.json(updatedNote);
    } catch (error) {
      logger.error({ error, id: req.params.id }, 'Failed to update guardian note');
      res.status(500).json({ error: 'Failed to update guardian note' });
    }
  });

  // Delete a guardian note
  app.delete("/api/guardian-notes/:id", authenticateToken, requirePermission('guardian_notes', 'can_delete'), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthUser;
      const { id } = req.params;
      
      // Get the existing note
      const [existingNote] = await db.select().from(guardian_notes)
        .where(eq(guardian_notes.id, id))
        .limit(1);
      
      if (!existingNote) {
        return res.status(404).json({ error: 'Note not found' });
      }
      
      // Only the guardian who created the note can delete it
      if (existingNote.guardian_id !== user.id) {
        return res.status(403).json({ error: 'You can only delete your own notes' });
      }
      
      await db.delete(guardian_notes).where(eq(guardian_notes.id, id));
      
      logger.info({ noteId: id, guardianId: user.id }, 'Guardian note deleted');
      res.json({ success: true });
    } catch (error) {
      logger.error({ error, id: req.params.id }, 'Failed to delete guardian note');
      res.status(500).json({ error: 'Failed to delete guardian note' });
    }
  });

  // ========== Coach Check-In Endpoints ==========

  app.get("/api/checkins/:employeeId", authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { employeeId } = req.params;

      if (!['Job Coach', 'Administrator', 'Shift Lead', 'Assistant Manager'].includes(user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      if (user.role === 'Job Coach') {
        const assignments = await db.select().from(coach_assignments)
          .where(and(eq(coach_assignments.coach_id, user.id), eq(coach_assignments.scooper_id, employeeId)));
        if (assignments.length === 0) {
          return res.status(403).json({ error: 'Not assigned to this employee' });
        }
      }

      const checkins = await db.select().from(coach_checkins)
        .where(eq(coach_checkins.employee_id, employeeId))
        .orderBy(desc(coach_checkins.checkin_date));

      const coachIds = Array.from(new Set(checkins.map(c => c.coach_id)));
      let coachMap: Record<string, string> = {};
      if (coachIds.length > 0) {
        const coaches = await db.select({ id: employees.id, first_name: employees.first_name, last_name: employees.last_name })
          .from(employees).where(inArray(employees.id, coachIds));
        coachMap = Object.fromEntries(coaches.map(c => [c.id, `${c.first_name || ''} ${c.last_name || ''}`.trim()]));
      }

      const enriched = checkins.map(c => ({ ...c, coach_name: coachMap[c.coach_id] || 'Unknown' }));
      res.json(enriched);
    } catch (error) {
      logger.error({ error, employeeId: req.params.employeeId }, 'Failed to fetch check-ins');
      res.status(500).json({ error: 'Failed to fetch check-ins' });
    }
  });

  // New check-ins are form responses. This endpoint intentionally also returns
  // legacy rows so history remains complete while the old table is retained.
  app.get("/api/coach-checkins/:employeeId", authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthUser;
      const { employeeId } = req.params;
      if (!['Job Coach', 'Administrator'].includes(user.role) || !await canAccessScooper(user, employeeId)) {
        return res.status(403).json({ error: 'You cannot access check-ins for this employee' });
      }

      const [template] = await db.select().from(form_templates)
        .where(and(eq(form_templates.form_type, 'coach_checkin'), eq(form_templates.status, 'active')))
        .orderBy(desc(form_templates.updated_at))
        .limit(1);
      const responseSets = template
        ? await db.select().from(form_response_sets)
          .where(and(eq(form_response_sets.template_id, template.id), eq(form_response_sets.employee_id, employeeId)))
          .orderBy(desc(form_response_sets.updated_at))
        : [];
      const responses = await Promise.all(responseSets.map(response => responsePayload(response.id)));

      const legacyRows = await db.select().from(coach_checkins)
        .where(eq(coach_checkins.employee_id, employeeId))
        .orderBy(desc(coach_checkins.checkin_date));
      const coachIds = Array.from(new Set(legacyRows.map(checkin => checkin.coach_id)));
      const coaches = coachIds.length > 0
        ? await db.select({ id: employees.id, first_name: employees.first_name, last_name: employees.last_name })
          .from(employees).where(inArray(employees.id, coachIds))
        : [];
      const coachMap = Object.fromEntries(coaches.map(coach => [coach.id, `${coach.first_name || ''} ${coach.last_name || ''}`.trim()]));

      res.json(buildCoachCheckinPayload({
        template: template ? await hydrateFormTemplate(template.id) : null,
        responses,
        legacyRows,
        coachMap,
      }));
    } catch (error) {
      logger.error({ error, employeeId: req.params.employeeId }, 'Failed to fetch coach check-ins');
      res.status(500).json({ error: 'Failed to fetch coach check-ins' });
    }
  });

  app.post("/api/checkins", authenticateToken, requirePermission('coach_notes', 'can_modify'), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'Job Coach' && user.role !== 'Administrator') {
        return res.status(403).json({ error: 'Only Job Coaches and Administrators can create check-ins' });
      }

      if (user.role === 'Job Coach') {
        const assignments = await db.select().from(coach_assignments)
          .where(and(eq(coach_assignments.coach_id, user.id), eq(coach_assignments.scooper_id, req.body.employee_id)));
        if (assignments.length === 0) {
          return res.status(403).json({ error: 'Not assigned to this employee' });
        }
      }

      const checkinData = { ...req.body, coach_id: user.id };
      const parsed = insertCoachCheckinSchema.parse(checkinData);

      const [checkin] = await db.insert(coach_checkins).values(parsed).returning();
      logger.info({ checkinId: checkin.id, coachId: user.id, employeeId: parsed.employee_id }, 'Coach check-in created');
      res.json(checkin);
    } catch (error) {
      logger.error({ error }, 'Failed to create check-in');
      res.status(500).json({ error: 'Failed to create check-in' });
    }
  });

  app.put("/api/checkins/:id", authenticateToken, requirePermission('coach_notes', 'can_modify'), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;

      const [existing] = await db.select().from(coach_checkins).where(eq(coach_checkins.id, id));
      if (!existing) return res.status(404).json({ error: 'Check-in not found' });
      if (existing.coach_id !== user.id && user.role !== 'Administrator') {
        return res.status(403).json({ error: 'Only the original coach can edit this check-in' });
      }

      const { setting, how_was_today, independence, engagement, big_win, big_win_type, challenge, safety_concern, safety_details, compared_to_last, support_helped, notes } = req.body;
      const updateData: any = {};
      if (setting !== undefined) updateData.setting = setting;
      if (how_was_today !== undefined) updateData.how_was_today = how_was_today;
      if (independence !== undefined) updateData.independence = independence;
      if (engagement !== undefined) updateData.engagement = engagement;
      if (big_win !== undefined) updateData.big_win = big_win;
      if (big_win_type !== undefined) updateData.big_win_type = big_win_type;
      if (challenge !== undefined) updateData.challenge = challenge;
      if (safety_concern !== undefined) updateData.safety_concern = safety_concern;
      if (safety_details !== undefined) updateData.safety_details = safety_details;
      if (compared_to_last !== undefined) updateData.compared_to_last = compared_to_last;
      if (support_helped !== undefined) updateData.support_helped = support_helped;
      if (notes !== undefined) updateData.notes = notes;
      const [updated] = await db.update(coach_checkins).set(updateData).where(eq(coach_checkins.id, id)).returning();
      res.json(updated);
    } catch (error) {
      logger.error({ error, id: req.params.id }, 'Failed to update check-in');
      res.status(500).json({ error: 'Failed to update check-in' });
    }
  });

  app.delete("/api/checkins/:id", authenticateToken, requirePermission('coach_notes', 'can_delete'), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;

      const [existing] = await db.select().from(coach_checkins).where(eq(coach_checkins.id, id));
      if (!existing) return res.status(404).json({ error: 'Check-in not found' });
      if (existing.coach_id !== user.id && user.role !== 'Administrator') {
        return res.status(403).json({ error: 'Only the original coach can delete this check-in' });
      }

      await db.delete(coach_checkins).where(eq(coach_checkins.id, id));
      res.json({ success: true });
    } catch (error) {
      logger.error({ error, id: req.params.id }, 'Failed to delete check-in');
      res.status(500).json({ error: 'Failed to delete check-in' });
    }
  });

  // ========== Coach Files Endpoints ==========

  const fileUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = [
        'application/pdf',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/rtf',
        'text/rtf',
      ];
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Only PDF, TXT, DOC, DOCX, and RTF files are allowed'));
      }
    },
  });

  app.get("/api/coach-files/:employeeId", authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { employeeId } = req.params;

      if (!['Job Coach', 'Administrator', 'Shift Lead', 'Assistant Manager'].includes(user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      if (user.role === 'Job Coach') {
        const assignments = await db.select().from(coach_assignments)
          .where(and(eq(coach_assignments.coach_id, user.id), eq(coach_assignments.scooper_id, employeeId)));
        if (assignments.length === 0) {
          return res.status(403).json({ error: 'Not assigned to this employee' });
        }
      }

      const files = await db.select().from(coach_files)
        .where(eq(coach_files.employee_id, employeeId))
        .orderBy(desc(coach_files.uploaded_at));

      const coachIds = Array.from(new Set(files.map(f => f.coach_id)));
      let coachMap: Record<string, string> = {};
      if (coachIds.length > 0) {
        const coaches = await db.select({ id: employees.id, first_name: employees.first_name, last_name: employees.last_name })
          .from(employees).where(inArray(employees.id, coachIds));
        coachMap = Object.fromEntries(coaches.map(c => [c.id, `${c.first_name || ''} ${c.last_name || ''}`.trim()]));
      }

      const enriched = files.map(f => ({ ...f, coach_name: coachMap[f.coach_id] || 'Unknown' }));
      res.json(enriched);
    } catch (error) {
      logger.error({ error, employeeId: req.params.employeeId }, 'Failed to fetch coach files');
      res.status(500).json({ error: 'Failed to fetch files' });
    }
  });

  app.post("/api/coach-files/:employeeId", authenticateToken, requirePermission('coach_files', 'can_modify'), fileUpload.single('file'), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { employeeId } = req.params;

      if (user.role !== 'Job Coach' && user.role !== 'Administrator') {
        return res.status(403).json({ error: 'Only Job Coaches and Administrators can upload files' });
      }

      if (user.role === 'Job Coach') {
        const assignments = await db.select().from(coach_assignments)
          .where(and(eq(coach_assignments.coach_id, user.id), eq(coach_assignments.scooper_id, employeeId)));
        if (assignments.length === 0) {
          return res.status(403).json({ error: 'Not assigned to this employee' });
        }
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const objectStorageService = new ObjectStorageService();
      const privateDir = objectStorageService.getPrivateObjectDir();

      let storagePath: string;

      if (privateDir) {
        const fileId = crypto.randomUUID();
        const ext = file.originalname.split('.').pop() || '';
        const objectPath = `${privateDir}/coach-files/${employeeId}/${fileId}.${ext}`;
        const { bucketName, objectName } = parseCoachFilePath(objectPath);
        const bucket = objectStorageClient.bucket(bucketName);
        const blob = bucket.file(objectName);
        await blob.save(file.buffer, { contentType: file.mimetype });
        storagePath = objectPath;
      } else {
        const fs = await import('fs');
        const path = await import('path');
        const uploadDir = path.join('/tmp', 'coach-files', employeeId);
        fs.mkdirSync(uploadDir, { recursive: true });
        const fileId = crypto.randomUUID();
        const ext = file.originalname.split('.').pop() || '';
        const filePath = path.join(uploadDir, `${fileId}.${ext}`);
        fs.writeFileSync(filePath, file.buffer);
        storagePath = filePath;
      }

      const [saved] = await db.insert(coach_files).values({
        employee_id: employeeId,
        coach_id: user.id,
        file_name: file.originalname,
        file_type: file.mimetype,
        file_size: file.size,
        storage_path: storagePath,
      }).returning();

      logger.info({ fileId: saved.id, coachId: user.id, employeeId, fileName: file.originalname }, 'Coach file uploaded');
      res.json(saved);
    } catch (error) {
      logger.error({ error }, 'Failed to upload coach file');
      res.status(500).json({ error: 'Failed to upload file' });
    }
  });

  app.get("/api/coach-files/download/:fileId", authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { fileId } = req.params;

      const [fileRecord] = await db.select().from(coach_files).where(eq(coach_files.id, fileId));
      if (!fileRecord) return res.status(404).json({ error: 'File not found' });

      if (!['Job Coach', 'Administrator', 'Shift Lead', 'Assistant Manager'].includes(user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      if (user.role === 'Job Coach') {
        const assignments = await db.select().from(coach_assignments)
          .where(and(eq(coach_assignments.coach_id, user.id), eq(coach_assignments.scooper_id, fileRecord.employee_id)));
        if (assignments.length === 0) {
          return res.status(403).json({ error: 'Not assigned to this employee' });
        }
      }

      const objectStorageService = new ObjectStorageService();
      const privateDir = objectStorageService.getPrivateObjectDir();

      if (privateDir && fileRecord.storage_path.startsWith(privateDir)) {
        const { bucketName, objectName } = parseCoachFilePath(fileRecord.storage_path);
        const bucket = objectStorageClient.bucket(bucketName);
        const blob = bucket.file(objectName);
        const [exists] = await blob.exists();
        if (!exists) return res.status(404).json({ error: 'File not found in storage' });

        res.setHeader('Content-Type', fileRecord.file_type);
        res.setHeader('Content-Disposition', `inline; filename="${fileRecord.file_name}"`);
        blob.createReadStream().pipe(res);
      } else {
        const fs = await import('fs');
        if (!fs.existsSync(fileRecord.storage_path)) {
          return res.status(404).json({ error: 'File not found on disk' });
        }
        res.setHeader('Content-Type', fileRecord.file_type);
        res.setHeader('Content-Disposition', `inline; filename="${fileRecord.file_name}"`);
        fs.createReadStream(fileRecord.storage_path).pipe(res);
      }
    } catch (error) {
      logger.error({ error, fileId: req.params.fileId }, 'Failed to download coach file');
      res.status(500).json({ error: 'Failed to download file' });
    }
  });

  app.delete("/api/coach-files/:fileId", authenticateToken, requirePermission('coach_files', 'can_delete'), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { fileId } = req.params;

      const [fileRecord] = await db.select().from(coach_files).where(eq(coach_files.id, fileId));
      if (!fileRecord) return res.status(404).json({ error: 'File not found' });
      if (fileRecord.coach_id !== user.id && user.role !== 'Administrator') {
        return res.status(403).json({ error: 'Only the uploader can delete this file' });
      }

      const objectStorageService = new ObjectStorageService();
      const privateDir = objectStorageService.getPrivateObjectDir();

      try {
        if (privateDir && fileRecord.storage_path.startsWith(privateDir)) {
          const { bucketName, objectName } = parseCoachFilePath(fileRecord.storage_path);
          const bucket = objectStorageClient.bucket(bucketName);
          await bucket.file(objectName).delete();
        } else {
          const fs = await import('fs');
          if (fs.existsSync(fileRecord.storage_path)) {
            fs.unlinkSync(fileRecord.storage_path);
          }
        }
      } catch (storageErr) {
        logger.warn({ error: storageErr, fileId }, 'Failed to delete storage file, removing record anyway');
      }

      await db.delete(coach_files).where(eq(coach_files.id, fileId));
      res.json({ success: true });
    } catch (error) {
      logger.error({ error, fileId: req.params.fileId }, 'Failed to delete coach file');
      res.status(500).json({ error: 'Failed to delete file' });
    }
  });

  // ========== Coach Notes Endpoints ==========

  app.get("/api/coach-notes/:employeeId", authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { employeeId } = req.params;

      if (!['Job Coach', 'Administrator', 'Shift Lead', 'Assistant Manager'].includes(user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      if (user.role === 'Job Coach') {
        const assignments = await db.select().from(coach_assignments)
          .where(and(eq(coach_assignments.coach_id, user.id), eq(coach_assignments.scooper_id, employeeId)));
        if (assignments.length === 0) {
          return res.status(403).json({ error: 'Not assigned to this employee' });
        }
      }

      const notes = await db.select().from(coach_notes)
        .where(eq(coach_notes.employee_id, employeeId))
        .orderBy(desc(coach_notes.updated_at));

      const coachIds = Array.from(new Set(notes.map(n => n.coach_id)));
      let coachMap: Record<string, string> = {};
      if (coachIds.length > 0) {
        const coaches = await db.select({ id: employees.id, first_name: employees.first_name, last_name: employees.last_name })
          .from(employees).where(inArray(employees.id, coachIds));
        coachMap = Object.fromEntries(coaches.map(c => [c.id, `${c.first_name || ''} ${c.last_name || ''}`.trim()]));
      }

      const enriched = notes.map(n => ({ ...n, coach_name: coachMap[n.coach_id] || 'Unknown' }));
      res.json(enriched);
    } catch (error) {
      logger.error({ error, employeeId: req.params.employeeId }, 'Failed to fetch coach notes');
      res.status(500).json({ error: 'Failed to fetch notes' });
    }
  });

  app.post("/api/coach-notes", authenticateToken, requirePermission('coach_notes', 'can_modify'), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'Job Coach' && user.role !== 'Administrator') {
        return res.status(403).json({ error: 'Only Job Coaches and Administrators can create notes' });
      }

      if (user.role === 'Job Coach') {
        const assignments = await db.select().from(coach_assignments)
          .where(and(eq(coach_assignments.coach_id, user.id), eq(coach_assignments.scooper_id, req.body.employee_id)));
        if (assignments.length === 0) {
          return res.status(403).json({ error: 'Not assigned to this employee' });
        }
      }

      const noteData = { ...req.body, coach_id: user.id };
      const parsed = insertCoachNoteSchema.parse(noteData);

      const [note] = await db.insert(coach_notes).values(parsed).returning();
      logger.info({ noteId: note.id, coachId: user.id, employeeId: parsed.employee_id }, 'Coach note created');
      res.json(note);
    } catch (error) {
      logger.error({ error }, 'Failed to create coach note');
      res.status(500).json({ error: 'Failed to create note' });
    }
  });

  app.put("/api/coach-notes/:id", authenticateToken, requirePermission('coach_notes', 'can_modify'), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;

      const [existing] = await db.select().from(coach_notes).where(eq(coach_notes.id, id));
      if (!existing) return res.status(404).json({ error: 'Note not found' });
      if (existing.coach_id !== user.id && user.role !== 'Administrator') {
        return res.status(403).json({ error: 'Only the original author can edit this note' });
      }

      const { title, content } = req.body;
      const updateData: any = { updated_at: new Date() };
      if (title !== undefined) updateData.title = title;
      if (content !== undefined) updateData.content = content;

      const [updated] = await db.update(coach_notes).set(updateData).where(eq(coach_notes.id, id)).returning();
      res.json(updated);
    } catch (error) {
      logger.error({ error, id: req.params.id }, 'Failed to update coach note');
      res.status(500).json({ error: 'Failed to update note' });
    }
  });

  app.delete("/api/coach-notes/:id", authenticateToken, requirePermission('coach_notes', 'can_delete'), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;

      const [existing] = await db.select().from(coach_notes).where(eq(coach_notes.id, id));
      if (!existing) return res.status(404).json({ error: 'Note not found' });
      if (existing.coach_id !== user.id && user.role !== 'Administrator') {
        return res.status(403).json({ error: 'Only the original author can delete this note' });
      }

      await db.delete(coach_notes).where(eq(coach_notes.id, id));
      res.json({ success: true });
    } catch (error) {
      logger.error({ error, id: req.params.id }, 'Failed to delete coach note');
      res.status(500).json({ error: 'Failed to delete note' });
    }
  });

  // ===== Permission Management Routes =====

  // GET /api/permissions - fetch all role permissions (admin only)
  app.get("/api/permissions", authenticateToken, requireRole('Administrator'), async (req: Request, res: Response) => {
    try {
      const allPerms = await db.select().from(role_permissions);
      res.json(allPerms);
    } catch (error) {
      logger.error({ error }, 'Failed to fetch permissions');
      res.status(500).json({ error: 'Failed to fetch permissions' });
    }
  });

  // GET /api/permissions/me - fetch permissions for current user's role
  app.get("/api/permissions/me", authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthUser;
      if (user.role === 'Administrator') {
        const allFeaturePerms = PERMISSION_FEATURES.map(f => ({ role: 'Administrator', feature: f, can_view: true, can_modify: true, can_delete: true }));
        return res.json(allFeaturePerms);
      }
      const myPerms = await db.select().from(role_permissions).where(eq(role_permissions.role, user.role));
      res.json(myPerms);
    } catch (error) {
      logger.error({ error }, 'Failed to fetch user permissions');
      res.status(500).json({ error: 'Failed to fetch permissions' });
    }
  });

  // PUT /api/permissions - bulk save permissions (admin only)
  app.put("/api/permissions", authenticateToken, requireRole('Administrator'), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthUser;
      const { permissions } = req.body;
      if (!Array.isArray(permissions)) {
        return res.status(400).json({ error: 'permissions must be an array' });
      }

      for (const perm of permissions) {
        if (!perm.role || !perm.feature) continue;
        if (perm.role === 'Administrator') continue;
        if (!CONFIGURABLE_ROLES.includes(perm.role as any)) continue;
        if (!PERMISSION_FEATURES.includes(perm.feature as any)) continue;

        const canView = perm.can_view ?? false;
        const canModify = canView ? (perm.can_modify ?? false) : false;
        const canDelete = canView ? (perm.can_delete ?? false) : false;

        const [existing] = await db.select().from(role_permissions)
          .where(and(eq(role_permissions.role, perm.role), eq(role_permissions.feature, perm.feature)));

        if (existing) {
          await db.update(role_permissions)
            .set({ can_view: canView, can_modify: canModify, can_delete: canDelete, updated_at: new Date(), updated_by: user.id })
            .where(eq(role_permissions.id, existing.id));
        } else {
          await db.insert(role_permissions).values({
            role: perm.role,
            feature: perm.feature,
            can_view: canView,
            can_modify: canModify,
            can_delete: canDelete,
            updated_by: user.id,
          });
        }
      }

      const allPerms = await db.select().from(role_permissions);
      res.json({ success: true, permissions: allPerms });
    } catch (error) {
      logger.error({ error }, 'Failed to save permissions');
      res.status(500).json({ error: 'Failed to save permissions' });
    }
  });

  // POST /api/permissions/seed - seed missing default permissions (admin only)
  app.post("/api/permissions/seed", authenticateToken, requireRole('Administrator'), async (req: Request, res: Response) => {
    try {
      await ensureDefaultPermissions();
      const allPerms = await db.select().from(role_permissions);
      res.json({ success: true, count: allPerms.length });
    } catch (error) {
      logger.error({ error }, 'Failed to seed permissions');
      res.status(500).json({ error: 'Failed to seed permissions' });
    }
  });

  // ============ Video Library Endpoints ============

  // List all videos (optionally filter by source/status)
  app.get("/api/videos", authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthUser;
      const { source, status, template_id, template_step_id } = req.query as { source?: string; status?: string; template_id?: string; template_step_id?: string };

      // Guardians may only read videos for templates that one of their linked
      // scoopers currently has a development goal from.
      if (user.role === 'Guardian') {
        if (!template_id && !template_step_id) {
          return res.status(403).json({ error: 'Guardians may only request videos by template_id or template_step_id' });
        }
        let templateIdForCheck: string | null = null;
        if (template_id) {
          templateIdForCheck = template_id;
        } else if (template_step_id) {
          const [step] = await db
            .select({ template_id: goal_template_steps.template_id })
            .from(goal_template_steps)
            .where(eq(goal_template_steps.id, template_step_id))
            .limit(1);
          templateIdForCheck = step?.template_id ?? null;
        }
        if (!templateIdForCheck) {
          return res.json([]);
        }
        const rels = await db.select().from(guardian_relationships)
          .where(eq(guardian_relationships.guardian_id, user.id));
        const scooperIds = rels.map(r => r.scooper_id);
        if (scooperIds.length === 0) {
          return res.json([]);
        }
        const matchingGoals = await db
          .select({ id: development_goals.id })
          .from(development_goals)
          .where(and(
            eq(development_goals.template_id, templateIdForCheck),
            inArray(development_goals.employee_id, scooperIds),
            eq(development_goals.status, 'active')
          ))
          .limit(1);
        if (matchingGoals.length === 0) {
          return res.json([]);
        }
      }

      if (template_step_id) {
        const rows = await db
          .select({
            id: videos.id,
            title: videos.title,
            description: videos.description,
            youtube_url: videos.youtube_url,
            source: videos.source,
            status: videos.status,
            created_by: videos.created_by,
            created_at: videos.created_at,
            display_order: goal_template_step_videos.display_order,
            link_id: goal_template_step_videos.id,
          })
          .from(goal_template_step_videos)
          .innerJoin(videos, eq(goal_template_step_videos.video_id, videos.id))
          .where(and(
            eq(goal_template_step_videos.template_step_id, template_step_id),
            eq(videos.status, 'active')
          ))
          .orderBy(goal_template_step_videos.display_order, videos.created_at);
        return res.json(rows);
      }

      if (template_id) {
        const rows = await db
          .select({
            id: videos.id,
            title: videos.title,
            description: videos.description,
            youtube_url: videos.youtube_url,
            source: videos.source,
            status: videos.status,
            created_by: videos.created_by,
            created_at: videos.created_at,
            display_order: goal_template_videos.display_order,
            link_id: goal_template_videos.id,
          })
          .from(goal_template_videos)
          .innerJoin(videos, eq(goal_template_videos.video_id, videos.id))
          .where(and(
            eq(goal_template_videos.template_id, template_id),
            eq(videos.status, 'active')
          ))
          .orderBy(goal_template_videos.display_order, videos.created_at);
        return res.json(rows);
      }

      const conditions: any[] = [];
      if (source) conditions.push(eq(videos.source, source));
      if (status) conditions.push(eq(videos.status, status));

      const rows = conditions.length
        ? await db.select().from(videos).where(and(...conditions)).orderBy(desc(videos.created_at))
        : await db.select().from(videos).orderBy(desc(videos.created_at));
      res.json(rows);
    } catch (error) {
      logger.error({ error }, 'Failed to fetch videos');
      res.status(500).json({ error: 'Failed to fetch videos' });
    }
  });

  // Create a video. Admins create golden_scoop or employer; coaches create employer only.
  app.post("/api/videos", authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthUser;
      const allowedRoles = ['Administrator', 'Job Coach'];
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      const parsed = insertVideoSchema.safeParse({
        ...req.body,
        created_by: user.id,
        source: req.body.source || (user.role === 'Administrator' ? 'golden_scoop' : 'employer'),
      });
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid video data', details: parsed.error.errors });
      }

      // Non-admins cannot create golden_scoop videos
      if (user.role !== 'Administrator' && parsed.data.source === 'golden_scoop') {
        return res.status(403).json({ error: 'Only Administrators can add Golden Scoop videos' });
      }

      const [created] = await db.insert(videos).values(parsed.data).returning();

      // Optionally attach to a template (and/or template step) in the same call
      const { template_id, template_step_id, display_order } = req.body as { template_id?: string; template_step_id?: string; display_order?: number };
      if (template_id) {
        await db.insert(goal_template_videos).values({
          video_id: created.id,
          template_id,
          display_order: display_order ?? 0,
        }).onConflictDoNothing();
      }
      if (template_step_id) {
        await db.insert(goal_template_step_videos).values({
          video_id: created.id,
          template_step_id,
          display_order: display_order ?? 0,
        }).onConflictDoNothing();
      }

      res.json(created);
    } catch (error) {
      logger.error({ error, body: req.body }, 'Failed to create video');
      res.status(500).json({ error: 'Failed to create video' });
    }
  });

  // Update a video
  app.put("/api/videos/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthUser;
      const id = req.params.id;

      const [existing] = await db.select().from(videos).where(eq(videos.id, id)).limit(1);
      if (!existing) return res.status(404).json({ error: 'Video not found' });

      // Authorization: Admin can edit anything; creator can edit their own employer videos
      if (user.role !== 'Administrator' && existing.created_by !== user.id) {
        return res.status(403).json({ error: 'Not authorized to edit this video' });
      }

      const parsed = updateVideoSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid video data', details: parsed.error.flatten() });
      }
      const updates: any = {};
      ['title', 'description', 'youtube_url', 'status'].forEach((f) => {
        if ((parsed.data as any)[f] !== undefined) updates[f] = (parsed.data as any)[f];
      });
      if (user.role === 'Administrator' && (parsed.data as any).source) updates.source = (parsed.data as any).source;
      updates.updated_at = new Date();

      const [updated] = await db.update(videos).set(updates).where(eq(videos.id, id)).returning();
      res.json(updated);
    } catch (error) {
      logger.error({ error, id: req.params.id }, 'Failed to update video');
      res.status(500).json({ error: 'Failed to update video' });
    }
  });

  // Archive a video (soft delete)
  app.delete("/api/videos/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthUser;
      const id = req.params.id;
      const [existing] = await db.select().from(videos).where(eq(videos.id, id)).limit(1);
      if (!existing) return res.status(404).json({ error: 'Video not found' });
      if (user.role !== 'Administrator' && existing.created_by !== user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      await db.update(videos).set({ status: 'archived', updated_at: new Date() }).where(eq(videos.id, id));
      res.json({ success: true });
    } catch (error) {
      logger.error({ error, id: req.params.id }, 'Failed to archive video');
      res.status(500).json({ error: 'Failed to archive video' });
    }
  });

  // Attach an existing video to a template
  app.post("/api/goal-templates/:templateId/videos", authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthUser;
      const allowedRoles = ['Administrator', 'Job Coach'];
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      const templateId = req.params.templateId;
      const { video_id, display_order } = req.body as { video_id: string; display_order?: number };
      if (!video_id) return res.status(400).json({ error: 'video_id required' });

      // Coaches can only attach employer videos that they created
      if (user.role !== 'Administrator') {
        const [video] = await db.select().from(videos).where(eq(videos.id, video_id)).limit(1);
        if (!video) return res.status(404).json({ error: 'Video not found' });
        if (video.source !== 'employer' || video.created_by !== user.id) {
          return res.status(403).json({ error: 'You can only attach your own employer videos' });
        }
      }

      const [link] = await db.insert(goal_template_videos).values({
        template_id: templateId,
        video_id,
        display_order: display_order ?? 0,
      }).onConflictDoNothing().returning();
      res.json(link ?? { success: true });
    } catch (error) {
      logger.error({ error }, 'Failed to attach video');
      res.status(500).json({ error: 'Failed to attach video to template' });
    }
  });

  // Detach a video from a template
  app.delete("/api/goal-templates/:templateId/videos/:videoId", authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthUser;
      const allowedRoles = ['Administrator', 'Job Coach'];
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      const { templateId, videoId } = req.params;

      // Authorization: Admins can detach any link. Non-admins can only detach
      // employer videos they themselves created — never Golden Scoop or other
      // coaches' employer videos.
      if (user.role !== 'Administrator') {
        const [video] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
        if (!video) return res.status(404).json({ error: 'Video not found' });
        if (video.source !== 'employer' || video.created_by !== user.id) {
          return res.status(403).json({ error: 'Only the video creator can detach employer videos; Golden Scoop videos require an Administrator' });
        }
      }

      await db.delete(goal_template_videos).where(and(
        eq(goal_template_videos.template_id, templateId),
        eq(goal_template_videos.video_id, videoId),
      ));
      res.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Failed to detach video');
      res.status(500).json({ error: 'Failed to detach video from template' });
    }
  });

  // Attach an existing video to a template step
  app.post("/api/goal-template-steps/:stepId/videos", authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthUser;
      const allowedRoles = ['Administrator', 'Job Coach'];
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      const stepId = req.params.stepId;
      const { video_id, display_order } = req.body as { video_id: string; display_order?: number };
      if (!video_id) return res.status(400).json({ error: 'video_id required' });

      if (user.role !== 'Administrator') {
        const [video] = await db.select().from(videos).where(eq(videos.id, video_id)).limit(1);
        if (!video) return res.status(404).json({ error: 'Video not found' });
        if (video.source !== 'employer' || video.created_by !== user.id) {
          return res.status(403).json({ error: 'You can only attach your own employer videos' });
        }
      }

      const [link] = await db.insert(goal_template_step_videos).values({
        template_step_id: stepId,
        video_id,
        display_order: display_order ?? 0,
      }).onConflictDoNothing().returning();
      res.json(link ?? { success: true });
    } catch (error) {
      logger.error({ error }, 'Failed to attach video to template step');
      res.status(500).json({ error: 'Failed to attach video to template step' });
    }
  });

  // Detach a video from a template step
  app.delete("/api/goal-template-steps/:stepId/videos/:videoId", authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthUser;
      const allowedRoles = ['Administrator', 'Job Coach'];
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      const { stepId, videoId } = req.params;

      if (user.role !== 'Administrator') {
        const [video] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
        if (!video) return res.status(404).json({ error: 'Video not found' });
        if (video.source !== 'employer' || video.created_by !== user.id) {
          return res.status(403).json({ error: 'Only the video creator can detach employer videos; Golden Scoop videos require an Administrator' });
        }
      }

      await db.delete(goal_template_step_videos).where(and(
        eq(goal_template_step_videos.template_step_id, stepId),
        eq(goal_template_step_videos.video_id, videoId),
      ));
      res.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Failed to detach video from template step');
      res.status(500).json({ error: 'Failed to detach video from template step' });
    }
  });

  // ========== Employee Reviews Endpoints ==========

  app.get("/api/employees/:employeeId/reviews", authenticateToken, requirePermission('employee_reviews', 'can_view'), async (req: Request, res: Response) => {
    try {
      const { employeeId } = req.params;
      const user = (req as any).user as AuthUser;

      // Guardian role has no access to reviews
      if (user.role === 'Guardian') return res.status(403).json({ error: 'Access denied' });

      const reviews = await db.select().from(employee_reviews)
        .where(eq(employee_reviews.employee_id, employeeId))
        .orderBy(desc(employee_reviews.created_at));

      const reviewerIds = Array.from(new Set(reviews.map(r => r.reviewer_id).filter(Boolean))) as string[];
      let reviewerMap: Record<string, string> = {};
      if (reviewerIds.length > 0) {
        const reviewers = await db.select({ id: employees.id, first_name: employees.first_name, last_name: employees.last_name })
          .from(employees).where(inArray(employees.id, reviewerIds));
        reviewerMap = Object.fromEntries(reviewers.map(e => [e.id, `${e.first_name || ''} ${e.last_name || ''}`.trim()]));
      }

      const enriched = reviews.map(r => ({ ...r, reviewer_name: r.reviewer_id ? (reviewerMap[r.reviewer_id] || 'Unknown') : null }));
      res.json(enriched);
    } catch (error) {
      logger.error({ error, employeeId: req.params.employeeId }, 'Failed to fetch reviews');
      res.status(500).json({ error: 'Failed to fetch reviews' });
    }
  });

  app.post("/api/employees/:employeeId/reviews", authenticateToken, requirePermission('employee_reviews', 'can_modify'), async (req: Request, res: Response) => {
    try {
      const { employeeId } = req.params;
      const user = (req as any).user as AuthUser;

      if (user.role === 'Guardian' || user.role === 'Super Scooper') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const reviewData = { ...req.body, employee_id: employeeId, reviewer_id: user.id };
      const parsed = insertEmployeeReviewSchema.parse(reviewData);
      const [review] = await db.insert(employee_reviews).values(parsed).returning();

      logger.info({ reviewId: review.id, reviewerId: user.id, employeeId }, 'Employee review created');
      const reviewer_name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown';
      res.json({ ...review, reviewer_name });
    } catch (error) {
      logger.error({ error }, 'Failed to create review');
      res.status(500).json({ error: 'Failed to create review' });
    }
  });

  app.patch("/api/reviews/:id", authenticateToken, requirePermission('employee_reviews', 'can_modify'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = (req as any).user as AuthUser;

      const [existing] = await db.select().from(employee_reviews).where(eq(employee_reviews.id, id));
      if (!existing) return res.status(404).json({ error: 'Review not found' });
      if (existing.reviewer_id !== user.id && user.role !== 'Administrator') {
        return res.status(403).json({ error: 'Only the original reviewer or an Administrator can edit this review' });
      }

      const { review_type, q1, q2, q3, q4, q5, q6 } = req.body;
      const [updated] = await db.update(employee_reviews)
        .set({ review_type, q1, q2, q3, q4, q5, q6, updated_at: new Date() })
        .where(eq(employee_reviews.id, id))
        .returning();

      logger.info({ reviewId: id, editorId: user.id }, 'Employee review updated');
      res.json(updated);
    } catch (error) {
      logger.error({ error }, 'Failed to update review');
      res.status(500).json({ error: 'Failed to update review' });
    }
  });

  app.delete("/api/reviews/:id", authenticateToken, requirePermission('employee_reviews', 'can_delete'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = (req as any).user as AuthUser;

      const [existing] = await db.select().from(employee_reviews).where(eq(employee_reviews.id, id));
      if (!existing) return res.status(404).json({ error: 'Review not found' });
      if (existing.reviewer_id !== user.id && user.role !== 'Administrator') {
        return res.status(403).json({ error: 'Only the original reviewer or an Administrator can delete this review' });
      }

      await db.delete(employee_reviews).where(eq(employee_reviews.id, id));
      logger.info({ reviewId: id, deletedBy: user.id }, 'Employee review deleted');
      res.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Failed to delete review');
      res.status(500).json({ error: 'Failed to delete review' });
    }
  });

  // Admin-only CSV export
  app.get("/api/employees/:employeeId/reviews/export", authenticateToken, requireRole('Administrator'), async (req: Request, res: Response) => {
    try {
      const { employeeId } = req.params;

      const [emp] = await db.select().from(employees).where(eq(employees.id, employeeId)).limit(1);
      const empName = emp ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() : employeeId;

      const reviews = await db.select().from(employee_reviews)
        .where(eq(employee_reviews.employee_id, employeeId))
        .orderBy(desc(employee_reviews.created_at));

      const reviewerIds = Array.from(new Set(reviews.map(r => r.reviewer_id).filter(Boolean))) as string[];
      let reviewerMap: Record<string, string> = {};
      if (reviewerIds.length > 0) {
        const reviewers = await db.select({ id: employees.id, first_name: employees.first_name, last_name: employees.last_name })
          .from(employees).where(inArray(employees.id, reviewerIds));
        reviewerMap = Object.fromEntries(reviewers.map(e => [e.id, `${e.first_name || ''} ${e.last_name || ''}`.trim()]));
      }

      const escape = (v: string | null | undefined) => `"${(v || '').replace(/"/g, '""')}"`;

      const headers = ['Employee', 'Review Type', 'Date', 'Reviewer',
        'Q1: Greatest Strengths', 'Q2: Growth Areas', 'Q3: Goal Progress',
        'Q4: Teamwork & Attitude', 'Q5: Achievements', 'Q6: Next Period Goals'];

      const rows = reviews.map(r => [
        escape(empName),
        escape(r.review_type === 'mid_year' ? 'Mid-Year' : 'Annual'),
        escape(r.created_at ? new Date(r.created_at).toLocaleDateString() : ''),
        escape(r.reviewer_id ? (reviewerMap[r.reviewer_id] || 'Unknown') : ''),
        escape(r.q1), escape(r.q2), escape(r.q3), escape(r.q4), escape(r.q5), escape(r.q6),
      ].join(','));

      const csv = [headers.join(','), ...rows].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="reviews-${empName.replace(/\s+/g, '-')}.csv"`);
      logger.info({ employeeId, exportedBy: (req as any).user.id, count: reviews.length }, 'Reviews exported to CSV');
      res.send(csv);
    } catch (error) {
      logger.error({ error }, 'Failed to export reviews');
      res.status(500).json({ error: 'Failed to export reviews' });
    }
  });

  // ===== Forms & Reviews =====
  // Templates are intentionally admin-only in Phase 1. Response access is
  // separately scoped to the employee relationship and form permissions.
  const hydrateFormTemplate = async (templateId: string) => {
    const [template] = await db.select().from(form_templates).where(eq(form_templates.id, templateId)).limit(1);
    if (!template) return null;
    const sections = await db.select().from(form_sections)
      .where(eq(form_sections.template_id, templateId))
      .orderBy(form_sections.sort_order);
    const questions = await db.select().from(form_questions)
      .where(eq(form_questions.template_id, templateId))
      .orderBy(form_questions.sort_order);
    return { ...template, sections: sections.map(section => ({
      ...section,
      questions: questions.filter(question => question.section_id === section.id),
    })), questions };
  };

  const validateQuestionValue = (question: any, value: unknown): string | null => {
    if (value === null || value === undefined || value === '') return null;
    if (question.question_type !== 'scale') return null;
    const config = (question.config_json || {}) as Record<string, unknown>;
    const min = Number.isFinite(Number(config.min)) ? Number(config.min) : 1;
    const max = Number.isFinite(Number(config.max)) ? Number(config.max) : 5;
    const rating = Number(value);
    if (!Number.isInteger(rating) || rating < min || rating > max) {
      return `"${question.prompt}" must be a whole-number rating from ${min} to ${max}`;
    }
    return null;
  };

  const templateAllowsFilling = (template: any, role: string) => {
    const settings = (template.settings_json || {}) as Record<string, unknown>;
    const allowedRoles = Array.isArray(settings.allowed_fill_roles)
      ? settings.allowed_fill_roles as string[]
      : ['Administrator'];
    return role === 'Administrator' || allowedRoles.includes(role);
  };

  const canViewTemplateResponse = async (user: AuthUser, employeeId: string, template: any) => {
    if (template?.form_type === 'coach_checkin') {
      return (user.role === 'Administrator' || user.role === 'Job Coach') && await canAccessScooper(user, employeeId);
    }
    return canViewScooperForms(user, employeeId);
  };

  const canFillTemplateResponse = async (user: AuthUser, employeeId: string, template: any) => {
    if (template?.form_type === 'coach_checkin') {
      return (user.role === 'Administrator' || user.role === 'Job Coach') && await canAccessScooper(user, employeeId);
    }
    return canModifyScooperForms(user, employeeId);
  };

  // Profile workflows can discover only the active template they are allowed
  // to use. Template administration remains restricted to Administrators.
  app.get("/api/form-templates/by-type/:formType", authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthUser;
      const employeeId = typeof req.query.employee_id === 'string' ? req.query.employee_id : '';
      if (!employeeId) return res.status(400).json({ error: 'employee_id is required' });
      const [template] = await db.select().from(form_templates)
        .where(and(eq(form_templates.form_type, req.params.formType), eq(form_templates.status, 'active')))
        .orderBy(desc(form_templates.updated_at))
        .limit(1);
      if (!template) return res.status(404).json({ error: 'Active form template not found' });
       if (!await canViewTemplateResponse(user, employeeId, template)) return res.status(403).json({ error: 'You cannot access this form template' });
      res.json(await hydrateFormTemplate(template.id));
    } catch (error) {
      logger.error({ error }, 'Failed to load profile form template');
      res.status(500).json({ error: 'Failed to load form template' });
    }
  });

  app.get("/api/form-templates", authenticateToken, requireRole('Administrator'), async (req: Request, res: Response) => {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const templates = await db.select().from(form_templates)
        .where(status ? eq(form_templates.status, status) : undefined)
        .orderBy(desc(form_templates.updated_at));
      const result = await Promise.all(templates.map(template => hydrateFormTemplate(template.id)));
      res.json(result.filter(Boolean));
    } catch (error) {
      logger.error({ error }, 'Failed to load form templates');
      res.status(500).json({ error: 'Failed to load form templates' });
    }
  });

  app.get("/api/form-templates/:id", authenticateToken, requireRole('Administrator'), async (req: Request, res: Response) => {
    try {
      const template = await hydrateFormTemplate(req.params.id);
      if (!template) return res.status(404).json({ error: 'Form template not found' });
      res.json(template);
    } catch (error) {
      logger.error({ error }, 'Failed to load form template');
      res.status(500).json({ error: 'Failed to load form template' });
    }
  });

  app.post("/api/form-templates", authenticateToken, requireRole('Administrator'), async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const parsed = insertFormTemplateSchema.safeParse({
        name: body.name,
        description: body.description || null,
        form_type: body.form_type || 'custom',
        status: body.status || 'active',
        version: 1,
        settings_json: body.settings_json || { allowed_fill_roles: ['Administrator'], lock_on_submit: true },
        created_by: (req as any).user.id,
      });
      if (!parsed.success) return res.status(400).json({ error: 'Invalid form template', details: parsed.error.flatten() });
      const [created] = await db.insert(form_templates).values(parsed.data).returning();
      res.status(201).json(await hydrateFormTemplate(created.id));
    } catch (error) {
      logger.error({ error }, 'Failed to create form template');
      res.status(500).json({ error: 'Failed to create form template' });
    }
  });

  app.put("/api/form-templates/:id", authenticateToken, requireRole('Administrator'), async (req: Request, res: Response) => {
    try {
      const templateId = req.params.id;
      const [existing] = await db.select().from(form_templates).where(eq(form_templates.id, templateId)).limit(1);
      if (!existing) return res.status(404).json({ error: 'Form template not found' });
      const body = req.body || {};
      const incomingSections = Array.isArray(body.sections) ? body.sections : [];
      const incomingQuestions = Array.isArray(body.questions)
        ? body.questions
        : incomingSections.flatMap((section: any) => (section.questions || []).map((question: any) => ({ ...question, section_id: question.section_id || section.id })));

      await db.transaction(async (tx) => {
        await tx.update(form_templates).set({
          name: body.name ?? existing.name,
          description: body.description ?? null,
          form_type: body.form_type ?? existing.form_type,
          status: body.status ?? existing.status,
          settings_json: body.settings_json ?? existing.settings_json,
          version: existing.version + 1,
          updated_at: new Date(),
        }).where(eq(form_templates.id, templateId));

        const currentSections = await tx.select().from(form_sections).where(eq(form_sections.template_id, templateId));
        const currentQuestions = await tx.select().from(form_questions).where(eq(form_questions.template_id, templateId));
        const seenSectionIds = new Set<string>();
        const sectionIdMap = new Map<string, string>();

        for (const [index, section] of incomingSections.entries()) {
          const stableId = typeof section.id === 'string' && currentSections.some(row => row.id === section.id) ? section.id : null;
          const values = {
            template_id: templateId,
            title: String(section.title || `Section ${index + 1}`).trim(),
            sort_order: Number.isFinite(Number(section.sort_order)) ? Number(section.sort_order) : index,
            status: section.status || 'active',
            updated_at: new Date(),
          };
          if (stableId) {
            await tx.update(form_sections).set(values).where(eq(form_sections.id, stableId));
            seenSectionIds.add(stableId);
            sectionIdMap.set(String(section.id), stableId);
          } else {
            const [createdSection] = await tx.insert(form_sections).values(values).returning();
            seenSectionIds.add(createdSection.id);
            if (section.id) sectionIdMap.set(String(section.id), createdSection.id);
          }
        }
        for (const section of currentSections) {
          if (!seenSectionIds.has(section.id)) {
            await tx.update(form_sections).set({ status: 'archived', updated_at: new Date() }).where(eq(form_sections.id, section.id));
          }
        }

        const seenQuestionIds = new Set<string>();
        for (const [index, question] of incomingQuestions.entries()) {
          const stableId = typeof question.id === 'string' && currentQuestions.some(row => row.id === question.id) ? question.id : null;
          const sectionId = question.section_id ? (sectionIdMap.get(String(question.section_id)) || String(question.section_id)) : null;
          // An omitted/archived section cannot retain active questions. Skip it
          // here; the cleanup loop below marks any prior question inactive.
          if (sectionId && !seenSectionIds.has(sectionId)) continue;
          const stableKey = String(question.stable_key || question.id || `question_${index + 1}`).trim();
          const values = {
            template_id: templateId,
            section_id: sectionId,
            stable_key: stableKey,
            prompt: String(question.prompt || '').trim(),
            help_text: question.help_text || null,
            question_type: question.question_type || 'free_text',
            config_json: question.config_json || {},
            sort_order: Number.isFinite(Number(question.sort_order)) ? Number(question.sort_order) : index,
            status: question.status || 'active',
            updated_at: new Date(),
          };
          if (!values.prompt) continue;
          if (stableId) {
            await tx.update(form_questions).set(values).where(eq(form_questions.id, stableId));
            seenQuestionIds.add(stableId);
          } else {
            const [createdQuestion] = await tx.insert(form_questions).values(values).returning();
            seenQuestionIds.add(createdQuestion.id);
          }
        }
        for (const question of currentQuestions) {
          if (!seenQuestionIds.has(question.id)) {
            await tx.update(form_questions).set({ status: 'inactive', updated_at: new Date() }).where(eq(form_questions.id, question.id));
          }
        }
      });

      res.json(await hydrateFormTemplate(templateId));
    } catch (error) {
      logger.error({ error }, 'Failed to update form template');
      res.status(500).json({ error: 'Failed to update form template' });
    }
  });

  app.post("/api/form-templates/:id/duplicate", authenticateToken, requireRole('Administrator'), async (req: Request, res: Response) => {
    try {
      const source = await hydrateFormTemplate(req.params.id);
      if (!source) return res.status(404).json({ error: 'Form template not found' });
      const [created] = await db.insert(form_templates).values({
        name: `${source.name} (Copy)`,
        description: source.description,
        form_type: source.form_type,
        status: 'active',
        version: 1,
        settings_json: source.settings_json,
        created_by: (req as any).user.id,
      }).returning();
      const sectionIds = new Map<string, string>();
      for (const section of source.sections) {
        const [newSection] = await db.insert(form_sections).values({
          template_id: created.id,
          title: section.title,
          sort_order: section.sort_order,
          status: section.status,
        }).returning();
        sectionIds.set(section.id, newSection.id);
      }
      for (const question of source.questions) {
        await db.insert(form_questions).values({
          template_id: created.id,
          section_id: question.section_id ? sectionIds.get(question.section_id) || null : null,
          stable_key: question.stable_key,
          prompt: question.prompt,
          help_text: question.help_text,
          question_type: question.question_type,
          config_json: question.config_json,
          sort_order: question.sort_order,
          status: question.status,
        });
      }
      res.status(201).json(await hydrateFormTemplate(created.id));
    } catch (error) {
      logger.error({ error }, 'Failed to duplicate form template');
      res.status(500).json({ error: 'Failed to duplicate form template' });
    }
  });

  app.delete("/api/form-templates/:id", authenticateToken, requireRole('Administrator'), async (req: Request, res: Response) => {
    try {
      const [updated] = await db.update(form_templates)
        .set({ status: 'archived', updated_at: new Date() })
        .where(eq(form_templates.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ error: 'Form template not found' });
      res.json(await hydrateFormTemplate(updated.id));
    } catch (error) {
      logger.error({ error }, 'Failed to archive form template');
      res.status(500).json({ error: 'Failed to archive form template' });
    }
  });

  const responsePayload = async (responseId: string) => {
    const [responseSet] = await db.select().from(form_response_sets).where(eq(form_response_sets.id, responseId)).limit(1);
    if (!responseSet) return null;
    const template = responseSet.template_snapshot_json || await hydrateFormTemplate(responseSet.template_id);
    const answers = await db.select().from(form_answers).where(eq(form_answers.response_set_id, responseId));
    return { ...responseSet, template, answers };
  };

  app.get("/api/form-responses/:responseId", authenticateToken, async (req: Request, res: Response) => {
    try {
      const [responseSet] = await db.select().from(form_response_sets).where(eq(form_response_sets.id, req.params.responseId)).limit(1);
      const user = (req as any).user as AuthUser;
      if (!responseSet) return res.status(404).json({ error: 'Form response not found' });
       const responseTemplate: any = responseSet.template_snapshot_json || await hydrateFormTemplate(responseSet.template_id);
       if (!await canViewTemplateResponse(user, responseSet.employee_id, responseTemplate)) return res.status(403).json({ error: 'You cannot view this form response' });
      res.json(await responsePayload(responseSet.id));
    } catch (error) {
      logger.error({ error }, 'Failed to load form response');
      res.status(500).json({ error: 'Failed to load form response' });
    }
  });

  app.get(["/api/employees/:employeeId/form-responses", "/api/scoopers/:scooperId/form-responses"], authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthUser;
      const employeeId = req.params.employeeId || req.params.scooperId;
      if (!await canViewScooperForms(user, employeeId)) return res.status(403).json({ error: 'You cannot view these form responses' });
      const filters = [eq(form_response_sets.employee_id, employeeId)];
      if (typeof req.query.template_id === 'string') filters.push(eq(form_response_sets.template_id, req.query.template_id));
      if (typeof req.query.cycle_label === 'string') filters.push(eq(form_response_sets.cycle_label, req.query.cycle_label));
      const responseSets = await db.select().from(form_response_sets).where(and(...filters)).orderBy(desc(form_response_sets.updated_at));
      const hydrated = await Promise.all(responseSets.map(response => responsePayload(response.id)));
      res.json(hydrated.filter(Boolean));
    } catch (error) {
      logger.error({ error }, 'Failed to load employee form responses');
      res.status(500).json({ error: 'Failed to load employee form responses' });
    }
  });

  app.post(["/api/form-responses", "/api/form-response-sets"], authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthUser;
      const { template_id, employee_id, cycle_label } = req.body || {};
      if (!template_id || !employee_id) return res.status(400).json({ error: 'template_id and employee_id are required' });
      const [template] = await db.select().from(form_templates).where(eq(form_templates.id, template_id)).limit(1);
      if (!template || template.status !== 'active') return res.status(404).json({ error: 'Active form template not found' });
       if (!await canFillTemplateResponse(user, employee_id, template)) return res.status(403).json({ error: 'You cannot fill forms for this employee' });
      if (!templateAllowsFilling(template, user.role)) return res.status(403).json({ error: 'Your role is not allowed to fill this form' });
      const normalizedCycleLabel = typeof cycle_label === 'string' && cycle_label.trim() ? cycle_label.trim() : null;
      const existingFilters = [
        eq(form_response_sets.template_id, template_id),
        eq(form_response_sets.employee_id, employee_id),
        normalizedCycleLabel ? eq(form_response_sets.cycle_label, normalizedCycleLabel) : isNull(form_response_sets.cycle_label),
      ];
      const [existing] = await db.select().from(form_response_sets).where(and(...existingFilters)).limit(1);
      if (existing) return res.json(await responsePayload(existing.id));
      const templateSnapshot = await hydrateFormTemplate(template.id);
      const [created] = await db.insert(form_response_sets).values({
        template_id,
        template_version: template.version,
        employee_id,
        cycle_label: normalizedCycleLabel,
        status: 'draft',
        template_snapshot_json: templateSnapshot,
      }).returning();
      res.status(201).json(await responsePayload(created.id));
    } catch (error) {
      logger.error({ error }, 'Failed to create form response');
      res.status(500).json({ error: 'Failed to create form response' });
    }
  });

  app.put(["/api/form-responses/:responseId", "/api/form-response-sets/:responseId"], authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthUser;
      const [responseSet] = await db.select().from(form_response_sets).where(eq(form_response_sets.id, req.params.responseId)).limit(1);
      if (!responseSet) return res.status(404).json({ error: 'Form response not found' });
      const editingSubmitted = responseSet.status === 'submitted' && user.role === 'Administrator';
      if (responseSet.status === 'submitted' && !editingSubmitted) return res.status(409).json({ error: 'Submitted responses are locked' });
      const responseTemplate: any = responseSet.template_snapshot_json || await hydrateFormTemplate(responseSet.template_id);
       if (!await canFillTemplateResponse(user, responseSet.employee_id, responseTemplate)) return res.status(403).json({ error: 'You cannot edit this form response' });
      if (!responseTemplate || !templateAllowsFilling(responseTemplate, user.role)) return res.status(403).json({ error: 'Your role is not allowed to fill this form' });
      // Drafts are versioned records: validate and snapshot against the template
      // captured at creation, even if the reusable template has since changed.
      const snapshotQuestions: any[] = Array.isArray(responseTemplate.questions)
        ? responseTemplate.questions
        : [];
       const questionMap = new Map(snapshotQuestions.map((question: any) => [question.id, question]));
      const incomingAnswers = Array.isArray(req.body?.answers) ? req.body.answers : [];
       const existingAnswers = await db.select().from(form_answers).where(eq(form_answers.response_set_id, responseSet.id));
       const effectiveAnswers = new Map(existingAnswers.map(answer => [answer.question_id, answer.value_json]));
       for (const answer of incomingAnswers) {
         if (questionMap.has(answer.question_id)) effectiveAnswers.set(answer.question_id, answer.value_json ?? answer.value ?? null);
       }
       const normalizedAnswers = normalizeConditionalAnswers(snapshotQuestions, effectiveAnswers);
       const lookup = normalizedAnswers.lookup;
      for (const answer of incomingAnswers) {
        const question = questionMap.get(answer.question_id);
        if (!question) continue;
         if (!isQuestionVisible(question, lookup)) continue;
        const validationError = validateQuestionValue(question, answer.value_json ?? answer.value ?? null);
        if (validationError) return res.status(400).json({ error: validationError });
      }
      if (editingSubmitted) {
         const missing = missingRequiredQuestionPrompts(snapshotQuestions, effectiveAnswers);
        if (missing.length) return res.status(400).json({ error: 'Complete all required questions before saving', missing });
      }
      const saved = await db.transaction(async (tx) => {
        // This conditional update is both the draft-state check and the row
        // lock. A submission waits for any in-progress save, then scores the
        // answers that save committed; later saves see the submitted state.
        const [draft] = await tx.update(form_response_sets).set({ updated_at: new Date() })
          .where(and(eq(form_response_sets.id, responseSet.id), eq(form_response_sets.status, responseSet.status)))
          .returning();
        if (!draft) return false;
        for (const answer of incomingAnswers) {
          const question = questionMap.get(answer.question_id);
          if (!question) continue;
           if (!isQuestionVisible(question, lookup)) {
             await tx.delete(form_answers).where(and(
               eq(form_answers.response_set_id, responseSet.id),
               eq(form_answers.question_id, question.id),
             ));
             continue;
           }
          const value = answer.value_json ?? answer.value ?? null;
          await tx.insert(form_answers).values({
            response_set_id: responseSet.id,
            question_id: question.id,
            value_json: value,
            snapshot_json: {
              stable_key: question.stable_key,
              prompt: question.prompt,
              help_text: question.help_text,
              question_type: question.question_type,
              config_json: question.config_json,
            },
            answered_by: user.id,
            updated_at: new Date(),
          }).onConflictDoUpdate({
            target: [form_answers.response_set_id, form_answers.question_id],
            set: {
              value_json: value,
              snapshot_json: {
                stable_key: question.stable_key,
                prompt: question.prompt,
                help_text: question.help_text,
                question_type: question.question_type,
                config_json: question.config_json,
              },
              answered_by: user.id,
              updated_at: new Date(),
            },
          });
        }
        if (editingSubmitted && (responseTemplate.form_type === 'mentor_certification' || responseTemplate.form_type === 'shift_lead_certification')) {
          const updatedAnswers = await tx.select().from(form_answers).where(eq(form_answers.response_set_id, responseSet.id));
          const scoredAnswers = updatedAnswers
            .map(answer => String(answer.value_json || '').toLowerCase())
            .filter(value => value === 'yes' || value === 'no');
          const correct = scoredAnswers.filter(value => value === 'yes').length;
          const score = scoredAnswers.length ? Math.round((correct / scoredAnswers.length) * 100) : 0;
          const certificationType = responseTemplate.form_type === 'mentor_certification' ? 'mentor' : 'shift_lead';
          const passingScore = Number((responseTemplate.settings_json || {}).passing_score || (certificationType === 'mentor' ? 84 : 90));
          await tx.update(promotion_certifications).set({
            score,
            passing_score: passingScore,
            passed: score >= passingScore,
          }).where(eq(promotion_certifications.response_set_id, responseSet.id));
        }
        return true;
      });
      if (!saved) return res.status(409).json({ error: 'Submitted responses are locked' });
      res.json(await responsePayload(responseSet.id));
    } catch (error) {
      logger.error({ error }, 'Failed to save form response');
      res.status(500).json({ error: 'Failed to save form response' });
    }
  });

  app.post(["/api/form-responses/:responseId/submit", "/api/form-response-sets/:responseId/submit"], authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthUser;
      const [responseSet] = await db.select().from(form_response_sets).where(eq(form_response_sets.id, req.params.responseId)).limit(1);
      if (!responseSet) return res.status(404).json({ error: 'Form response not found' });
       const responseTemplate: any = responseSet.template_snapshot_json || await hydrateFormTemplate(responseSet.template_id);
       if (!await canViewTemplateResponse(user, responseSet.employee_id, responseTemplate)) return res.status(403).json({ error: 'You cannot access this form response' });
      if (responseSet.status === 'submitted') return res.json(await responsePayload(responseSet.id));
       if (!await canFillTemplateResponse(user, responseSet.employee_id, responseTemplate)) return res.status(403).json({ error: 'You cannot submit this form response' });
      if (!responseTemplate || !templateAllowsFilling(responseTemplate, user.role)) return res.status(403).json({ error: 'Your role is not allowed to fill this form' });
      const questions: any[] = Array.isArray(responseTemplate.questions)
        ? responseTemplate.questions
        : [];
      const questionsById = new Map(questions.map(question => [question.id, question]));
      const submittedResponseId = await db.transaction(async (tx) => {
        // Claim the draft before reading answers. This serializes submit with
        // draft saves and prevents an already-started save from mutating a
        // submitted response after the certification is scored.
        const [submitted] = await tx.update(form_response_sets).set({
          status: 'submitted',
          submitted_by: user.id,
          submitted_at: new Date(),
          updated_at: new Date(),
        }).where(and(eq(form_response_sets.id, responseSet.id), eq(form_response_sets.status, 'draft'))).returning();
        if (!submitted) return null;
         const allAnswers = await tx.select().from(form_answers).where(eq(form_answers.response_set_id, responseSet.id));
         const answersByQuestion = new Map(allAnswers.map(answer => [answer.question_id, answer.value_json]));
         const normalizedAnswers = normalizeConditionalAnswers(questions, answersByQuestion);
         const answers = allAnswers.filter(answer => normalizedAnswers.answers.has(answer.question_id));
         for (const answer of allAnswers) {
           if (!normalizedAnswers.answers.has(answer.question_id)) {
             await tx.delete(form_answers).where(eq(form_answers.id, answer.id));
           }
         }
       const missing = missingRequiredQuestionPrompts(questions, normalizedAnswers.answers);
        if (missing.length) {
          throw Object.assign(new Error('Complete all required questions before submitting'), { status: 400, missing });
        }
        for (const answer of answers) {
          const question = questionsById.get(answer.question_id);
          if (!question) continue;
          await tx.update(form_answers).set({
            snapshot_json: {
              stable_key: question.stable_key,
              prompt: question.prompt,
              help_text: question.help_text,
              question_type: question.question_type,
              options: (question.config_json as any)?.options || [],
              config_json: question.config_json,
              value: answer.value_json,
            },
            updated_at: new Date(),
          }).where(eq(form_answers.id, answer.id));
        }
        const submittedId = submitted.id;

        if (responseTemplate.form_type === 'mentor_certification' || responseTemplate.form_type === 'shift_lead_certification') {
          const scoredAnswers = answers
            .map(answer => String(answer.value_json || '').toLowerCase())
            .filter(value => value === 'yes' || value === 'no');
          const correct = scoredAnswers.filter(value => value === 'yes').length;
          const score = scoredAnswers.length ? Math.round((correct / scoredAnswers.length) * 100) : 0;
          const certificationType = responseTemplate.form_type === 'mentor_certification' ? 'mentor' : 'shift_lead';
          const passingScore = Number((responseTemplate.settings_json || {}).passing_score || (certificationType === 'mentor' ? 84 : 90));
          await tx.insert(promotion_certifications).values({
            employee_id: responseSet.employee_id,
            certification_type: certificationType,
            response_set_id: submittedId,
            date_completed: new Date().toISOString().slice(0, 10),
            score,
            passing_score: passingScore,
            passed: score >= passingScore,
            checklist_results: [],
            certified_by: user.id,
          }).onConflictDoNothing();
        }
        return submittedId;
      });
      if (!submittedResponseId) return res.json(await responsePayload(responseSet.id));
      res.json(await responsePayload(submittedResponseId));
    } catch (error) {
      logger.error({ error }, 'Failed to submit form response');
      if ((error as any)?.status === 400) {
        return res.status(400).json({ error: (error as Error).message, missing: (error as any).missing });
      }
      res.status(500).json({ error: 'Failed to submit form response' });
    }
  });

  await ensureDefaultPermissions();
  await backfillGoalStepTemplateLinks();

  const httpServer = createServer(app);
  return httpServer;
}
