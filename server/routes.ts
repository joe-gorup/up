import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { PassThrough } from "stream";
import { db } from "./db";
import { logger } from "./logger";
import { 
  employees, goal_templates, goal_template_steps,
  development_goals, goal_steps, assessment_sessions, step_progress, assessment_summaries,
  coach_assignments, guardian_relationships, account_invitations, promotion_certifications, coach_checkins,
  insertCoachAssignmentSchema, insertGuardianRelationshipSchema, insertPromotionCertificationSchema, insertCoachCheckinSchema
} from "@shared/schema";
import crypto from "crypto";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { ObjectStorageService } from "./objectStorage";
import multer from "multer";
import csvParser from "csv-parser";
import { 
  hashPassword, comparePassword, generateToken, authenticateToken, requireRole,
  type AuthUser 
} from "./auth";

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
        return res.json(assignedScoopers);
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
        return res.json(relatedScoopers);
      }

      const allEmployees = await db
        .select()
        .from(employees)
        .where(eq(employees.is_active, true))
        .orderBy(employees.email, employees.created_at);
      
      logger.info({ count: allEmployees.length }, 'Employees fetched successfully');
      res.json(allEmployees);
    } catch (error) {
      logger.error({ error }, 'Failed to fetch employees');
      res.status(500).json({ error: 'Failed to fetch employees' });
    }
  });

  app.post("/api/employees", authenticateToken, requireRole('Administrator', 'Shift Lead', 'Assistant Manager'), async (req: Request, res: Response) => {
    try {
      // Check for existing employee with same email to prevent duplicates (only if email provided)
      if (req.body.email && req.body.email.trim() !== '') {
        const existingEmployee = await db.select().from(employees).where(eq(employees.email, req.body.email)).limit(1);
        
        if (existingEmployee.length > 0) {
          return res.status(409).json({ error: 'Employee with this email already exists' });
        }
      }

      const employeeData = { ...req.body };
      
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
      
      const [newEmployee] = await db.insert(employees).values(employeeData).returning();
      logger.info({ employeeId: newEmployee.id, name: `${newEmployee.first_name} ${newEmployee.last_name}` }, 'Employee created successfully');
      
      // Don't return the hashed password
      const { password, ...employeeWithoutPassword } = newEmployee;
      res.json(employeeWithoutPassword);
    } catch (error) {
      logger.error({ error, employeeData: req.body }, 'Failed to create employee');
      res.status(500).json({ error: 'Failed to create employee' });
    }
  });

  app.put("/api/employees/:id", authenticateToken, requireRole('Administrator', 'Shift Lead', 'Assistant Manager'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateData = { ...req.body, updated_at: new Date() };
      
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

      // NOTE: Employee access is now managed entirely via has_system_access flag
      // No separate user accounts needed

      res.json(updatedEmployee);
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
                  'is_required', ${goal_template_steps.is_required}
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
          is_required: step.isRequired
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
      
      // If steps are provided, replace all existing steps
      if (steps && Array.isArray(steps)) {
        // Delete existing steps
        await db.delete(goal_template_steps).where(eq(goal_template_steps.template_id, templateId));
        
        // Insert new steps if any
        if (steps.length > 0) {
          const stepInserts = steps.map((step: any, index: number) => ({
            template_id: templateId,
            step_order: index + 1,
            step_description: step.stepDescription,
            is_required: step.isRequired
          }));
          await db.insert(goal_template_steps).values(stepInserts);
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
                  'step_order', ${goal_steps.step_order},
                  'step_description', ${goal_steps.step_description},
                  'is_required', ${goal_steps.is_required}
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
      
      logger.info({ count: goalsWithSteps.length }, 'Development goals fetched efficiently');
      res.json(goalsWithSteps);
    } catch (error) {
      logger.error({ error }, 'Failed to fetch development goals');
      res.status(500).json({ error: 'Failed to fetch development goals' });
    }
  });

  app.post("/api/development-goals", authenticateToken, requireRole('Administrator'), async (req: Request, res: Response) => {
    try {
      const { steps, ...goalData } = req.body;
      const [newGoal] = await db.insert(development_goals).values(goalData).returning();
      
      if (steps && steps.length > 0) {
        const stepInserts = steps.map((step: any) => ({
          goal_id: newGoal.id,
          step_order: step.step_order || step.stepOrder,
          step_description: step.step_description || step.stepDescription,
          is_required: step.is_required !== undefined ? step.is_required : step.isRequired
        }));
        await db.insert(goal_steps).values(stepInserts);
      }
      
      res.json(newGoal);
    } catch (error) {
      logger.error({ error, goalData: req.body }, 'Failed to create development goal');
      res.status(500).json({ error: 'Failed to create development goal' });
    }
  });

  app.put("/api/development-goals/:id", authenticateToken, requireRole('Administrator'), async (req: Request, res: Response) => {
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
  app.get("/api/step-progress/drafts/:documenterId", async (req: Request, res: Response) => {
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

  app.post("/api/step-progress", authenticateToken, requireRole('Administrator', 'Shift Lead', 'Assistant Manager'), async (req: Request, res: Response) => {
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
  app.post("/api/step-progress/draft", authenticateToken, requireRole('Administrator', 'Shift Lead', 'Assistant Manager'), async (req: Request, res: Response) => {
    try {
      const mappedData = mapProgressDataToDb({ ...req.body, status: 'draft' });
      
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
  app.post("/api/step-progress/submit", authenticateToken, requireRole('Administrator', 'Shift Lead', 'Assistant Manager'), async (req: Request, res: Response) => {
    try {
      const { employee_id, assessment_session_id, date, documenter_user_id } = req.body;
      
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

          // Get all submitted progress for this goal/employee
          const submittedProgress = await db.select().from(step_progress)
            .where(and(
              eq(step_progress.development_goal_id, goalId),
              eq(step_progress.employee_id, employee_id),
              eq(step_progress.status, 'submitted')
            ));

          // Check if all required steps are completed with "correct" outcome
          const requiredSteps = goalSteps.filter(step => step.is_required);
          const correctSubmissions = submittedProgress.filter(p => 
            p.outcome === 'correct' && 
            requiredSteps.some(step => step.id === p.goal_step_id)
          );

          // If all required steps are correct, increment consecutive count
          if (correctSubmissions.length === requiredSteps.length) {
            const [goal] = await db.select().from(development_goals)
              .where(eq(development_goals.id, goalId))
              .limit(1);

            if (goal) {
              const newConsecutive = (goal.consecutive_all_correct || 0) + 1;
              const masteryAchieved = newConsecutive >= 3; // Default mastery criteria

              await db.update(development_goals)
                .set({
                  consecutive_all_correct: newConsecutive,
                  mastery_achieved: masteryAchieved,
                  mastery_date: masteryAchieved ? new Date().toISOString().split('T')[0] : null,
                  status: masteryAchieved ? 'completed' : 'active',
                  updated_at: new Date()
                })
                .where(eq(development_goals.id, goalId));

              logger.info({ 
                goalId, 
                employeeId: employee_id, 
                sessionId: assessment_session_id,
                documenterId: documenter_user_id,
                consecutive: newConsecutive,
                masteryAchieved,
                requiredStepsCount: requiredSteps.length,
                correctStepsCount: correctSubmissions.length
              }, masteryAchieved ? 'MASTERY ACHIEVED - Goal completed!' : 'Goal progress updated after submission');
            }
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

  app.post("/api/assessment-sessions", authenticateToken, requireRole('Administrator', 'Shift Lead', 'Assistant Manager'), async (req: Request, res: Response) => {
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
            // Find which employees are locked
            const lockedEmployees: string[] = [];
            const lockedByManagers: any[] = [];

            for (const session of activeSessions) {
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
              conflictingSessions: activeSessions.map(s => s.id)
            }, 'Session creation blocked - employees locked by other managers');

            // Throw error with conflict details - Drizzle automatically rolls back transaction on error
            const error: any = new Error('Some employees are currently being assessed by another manager');
            error.statusCode = 409;
            error.lockedEmployees = uniqueLockedEmployees;
            error.lockedByManagers = lockedByManagers;
            throw error;
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

  app.put("/api/assessment-sessions/:id", authenticateToken, requireRole('Administrator', 'Shift Lead', 'Assistant Manager'), async (req: Request, res: Response) => {
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
  app.post("/api/assessment-sessions/:id/complete", authenticateToken, requireRole('Administrator', 'Shift Lead', 'Assistant Manager'), async (req: Request, res: Response) => {
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
  app.post("/api/assessment-sessions/:id/renew", authenticateToken, requireRole('Administrator', 'Shift Lead', 'Assistant Manager'), async (req: Request, res: Response) => {
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

  app.post("/api/assessment-summaries", authenticateToken, requireRole('Administrator', 'Shift Lead', 'Assistant Manager'), async (req: Request, res: Response) => {
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
                step_order: step.step_order,
                step_description: step.step_description,
                is_required: step.is_required
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
              step_order: step.step_order,
              step_description: step.step_description,
              is_required: step.is_required
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

  app.put("/api/employee-images", authenticateToken, requireRole('Administrator', 'Shift Lead', 'Assistant Manager'), async (req: Request, res: Response) => {
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

  app.post("/api/certifications", authenticateToken, requireRole('Administrator', 'Shift Lead', 'Assistant Manager'), async (req: Request, res: Response) => {
    try {
      const parsed = insertPromotionCertificationSchema.parse(req.body);
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

  app.delete("/api/certifications/:id", authenticateToken, requireRole('Administrator'), async (req: Request, res: Response) => {
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

      const coachIds = [...new Set(checkins.map(c => c.coach_id))];
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

  app.post("/api/checkins", authenticateToken, async (req: Request, res: Response) => {
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

  app.put("/api/checkins/:id", authenticateToken, async (req: Request, res: Response) => {
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

  app.delete("/api/checkins/:id", authenticateToken, async (req: Request, res: Response) => {
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

  const httpServer = createServer(app);
  return httpServer;
}
