import { pgTable, text, varchar, integer, boolean, date, timestamp, jsonb, index, unique, uniqueIndex } from "drizzle-orm/pg-core";
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
  accommodations: jsonb("accommodations").default(sql`'[]'::jsonb`),
  // New catalog-managed values are stored here while legacy profile columns
  // remain readable and writable during the gradual migration.
  profile_field_values: jsonb("profile_field_values"),
  
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  // Performance indexes for frequently queried fields
  isActiveIdx: index("employees_is_active_idx").on(table.is_active),
  emailIdx: index("employees_email_idx").on(table.email),
  hasSystemAccessIdx: index("employees_has_system_access_idx").on(table.has_system_access),
  roleIdx: index("employees_role_idx").on(table.role),
}));

// Administrator-managed profile field catalog. Definitions are soft-deactivated
// so historical values can remain readable after a field leaves the UI.
export const profile_field_definitions = pgTable("profile_field_definitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull(),
  label: text("label").notNull(),
  description: text("description"),
  value_shape: text("value_shape").notNull().default("string_list"),
  sort_order: integer("sort_order").notNull().default(0),
  status: text("status").notNull().default("active"),
  applies_to_roles: jsonb("applies_to_roles").notNull().default(sql`'["Super Scooper"]'::jsonb`),
  created_by: varchar("created_by").references(() => employees.id, { onDelete: "set null" }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  keyUnique: uniqueIndex("profile_field_definitions_key_unique").on(table.key),
  statusOrderIdx: index("profile_field_definitions_status_order_idx").on(table.status, table.sort_order),
}));

// Shared Administrator-managed dropdown lists.
export const option_lists = pgTable("option_lists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull(),
  label: text("label").notNull(),
  status: text("status").notNull().default("active"),
  created_by: varchar("created_by").references(() => employees.id, { onDelete: "set null" }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  keyUnique: uniqueIndex("option_lists_key_unique").on(table.key),
  statusIdx: index("option_lists_status_idx").on(table.status),
}));

export const option_list_items = pgTable("option_list_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  list_id: varchar("list_id").notNull().references(() => option_lists.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  label: text("label").notNull(),
  sort_order: integer("sort_order").notNull().default(0),
  status: text("status").notNull().default("active"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  listOrderIdx: index("option_list_items_list_order_idx").on(table.list_id, table.status, table.sort_order),
  keyUnique: unique("option_list_items_list_key_unique").on(table.list_id, table.key),
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

// Form engine tables - reusable review/check-in/certification templates
export const form_templates = pgTable("form_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  form_type: text("form_type").notNull().default("custom"),
  status: text("status").notNull().default("active"),
  version: integer("version").notNull().default(1),
  settings_json: jsonb("settings_json").notNull().default(sql`'{"allowed_fill_roles":["Administrator"],"lock_on_submit":true}'::jsonb`),
  created_by: varchar("created_by").references(() => employees.id, { onDelete: "set null" }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  statusIdx: index("form_templates_status_idx").on(table.status),
  typeIdx: index("form_templates_form_type_idx").on(table.form_type),
  createdByIdx: index("form_templates_created_by_idx").on(table.created_by),
}));

export const form_sections = pgTable("form_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  template_id: varchar("template_id").notNull().references(() => form_templates.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  sort_order: integer("sort_order").notNull().default(0),
  status: text("status").notNull().default("active"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  templateIdIdx: index("form_sections_template_id_idx").on(table.template_id),
  sortOrderIdx: index("form_sections_sort_order_idx").on(table.template_id, table.sort_order),
}));

export const form_questions = pgTable("form_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  template_id: varchar("template_id").notNull().references(() => form_templates.id, { onDelete: "cascade" }),
  section_id: varchar("section_id").references(() => form_sections.id, { onDelete: "set null" }),
  stable_key: text("stable_key").notNull(),
  prompt: text("prompt").notNull(),
  help_text: text("help_text"),
  question_type: text("question_type").notNull().default("free_text"),
  config_json: jsonb("config_json").notNull().default(sql`'{}'::jsonb`),
  sort_order: integer("sort_order").notNull().default(0),
  status: text("status").notNull().default("active"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  templateIdIdx: index("form_questions_template_id_idx").on(table.template_id),
  sectionIdIdx: index("form_questions_section_id_idx").on(table.section_id),
  sortOrderIdx: index("form_questions_sort_order_idx").on(table.template_id, table.section_id, table.sort_order),
  stableKeyIdx: index("form_questions_stable_key_idx").on(table.template_id, table.stable_key),
}));

