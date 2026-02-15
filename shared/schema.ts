import { pgTable, text, varchar, integer, boolean, date, timestamp, jsonb, index, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// NOTE: Users table has been consolidated into employees table
// All authentication now handled via employees.has_system_access flag

// Employees table - enhanced to support unified user/employee system
export const employees = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // Legacy field - will be removed after migration
  first_name: text("first_name"),
  last_name: text("last_name"),
  email: text("email").unique(),
  role: text("role").notNull().default("Super Scooper"),
  profile_image_url: text("profile_image_url"),
  is_active: boolean("is_active").default(true),
  
  // System access fields
  has_system_access: boolean("has_system_access").default(false),
  password: text("password"), // Only set if has_system_access is true
  last_login: timestamp("last_login", { withTimezone: true }),
  
  // ROI compliance fields
  date_of_birth: date("date_of_birth"),
  roi_status: boolean("roi_status").default(false),
  roi_signed_at: timestamp("roi_signed_at", { withTimezone: true }),
  roi_signature: text("roi_signature"),
  roi_consent_type: text("roi_consent_type"),
  roi_no_release_details: text("roi_no_release_details"),
  roi_guardian_name: text("roi_guardian_name"),
  roi_guardian_address: text("roi_guardian_address"),
  roi_guardian_city_state_zip: text("roi_guardian_city_state_zip"),
  roi_guardian_phone: text("roi_guardian_phone"),
  roi_guardian_relationship: text("roi_guardian_relationship"),
  
  // Service provider information
  has_service_provider: boolean("has_service_provider").default(false),
  service_providers: jsonb("service_providers").default(sql`'[]'::jsonb`),
  
  // Profile/safety information
  allergies: jsonb("allergies").default(sql`'[]'::jsonb`),
  emergency_contacts: jsonb("emergency_contacts").default(sql`'[]'::jsonb`),
  interests_motivators: jsonb("interests_motivators").default(sql`'[]'::jsonb`),
  challenges: jsonb("challenges").default(sql`'[]'::jsonb`),
  regulation_strategies: jsonb("regulation_strategies").default(sql`'[]'::jsonb`),
  
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  // Performance indexes for frequently queried fields
  isActiveIdx: index("employees_is_active_idx").on(table.is_active),
  emailIdx: index("employees_email_idx").on(table.email),
  hasSystemAccessIdx: index("employees_has_system_access_idx").on(table.has_system_access),
  roleIdx: index("employees_role_idx").on(table.role),
}));

// Goal templates table
export const goal_templates = pgTable("goal_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  goal_statement: text("goal_statement").notNull(),
  default_mastery_criteria: text("default_mastery_criteria").default("3 consecutive assessments with all required steps Correct"),
  relative_target_duration: text("relative_target_duration").notNull().default("90 days"),
  default_target_date: text("default_target_date"),
  status: text("status").default("active"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  // Performance indexes for frequently queried fields
  statusIdx: index("goal_templates_status_idx").on(table.status),
}));

// Goal template steps
export const goal_template_steps = pgTable("goal_template_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  template_id: varchar("template_id").references(() => goal_templates.id, { onDelete: "cascade" }),
  step_order: integer("step_order").notNull(),
  step_description: text("step_description").notNull(),
  is_required: boolean("is_required").default(true),
  timer_required: boolean("timer_required").default(false),
  timer_type: text("timer_type").default("none"), // "none", "required", "optional"
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  // Performance indexes for JOIN optimization
  templateIdIdx: index("goal_template_steps_template_id_idx").on(table.template_id),
  stepOrderIdx: index("goal_template_steps_order_idx").on(table.template_id, table.step_order),
}));

// Development goals table
export const development_goals = pgTable("development_goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employee_id: varchar("employee_id").references(() => employees.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  start_date: date("start_date").default(sql`CURRENT_DATE`),
  target_end_date: date("target_end_date").notNull(),
  status: text("status").default("active"), // "active", "completed", "archived"
  mastery_achieved: boolean("mastery_achieved").default(false),
  mastery_date: date("mastery_date"),
  consecutive_all_correct: integer("consecutive_all_correct").default(0),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  // Performance indexes for frequently queried fields
  employeeIdIdx: index("development_goals_employee_id_idx").on(table.employee_id),
  statusIdx: index("development_goals_status_idx").on(table.status),
  masteryIdx: index("development_goals_mastery_idx").on(table.mastery_achieved),
  employeeStatusIdx: index("development_goals_employee_status_idx").on(table.employee_id, table.status),
}));

