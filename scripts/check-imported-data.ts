#!/usr/bin/env tsx

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { employees, goal_templates, goal_template_steps, development_goals, goal_steps } from '../shared/schema';

// Database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = postgres(connectionString);
const db = drizzle(sql);

/**
 * Check and display imported data summary
 */
async function checkImportedData(): Promise<void> {
  console.log('📊 Checking imported data...\n');

  try {
    // Count employees
    const employeeCount = await db.select().from(employees);
    console.log(`👥 Employees: ${employeeCount.length}`);
    employeeCount.forEach(emp => {
      console.log(`   - ${emp.name} (${emp.role}) - Active: ${emp.is_active}`);
    });

    // Count goal templates
    const templateCount = await db.select().from(goal_templates);
    console.log(`\n🎯 Goal Templates: ${templateCount.length}`);
    templateCount.forEach(tmpl => {
      console.log(`   - ${tmpl.name} (${tmpl.status})`);
    });

    // Count template steps
    const templateStepsCount = await db.select().from(goal_template_steps);
    console.log(`\n📋 Template Steps: ${templateStepsCount.length}`);

    // Count development goals
    const devGoalsCount = await db.select().from(development_goals);
    console.log(`\n🎖️  Development Goals: ${devGoalsCount.length}`);
    devGoalsCount.forEach(goal => {
      console.log(`   - ${goal.title} (Employee: ${goal.employee_id})`);
    });

    // Count goal steps
    const goalStepsCount = await db.select().from(goal_steps);
    console.log(`\n📝 Goal Steps: ${goalStepsCount.length}`);

    console.log('\n✅ Data check completed!');

  } catch (error) {
    console.error('❌ Failed to check data:', error.message);
    throw error;
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  checkImportedData()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Data check failed:', error.message);
      process.exit(1);
    });
}