export const form_response_sets = pgTable("form_response_sets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  template_id: varchar("template_id").notNull().references(() => form_templates.id, { onDelete: "cascade" }),
  template_version: integer("template_version").notNull().default(1),
  employee_id: varchar("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  cycle_label: text("cycle_label"),
  status: text("status").notNull().default("draft"),
  template_snapshot_json: jsonb("template_snapshot_json"),
  submitted_by: varchar("submitted_by").references(() => employees.id, { onDelete: "set null" }),
  submitted_at: timestamp("submitted_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  employeeIdIdx: index("form_response_sets_employee_id_idx").on(table.employee_id),
  templateIdIdx: index("form_response_sets_template_id_idx").on(table.template_id),
  statusIdx: index("form_response_sets_status_idx").on(table.status),
  templateEmployeeCycleUnique: uniqueIndex("form_response_sets_template_employee_cycle_unique")
    .on(table.template_id, table.employee_id, table.cycle_label)
    .where(sql`${table.cycle_label} is not null`),
}));

export const form_answers = pgTable("form_answers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  response_set_id: varchar("response_set_id").notNull().references(() => form_response_sets.id, { onDelete: "cascade" }),
  question_id: varchar("question_id").notNull().references(() => form_questions.id, { onDelete: "cascade" }),
  value_json: jsonb("value_json").notNull().default(sql`'{}'::jsonb`),
  snapshot_json: jsonb("snapshot_json"),
  answered_by: varchar("answered_by").references(() => employees.id, { onDelete: "set null" }),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  responseSetIdIdx: index("form_answers_response_set_id_idx").on(table.response_set_id),
  questionIdIdx: index("form_answers_question_id_idx").on(table.question_id),
  responseQuestionUnique: unique("form_answers_response_question_unique").on(table.response_set_id, table.question_id),
}));

export const insertFormTemplateSchema = createInsertSchema(form_templates).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export const insertFormSectionSchema = createInsertSchema(form_sections).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export const insertFormQuestionSchema = createInsertSchema(form_questions).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export const insertFormResponseSetSchema = createInsertSchema(form_response_sets).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export const insertFormAnswerSchema = createInsertSchema(form_answers).omit({
  id: true,
  updated_at: true,
});

export type InsertFormTemplate = z.infer<typeof insertFormTemplateSchema>;
export type FormTemplate = typeof form_templates.$inferSelect;
export type InsertFormSection = z.infer<typeof insertFormSectionSchema>;
export type FormSection = typeof form_sections.$inferSelect;
export type InsertFormQuestion = z.infer<typeof insertFormQuestionSchema>;
export type FormQuestion = typeof form_questions.$inferSelect;
export type InsertFormResponseSet = z.infer<typeof insertFormResponseSetSchema>;
export type FormResponseSet = typeof form_response_sets.$inferSelect;
export type InsertFormAnswer = z.infer<typeof insertFormAnswerSchema>;
export type FormAnswer = typeof form_answers.$inferSelect;

// Development goals table
export const development_goals = pgTable("development_goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employee_id: varchar("employee_id").references(() => employees.id, { onDelete: "cascade" }),
  template_id: varchar("template_id").references(() => goal_templates.id, { onDelete: "set null" }),
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
  template_step_id: varchar("template_step_id").references(() => goal_template_steps.id, { onDelete: "set null" }),
  step_order: integer("step_order").notNull(),
  step_description: text("step_description").notNull(),
  is_required: boolean("is_required").default(true),
  timer_type: varchar("timer_type").default("none"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  // Performance indexes for JOIN optimization
  goalIdIdx: index("goal_steps_goal_id_idx").on(table.goal_id),
  templateStepIdIdx: index("goal_steps_template_step_id_idx").on(table.template_step_id),
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
  taken_over_from: varchar("taken_over_from").references(() => employees.id), // Previous owner if an admin took over
  taken_over_at: timestamp("taken_over_at", { withTimezone: true }), // When the admin takeover occurred
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
}));