// Goal steps table
export const goal_steps = pgTable("goal_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  goal_id: varchar("goal_id").references(() => development_goals.id, { onDelete: "cascade" }),
  step_order: integer("step_order").notNull(),
  step_description: text("step_description").notNull(),
  is_required: boolean("is_required").default(true),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  // Performance indexes for JOIN optimization
  goalIdIdx: index("goal_steps_goal_id_idx").on(table.goal_id),
  stepOrderIdx: index("goal_steps_order_idx").on(table.goal_id, table.step_order),
}));

// Assessment sessions table - for goal documentation sessions (replaces shift management)
export const assessment_sessions = pgTable("assessment_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  manager_id: varchar("manager_id").references(() => employees.id),
  date: date("date").default(sql`CURRENT_DATE`),
  location: text("location").notNull(),
  employee_ids: jsonb("employee_ids").default(sql`'[]'::jsonb`),
  notes: text("notes"), // Overall assessment notes
  status: text("status").default("in_progress"), // "draft", "in_progress", "completed", "abandoned"
  locked_by: varchar("locked_by").references(() => employees.id), // Manager who currently has the lock
  locked_at: timestamp("locked_at", { withTimezone: true }), // When the session was locked
  expires_at: timestamp("expires_at", { withTimezone: true }), // When the lock expires
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  // Performance indexes for frequently queried fields
  dateIdx: index("assessment_sessions_date_idx").on(table.date),
  createdAtIdx: index("assessment_sessions_created_at_idx").on(table.created_at),
  managerDateIdx: index("assessment_sessions_manager_date_idx").on(table.manager_id, table.date),
  statusIdx: index("assessment_sessions_status_idx").on(table.status),
  lockedByIdx: index("assessment_sessions_locked_by_idx").on(table.locked_by),
}));


// Step progress table - tracks progress on individual goal steps
export const step_progress = pgTable("step_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  development_goal_id: varchar("development_goal_id").references(() => development_goals.id, { onDelete: "cascade" }),
  goal_step_id: varchar("goal_step_id").references(() => goal_steps.id, { onDelete: "cascade" }),
  employee_id: varchar("employee_id").references(() => employees.id, { onDelete: "cascade" }),
  assessment_session_id: varchar("assessment_session_id").references(() => assessment_sessions.id, { onDelete: "cascade" }),
  documenter_user_id: varchar("documenter_user_id").references(() => employees.id, { onDelete: "cascade" }), // Employee who created the documentation
  date: date("date").default(sql`CURRENT_DATE`),
  outcome: text("outcome").notNull(),
  notes: text("notes"),
  completion_time_seconds: integer("completion_time_seconds"), // Time in seconds to complete the step
  timer_manually_entered: boolean("timer_manually_entered").default(false), // Whether time was manually entered vs. tracked
  status: text("status").default("submitted"), // "draft" or "submitted"
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  // Performance indexes for frequently queried fields - CRITICAL for goal progress
  developmentGoalIdIdx: index("step_progress_development_goal_id_idx").on(table.development_goal_id),
  employeeIdIdx: index("step_progress_employee_id_idx").on(table.employee_id),
  documenterUserIdIdx: index("step_progress_documenter_user_id_idx").on(table.documenter_user_id),
  dateIdx: index("step_progress_date_idx").on(table.date),
  createdAtIdx: index("step_progress_created_at_idx").on(table.created_at),
  // Composite indexes for common query patterns
  goalEmployeeDateIdx: index("step_progress_goal_employee_date_idx").on(table.development_goal_id, table.employee_id, table.date),
  employeeDateOutcomeIdx: index("step_progress_employee_date_outcome_idx").on(table.employee_id, table.date, table.outcome),
  documenterStatusIdx: index("step_progress_documenter_status_idx").on(table.documenter_user_id, table.status),
}));


// Assessment summaries table - for employee assessment notes
export const assessment_summaries = pgTable("assessment_summaries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employee_id: varchar("employee_id").references(() => employees.id, { onDelete: "cascade" }),
  assessment_session_id: varchar("assessment_session_id").references(() => assessment_sessions.id, { onDelete: "cascade" }),
  date: date("date").default(sql`CURRENT_DATE`),
  summary: text("summary").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  // Performance indexes for frequently queried fields
  employeeIdIdx: index("assessment_summaries_employee_id_idx").on(table.employee_id),
  assessmentSessionIdIdx: index("assessment_summaries_assessment_session_id_idx").on(table.assessment_session_id),
  dateIdx: index("assessment_summaries_date_idx").on(table.date),
  employeeDateIdx: index("assessment_summaries_employee_date_idx").on(table.employee_id, table.date),
  // Unique constraint to prevent duplicate summaries for same employee/session
  uniqueEmployeeSession: unique("assessment_summaries_employee_session_unique").on(table.employee_id, table.assessment_session_id),
}));

