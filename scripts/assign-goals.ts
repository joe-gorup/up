#!/usr/bin/env tsx

import * as fs from 'fs';
import csv from 'csv-parser';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { development_goals, goal_steps, employees, goal_templates, goal_template_steps } from '../shared/schema';

// Database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = postgres(connectionString);
const db = drizzle(sql);

interface GoalAssignmentCSVRow {
  employee_name: string;
  template_name: string;
  title?: string;
  description?: string;
  target_end_date: string;
  status?: string;
}

/**
 * Assigns development goals to employees from CSV file
 */
export async function assignGoals(csvFilePath: string): Promise<void> {
  console.log(`📁 Reading goal assignment data from: ${csvFilePath}`);
  
  if (!fs.existsSync(csvFilePath)) {
    throw new Error(`CSV file not found: ${csvFilePath}`);
  }

  // Load existing employees and templates for reference
  console.log('📋 Loading existing employees and templates...');
  const existingEmployees = await db.select().from(employees);
  const existingTemplates = await db.select().from(goal_templates);
  const templateSteps = await db.select().from(goal_template_steps);
  
  console.log(`Found ${existingEmployees.length} employees and ${existingTemplates.length} templates`);

  const assignmentData: any[] = [];
  const allGoalSteps: any[] = [];
  let rowCount = 0;
  let skipCount = 0;

  return new Promise((resolve, reject) => {
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (row: GoalAssignmentCSVRow) => {
        rowCount++;
        
        try {
          // Find employee by name
          const employee = existingEmployees.find(emp => 
            emp.name.toLowerCase() === row.employee_name.toLowerCase()
          );
          
          if (!employee) {
            console.warn(`⚠️  Employee "${row.employee_name}" not found - skipping row ${rowCount}`);
            skipCount++;
            return;
          }

          // Find template by name
          const template = existingTemplates.find(tmpl => 
            tmpl.name.toLowerCase() === row.template_name.toLowerCase()
          );
          
          if (!template) {
            console.warn(`⚠️  Template "${row.template_name}" not found - skipping row ${rowCount}`);
            skipCount++;
            return;
          }

          const goalId = `goal-${Date.now()}-${rowCount}`;
          
          const goalRecord = {
            id: goalId,
            employee_id: employee.id,
            title: row.title || template.name,
            description: row.description || template.goal_statement,
            target_end_date: row.target_end_date,
            status: row.status || 'active'
          };

          assignmentData.push(goalRecord);
          
          // Create goal steps based on template steps
          const relatedSteps = templateSteps.filter(step => step.template_id === template.id);
          for (const templateStep of relatedSteps) {
            allGoalSteps.push({
              goal_id: goalId,
              step_order: templateStep.step_order,
              step_description: templateStep.step_description,
              is_required: templateStep.is_required
            });
          }

          console.log(`✅ Prepared assignment: ${employee.name} → ${template.name} (${relatedSteps.length} steps)`);
          
        } catch (error) {
          console.error(`❌ Error processing row ${rowCount}: ${error.message}`);
          console.error(`   Row data:`, row);
          skipCount++;
        }
      })
      .on('end', async () => {
        try {
          console.log(`\n📊 Processing summary:`);
          console.log(`   - Total rows: ${rowCount}`);
          console.log(`   - Valid assignments: ${assignmentData.length}`);
          console.log(`   - Skipped rows: ${skipCount}`);
          console.log(`   - Goal steps to create: ${allGoalSteps.length}`);
          
          if (assignmentData.length === 0) {
            console.log('⚠️  No valid assignment data found to import');
            resolve();
            return;
          }

          // Import goals first
          await db.insert(development_goals).values(assignmentData);
          console.log(`🎯 Successfully created ${assignmentData.length} development goals!`);
          
          // Then import goal steps
          if (allGoalSteps.length > 0) {
            await db.insert(goal_steps).values(allGoalSteps);
            console.log(`📋 Successfully created ${allGoalSteps.length} goal steps!`);
          }
          
          resolve();
          
        } catch (error) {
          console.error('❌ Database import failed:', error.message);
          reject(error);
        }
      })
      .on('error', (error) => {
        console.error('❌ CSV parsing failed:', error.message);
        reject(error);
      });
  });
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const csvFile = process.argv[2];
  
  if (!csvFile) {
    console.log(`
Usage: tsx scripts/assign-goals.ts <csv-file>

Expected CSV format:
employee_name,template_name,title,description,target_end_date,status

Example:
"Alex Johnson","Customer Service Excellence","Customer Service Goals","Learn excellent customer service","2025-09-30","active"

Note: 
- employee_name must match existing employee names exactly
- template_name must match existing goal template names exactly
- title and description are optional (will use template defaults)
- target_end_date should be in YYYY-MM-DD format
- status defaults to 'active'
    `);
    process.exit(1);
  }

  assignGoals(csvFile)
    .then(() => {
      console.log('\n✨ Goal assignment completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Assignment failed:', error.message);
      process.exit(1);
    });
}