// Profile-level notes table - extensible source for future shared timeline updates.
// Legacy guardian and coach notes remain in their original tables during the
// transition; new notes written through the unified feed use this table.
export const profile_notes = pgTable("profile_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scooper_id: varchar("scooper_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  author_id: varchar("author_id").references(() => employees.id, { onDelete: "set null" }),
  author_role_snapshot: text("author_role_snapshot").notNull(),
  body: text("body").notNull(),
  source_type: text("source_type").notNull().default("manual"),
  source_id: varchar("source_id"),
  status: text("status").notNull().default("active"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  scooperIdIdx: index("profile_notes_scooper_id_idx").on(table.scooper_id),
  authorIdIdx: index("profile_notes_author_id_idx").on(table.author_id),
  sourceTypeIdx: index("profile_notes_source_type_idx").on(table.source_type),
  statusIdx: index("profile_notes_status_idx").on(table.status),
}));

// Employee contacts table - unified contacts for each employee (replaces emergency_contacts JSON + guardian add flow)
export const employee_contacts = pgTable("employee_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employee_id: varchar("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  first_name: text("first_name").notNull(),
  last_name: text("last_name").notNull(),
  relationship_type: text("relationship_type").notNull().default("Parent/Guardian"),
  phone: text("phone"),
  email: text("email"),
  is_emergency_contact: boolean("is_emergency_contact").default(false),
  has_app_access: boolean("has_app_access").default(false),
  linked_guardian_id: varchar("linked_guardian_id").references(() => employees.id, { onDelete: "set null" }),
  invite_token: text("invite_token"),
  invite_status: text("invite_status").default("none"),
  created_by: varchar("created_by").references(() => employees.id),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  employeeIdIdx: index("employee_contacts_employee_id_idx").on(table.employee_id),
  linkedGuardianIdIdx: index("employee_contacts_linked_guardian_id_idx").on(table.linked_guardian_id),
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
export const insertProfileNoteSchema = createInsertSchema(profile_notes).omit({ id: true, created_at: true, updated_at: true });
export const insertEmployeeContactSchema = createInsertSchema(employee_contacts).omit({ id: true, created_at: true, updated_at: true });
export const insertProfileFieldDefinitionSchema = createInsertSchema(profile_field_definitions).omit({ id: true, created_at: true, updated_at: true });
export const insertOptionListSchema = createInsertSchema(option_lists).omit({ id: true, created_at: true, updated_at: true });
export const insertOptionListItemSchema = createInsertSchema(option_list_items).omit({ id: true, created_at: true, updated_at: true });

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

export function canManageAccommodations(role: string): boolean {
  return role === "Administrator";
}

export function canUseAccommodations(role: string): boolean {
  return role === "Super Scooper";
}

export type AccommodationWriteError = {
  status: 400 | 403;
  message: string;
};

export function hasAccommodationUpdate(updates: Record<string, unknown>): boolean {
  return updates.accommodations !== undefined;
}

/**
 * Validate the two role constraints for accommodation writes.
 *
 * Keeping this policy separate from the employee route makes it harder for a
 * future profile-permission change to accidentally broaden access to this
 * sensitive field.
 */
export function getAccommodationWriteError(
  actorRole: string,
  targetRole: string,
): AccommodationWriteError | null {
  if (!canManageAccommodations(actorRole)) {
    return {
      status: 403,
      message: "Only administrators can manage accommodations",
    };
  }

  if (!canUseAccommodations(targetRole)) {
    return {
      status: 400,
      message: "Accommodations can only be set for Super Scoopers",
    };
  }

  return null;
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
  response_set_id: varchar("response_set_id").references(() => form_response_sets.id, { onDelete: "set null" }),
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
  responseSetIdx: index("promotion_certs_response_set_idx").on(table.response_set_id),
  responseSetUnique: uniqueIndex("promotion_certs_response_set_unique")
    .on(table.response_set_id)
    .where(sql`${table.response_set_id} is not null`),
}));