// Coach assignments table - links job coaches to their assigned super scoopers
export const coach_assignments = pgTable("coach_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  coach_id: varchar("coach_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  scooper_id: varchar("scooper_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  assigned_by: varchar("assigned_by").references(() => employees.id),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  coachIdIdx: index("coach_assignments_coach_id_idx").on(table.coach_id),
  scooperIdIdx: index("coach_assignments_scooper_id_idx").on(table.scooper_id),
  uniqueCoachScooper: unique("coach_assignments_unique").on(table.coach_id, table.scooper_id),
}));

// Guardian-scooper relationships table - many-to-many linking guardians to super scoopers
export const guardian_relationships = pgTable("guardian_relationships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  guardian_id: varchar("guardian_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  scooper_id: varchar("scooper_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  relationship_type: text("relationship_type").default("guardian"),
  assigned_by: varchar("assigned_by").references(() => employees.id),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  guardianIdIdx: index("guardian_relationships_guardian_id_idx").on(table.guardian_id),
  scooperIdIdx: index("guardian_relationships_scooper_id_idx").on(table.scooper_id),
  uniqueGuardianScooper: unique("guardian_relationships_unique").on(table.guardian_id, table.scooper_id),
}));

// Guardian notes table - notes from guardians about their linked super scoopers
export const guardian_notes = pgTable("guardian_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  guardian_id: varchar("guardian_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  scooper_id: varchar("scooper_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  note: text("note").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  guardianIdIdx: index("guardian_notes_guardian_id_idx").on(table.guardian_id),
  scooperIdIdx: index("guardian_notes_scooper_id_idx").on(table.scooper_id),
  uniqueGuardianScooperNote: unique("guardian_notes_unique").on(table.guardian_id, table.scooper_id),
}));

// Account invitations table - tokens for setting up new accounts via email
export const account_invitations = pgTable("account_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employee_id: varchar("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  email: text("email").notNull(),
  token: varchar("token").notNull().unique(),
  expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
  used_at: timestamp("used_at", { withTimezone: true }),
  created_by: varchar("created_by").references(() => employees.id),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  tokenIdx: index("account_invitations_token_idx").on(table.token),
  employeeIdIdx: index("account_invitations_employee_id_idx").on(table.employee_id),
}));

// Zod schemas
export const insertEmployeeSchema = createInsertSchema(employees).omit({ 
  id: true, 
  created_at: true, 
  updated_at: true,
  last_login: true 
});

// Extended employee schema with password validation for system access
export const insertEmployeeWithPasswordSchema = insertEmployeeSchema.extend({
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
  confirmPassword: z.string().optional()
}).refine(
  (data) => {
    // If has_system_access is true, password is required
    if (data.has_system_access && !data.password) {
      return false;
    }
    // If password is provided, confirmPassword must match
    if (data.password && data.password !== data.confirmPassword) {
      return false;
    }
    return true;
  },
  {
    message: "Password confirmation must match and is required for system access",
    path: ["confirmPassword"]
  }
);

export const insertGoalTemplateSchema = createInsertSchema(goal_templates);
export const insertGoalTemplateStepSchema = createInsertSchema(goal_template_steps);
export const insertDevelopmentGoalSchema = createInsertSchema(development_goals);
export const insertGoalStepSchema = createInsertSchema(goal_steps);
export const insertAssessmentSessionSchema = createInsertSchema(assessment_sessions);
export const insertStepProgressSchema = createInsertSchema(step_progress).extend({
  outcome: z.enum(['correct', 'verbal_prompt', 'na', 'n/a', 'incorrect'])
});
export const insertAssessmentSummarySchema = createInsertSchema(assessment_summaries);
export const insertCoachAssignmentSchema = createInsertSchema(coach_assignments).omit({ id: true, created_at: true });
export const insertGuardianRelationshipSchema = createInsertSchema(guardian_relationships).omit({ id: true, created_at: true });
export const insertAccountInvitationSchema = createInsertSchema(account_invitations).omit({ id: true, created_at: true, used_at: true });
export const insertGuardianNoteSchema = createInsertSchema(guardian_notes).omit({ id: true, created_at: true, updated_at: true });

// Utility function to calculate discrete date from relative duration
export function calculateDateFromRelativeDuration(relativeDuration: string, fromDate: Date = new Date()): string {
  if (!relativeDuration) {
    throw new Error('Relative duration is required');
  }
  const duration = relativeDuration.toLowerCase().trim();
  const [amount, unit] = duration.split(' ');
  const number = parseInt(amount, 10);
  
  if (isNaN(number)) {
    throw new Error(`Invalid duration format: ${relativeDuration}`);
  }
  
  const targetDate = new Date(fromDate);
  
  switch (unit) {
    case 'day':
    case 'days':
      targetDate.setDate(targetDate.getDate() + number);
      break;
    case 'week':
    case 'weeks':
      targetDate.setDate(targetDate.getDate() + (number * 7));
      break;
    case 'month':
    case 'months':
      targetDate.setMonth(targetDate.getMonth() + number);
      break;
    case 'year':
    case 'years':
      targetDate.setFullYear(targetDate.getFullYear() + number);
      break;
    default:
      throw new Error(`Unsupported duration unit: ${unit}`);
  }
  
  return targetDate.toISOString().split('T')[0]; // Return YYYY-MM-DD format
}

// Valid roles in the system
export const SYSTEM_ROLES = [
  "Super Scooper",
  "Job Coach", 
  "Guardian",
  "Shift Lead",
  "Assistant Manager",
  "Administrator"
] as const;

export type SystemRole = typeof SYSTEM_ROLES[number];

// Role-based access control helpers  
export function canDocumentOnOthers(role: string): boolean {
  return role === "Administrator" || role === "Shift Lead" || role === "Assistant Manager";
}

export function canAssignGoals(role: string): boolean {
  return role === "Administrator";
}

export function canManageEmployees(role: string): boolean {
  return role === "Administrator";
}

export function canManageAssignments(role: string): boolean {
  return role === "Administrator";
}

export function canViewAllScoopers(role: string): boolean {
  return role === "Administrator" || role === "Shift Lead" || role === "Assistant Manager";
}

export function canViewAssignedScoopers(role: string): boolean {
  return role === "Job Coach";
}

export function canViewOwnProfileOnly(role: string): boolean {
  return role === "Guardian" || role === "Super Scooper";
}

export function canEmployeeDocumentOnEmployee(
  documentorEmployee: Employee, 
  targetEmployee: Employee
): boolean {
  // Users cannot document on themselves
  if (documentorEmployee.id === targetEmployee.id) {
    return false;
  }
  
  // Must have system access to document
  if (!documentorEmployee.has_system_access) {
    return false;
  }
  
  // Must have a role that allows documentation
  return canDocumentOnOthers(documentorEmployee.role);
}

export function getEmployeeDisplayName(employee: Employee): string {
  return `${employee.first_name} ${employee.last_name}`;
}

// Promotion Certifications table
export const promotion_certifications = pgTable("promotion_certifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employee_id: varchar("employee_id").notNull().references(() => employees.id),
  certification_type: text("certification_type").notNull(), // 'mentor' or 'shift_lead'
  date_completed: text("date_completed").notNull(),
  score: integer("score").notNull(),
  passing_score: integer("passing_score").notNull(),
  passed: boolean("passed").notNull().default(false),
  checklist_results: jsonb("checklist_results").default(sql`'[]'::jsonb`),
  certified_by: varchar("certified_by").references(() => employees.id),
  notes: text("notes"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  employeeIdx: index("promotion_certs_employee_idx").on(table.employee_id),
  typeIdx: index("promotion_certs_type_idx").on(table.certification_type),
}));

export const insertPromotionCertificationSchema = createInsertSchema(promotion_certifications).omit({
  id: true,
  created_at: true,
});