export const insertPromotionCertificationSchema = createInsertSchema(promotion_certifications).omit({
  id: true,
  created_at: true,
});

export type ChecklistAnswer = 'correct' | 'incorrect' | 'no_opportunity';
export type ChecklistResult = { question: string; answer: ChecklistAnswer | boolean };

export function normalizeChecklistAnswer(
  answer: ChecklistAnswer | boolean | string | null | undefined
): ChecklistAnswer | undefined {
  if (answer === true) return 'correct';
  if (answer === false) return 'incorrect';
  if (answer === 'correct' || answer === 'incorrect' || answer === 'no_opportunity') return answer;
  return undefined;
}

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

// Role Permissions table - configurable permissions per role per feature
export const role_permissions = pgTable("role_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  role: text("role").notNull(),
  feature: text("feature").notNull(),
  can_view: boolean("can_view").default(false),
  can_modify: boolean("can_modify").default(false),
  can_delete: boolean("can_delete").default(false),
  updated_at: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
  updated_by: varchar("updated_by"),
}, (table) => ({
  roleFeatureIdx: unique("role_permissions_role_feature_unique").on(table.role, table.feature),
}));

export const insertRolePermissionSchema = createInsertSchema(role_permissions).omit({
  id: true,
  updated_at: true,
});

export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type RolePermission = typeof role_permissions.$inferSelect;

export const PERMISSION_FEATURES = [
  'my_shift',
  'my_scoopers',
  'my_loved_ones',
  'employee_profiles',
  'goal_assessment',
  'goal_assignment',
  'goal_templates',
  'employee_management',
  'user_management',
  'promotion_certifications',
  'roi_compliance',
  'coach_notes',
  'coach_files',
  'guardian_notes',
  'contacts',
  'past_assessments',
  'employee_reviews',
  'form_responses',
  'external_user_invites',
] as const;

export type PermissionFeature = typeof PERMISSION_FEATURES[number];

export const PERMISSION_FEATURE_LABELS: Record<PermissionFeature, string> = {
  my_shift: 'My Shift',
  my_scoopers: 'My Scoopers',
  my_loved_ones: 'My Loved Ones',
  employee_profiles: 'Employee Profiles',
  goal_assessment: 'Goal Assessment / Documentation',
  goal_assignment: 'Goal Assignment',
  goal_templates: 'Goal Templates',
  employee_management: 'Employee Management',
  user_management: 'User Management',
  promotion_certifications: 'Promotion Certifications',
  roi_compliance: 'ROI Compliance',
  coach_notes: 'Coach Notes',
  coach_files: 'Coach Files',
  guardian_notes: 'Guardian Notes',
  contacts: 'Contacts',
  past_assessments: 'Past Assessments',
  employee_reviews: 'Employee Reviews',
  form_responses: 'Form & Review Responses',
  external_user_invites: 'External User Invites',
};

export const CONFIGURABLE_ROLES = ['Shift Lead', 'Assistant Manager', 'Job Coach', 'Guardian'] as const;

// Videos table - flexible video library (Golden Scoop curated + employer-specific)
export const videos = pgTable("videos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  youtube_url: text("youtube_url").notNull(),
  source: text("source").notNull().default("golden_scoop"), // 'golden_scoop' | 'employer'
  status: text("status").notNull().default("active"), // 'active' | 'archived'
  created_by: varchar("created_by").references(() => employees.id, { onDelete: "set null" }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  sourceIdx: index("videos_source_idx").on(table.source),
  statusIdx: index("videos_status_idx").on(table.status),
  createdByIdx: index("videos_created_by_idx").on(table.created_by),
}));

// Goal Template <-> Video join
export const goal_template_videos = pgTable("goal_template_videos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  video_id: varchar("video_id").notNull().references(() => videos.id, { onDelete: "cascade" }),
  template_id: varchar("template_id").notNull().references(() => goal_templates.id, { onDelete: "cascade" }),
  display_order: integer("display_order").default(0),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  templateIdIdx: index("goal_template_videos_template_id_idx").on(table.template_id),
  videoIdIdx: index("goal_template_videos_video_id_idx").on(table.video_id),
  uniqueVideoTemplate: unique("goal_template_videos_unique").on(table.video_id, table.template_id),
}));