// Coach Check-Ins table
export const coach_checkins = pgTable("coach_checkins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employee_id: varchar("employee_id").notNull(),
  coach_id: varchar("coach_id").notNull(),
  checkin_date: timestamp("checkin_date", { withTimezone: true }).notNull().default(sql`now()`),
  setting: text("setting").notNull(),
  how_was_today: text("how_was_today").notNull(),
  independence: text("independence").notNull(),
  engagement: text("engagement").notNull(),
  big_win: boolean("big_win").notNull(),
  big_win_type: text("big_win_type"),
  challenge: text("challenge").notNull(),
  safety_concern: boolean("safety_concern").notNull().default(false),
  safety_details: text("safety_details"),
  compared_to_last: text("compared_to_last").notNull(),
  support_helped: text("support_helped").notNull(),
  notes: text("notes"),
  created_at: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
}, (table) => ({
  employeeIdx: index("coach_checkins_employee_idx").on(table.employee_id),
  coachIdx: index("coach_checkins_coach_idx").on(table.coach_id),
  dateIdx: index("coach_checkins_date_idx").on(table.checkin_date),
}));

export const insertCoachCheckinSchema = createInsertSchema(coach_checkins).omit({
  id: true,
  created_at: true,
});

export type InsertCoachCheckin = z.infer<typeof insertCoachCheckinSchema>;
export type CoachCheckin = typeof coach_checkins.$inferSelect;

// Coach Files table - for uploaded PDFs and text files
export const coach_files = pgTable("coach_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employee_id: varchar("employee_id").notNull(),
  coach_id: varchar("coach_id").notNull(),
  file_name: text("file_name").notNull(),
  file_type: text("file_type").notNull(),
  file_size: integer("file_size").notNull(),
  storage_path: text("storage_path").notNull(),
  uploaded_at: timestamp("uploaded_at", { withTimezone: true }).default(sql`now()`),
}, (table) => ({
  employeeIdx: index("coach_files_employee_idx").on(table.employee_id),
  coachIdx: index("coach_files_coach_idx").on(table.coach_id),
}));

export const insertCoachFileSchema = createInsertSchema(coach_files).omit({
  id: true,
  uploaded_at: true,
});

export type InsertCoachFile = z.infer<typeof insertCoachFileSchema>;
export type CoachFile = typeof coach_files.$inferSelect;

// Coach Notes table - for rich text notes
export const coach_notes = pgTable("coach_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employee_id: varchar("employee_id").notNull(),
  coach_id: varchar("coach_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
}, (table) => ({
  employeeIdx: index("coach_notes_employee_idx").on(table.employee_id),
  coachIdx: index("coach_notes_coach_idx").on(table.coach_id),
}));

export const insertCoachNoteSchema = createInsertSchema(coach_notes).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InsertCoachNote = z.infer<typeof insertCoachNoteSchema>;
export type CoachNote = typeof coach_notes.$inferSelect;

// Types
export type InsertPromotionCertification = z.infer<typeof insertPromotionCertificationSchema>;
export type PromotionCertification = typeof promotion_certifications.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type InsertEmployeeWithPassword = z.infer<typeof insertEmployeeWithPasswordSchema>;
export type Employee = typeof employees.$inferSelect;
export type InsertGoalTemplate = z.infer<typeof insertGoalTemplateSchema>;
export type GoalTemplate = typeof goal_templates.$inferSelect;
export type InsertGoalTemplateStep = z.infer<typeof insertGoalTemplateStepSchema>;
export type GoalTemplateStep = typeof goal_template_steps.$inferSelect;
export type InsertDevelopmentGoal = z.infer<typeof insertDevelopmentGoalSchema>;
export type DevelopmentGoal = typeof development_goals.$inferSelect;
export type InsertGoalStep = z.infer<typeof insertGoalStepSchema>;
export type GoalStep = typeof goal_steps.$inferSelect;
export type InsertAssessmentSession = z.infer<typeof insertAssessmentSessionSchema>;
export type AssessmentSession = typeof assessment_sessions.$inferSelect;
export type InsertStepProgress = z.infer<typeof insertStepProgressSchema>;
export type StepProgress = Omit<typeof step_progress.$inferSelect, 'outcome'> & {
  outcome: 'correct' | 'verbal_prompt' | 'na' | 'n/a' | 'incorrect';
};
export type InsertAssessmentSummary = z.infer<typeof insertAssessmentSummarySchema>;
export type AssessmentSummary = typeof assessment_summaries.$inferSelect;
export type InsertCoachAssignment = z.infer<typeof insertCoachAssignmentSchema>;
export type CoachAssignment = typeof coach_assignments.$inferSelect;
export type InsertGuardianRelationship = z.infer<typeof insertGuardianRelationshipSchema>;
export type GuardianRelationship = typeof guardian_relationships.$inferSelect;
export type InsertGuardianNote = z.infer<typeof insertGuardianNoteSchema>;
export type GuardianNote = typeof guardian_notes.$inferSelect;