const youtubeUrlPattern =
  /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^&]*&)*v=|embed\/|shorts\/|v\/)|youtu\.be\/)[\w-]{11}(?:[?&#].*)?$/;

export const insertVideoSchema = createInsertSchema(videos)
  .omit({ id: true, created_at: true, updated_at: true })
  .extend({
    youtube_url: z
      .string()
      .url('YouTube URL must be a valid URL')
      .regex(youtubeUrlPattern, 'Must be a valid YouTube URL (youtube.com/watch?v=… or youtu.be/…)'),
  });

export const updateVideoSchema = insertVideoSchema.partial().extend({
  youtube_url: insertVideoSchema.shape.youtube_url.optional(),
});

export const insertGoalTemplateVideoSchema = createInsertSchema(goal_template_videos).omit({
  id: true,
  created_at: true,
});

// Goal Template Step <-> Video join (videos scoped to a specific template step)
export const goal_template_step_videos = pgTable("goal_template_step_videos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  video_id: varchar("video_id").notNull().references(() => videos.id, { onDelete: "cascade" }),
  template_step_id: varchar("template_step_id").notNull().references(() => goal_template_steps.id, { onDelete: "cascade" }),
  display_order: integer("display_order").default(0),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  templateStepIdIdx: index("goal_template_step_videos_step_id_idx").on(table.template_step_id),
  videoIdIdx: index("goal_template_step_videos_video_id_idx").on(table.video_id),
  uniqueVideoStep: unique("goal_template_step_videos_unique").on(table.video_id, table.template_step_id),
}));

export const insertGoalTemplateStepVideoSchema = createInsertSchema(goal_template_step_videos).omit({
  id: true,
  created_at: true,
});

export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type Video = typeof videos.$inferSelect;
export type InsertGoalTemplateVideo = z.infer<typeof insertGoalTemplateVideoSchema>;
export type GoalTemplateVideo = typeof goal_template_videos.$inferSelect;
export type InsertGoalTemplateStepVideo = z.infer<typeof insertGoalTemplateStepVideoSchema>;
export type GoalTemplateStepVideo = typeof goal_template_step_videos.$inferSelect;

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
export type InsertProfileNote = z.infer<typeof insertProfileNoteSchema>;
export type ProfileNote = typeof profile_notes.$inferSelect;
export type InsertEmployeeContact = z.infer<typeof insertEmployeeContactSchema>;
export type EmployeeContact = typeof employee_contacts.$inferSelect;
export type InsertProfileFieldDefinition = z.infer<typeof insertProfileFieldDefinitionSchema>;
export type ProfileFieldDefinition = typeof profile_field_definitions.$inferSelect;
export type InsertOptionList = z.infer<typeof insertOptionListSchema>;
export type OptionList = typeof option_lists.$inferSelect;
export type InsertOptionListItem = z.infer<typeof insertOptionListItemSchema>;
export type OptionListItem = typeof option_list_items.$inferSelect;

// Employee reviews table
export const employee_reviews = pgTable("employee_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employee_id: varchar("employee_id").references(() => employees.id, { onDelete: "cascade" }),
  reviewer_id: varchar("reviewer_id").references(() => employees.id, { onDelete: "set null" }),
  review_type: text("review_type").notNull().default("mid_year"), // "mid_year" | "annual"
  q1: text("q1"),
  q2: text("q2"),
  q3: text("q3"),
  q4: text("q4"),
  q5: text("q5"),
  q6: text("q6"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  employeeIdIdx: index("employee_reviews_employee_id_idx").on(table.employee_id),
  reviewerIdIdx: index("employee_reviews_reviewer_id_idx").on(table.reviewer_id),
}));

export const insertEmployeeReviewSchema = createInsertSchema(employee_reviews).omit({ id: true, created_at: true, updated_at: true });
export type InsertEmployeeReview = z.infer<typeof insertEmployeeReviewSchema>;
export type EmployeeReview = typeof employee_reviews.$inferSelect;
