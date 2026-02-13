#!/usr/bin/env tsx

import * as fs from 'fs';
import csv from 'csv-parser';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { goal_templates, goal_template_steps } from '../shared/schema';

// Database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = postgres(connectionString);
const db = drizzle(sql);

interface GoalTemplateCSVRow {
  name: string;
  goal_statement: string;
  default_mastery_criteria?: string;
  default_target_date: string;
  status?: string;
  steps: string; // JSON string of steps array
}

interface GoalTemplateStep {
  step_order: number;
  step_description: string;
  is_required?: boolean;
}

/**
 * Parses goal template steps from CSV (expects JSON format)
 */
function parseSteps(stepsValue: string): GoalTemplateStep[] {
  if (!stepsValue || stepsValue.trim() === '') return [];
  
  try {
    const steps = JSON.parse(stepsValue);
    return steps.map((step: any, index: number) => ({
      step_order: step.step_order || index + 1,
      step_description: step.step_description || step.description || step,
      is_required: step.is_required !== false // Default to true unless explicitly false
    }));
  } catch (error) {
    console.warn(`Invalid steps format: ${stepsValue}. Expected JSON array.`);
    return [];
  }
}

/**
 * Imports goal templates from CSV file
 */
export async function importGoalTemplates(csvFilePath: string): Promise<void> {
  console.log(`📁 Reading goal template data from: ${csvFilePath}`);
  
  if (!fs.existsSync(csvFilePath)) {
    throw new Error(`CSV file not found: ${csvFilePath}`);
  }

  const templateData: any[] = [];
  const allSteps: any[] = [];
  let rowCount = 0;

  return new Promise((resolve, reject) => {
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (row: GoalTemplateCSVRow) => {
        rowCount++;
        
        try {
          const templateId = `template-${Date.now()}-${rowCount}`;
          
          const templateRecord = {
            id: templateId,
            name: row.name,
            goal_statement: row.goal_statement,
            default_mastery_criteria: row.default_mastery_criteria || "3 consecutive shifts with all required steps Correct",
            default_target_date: row.default_target_date,
            status: row.status || 'active'
          };

          templateData.push(templateRecord);
          
          // Parse and prepare steps
          const steps = parseSteps(row.steps);
          for (const step of steps) {
            allSteps.push({
              template_id: templateId,
              step_order: step.step_order,
              step_description: step.step_description,
              is_required: step.is_required
            });
          }

          console.log(`✅ Processed template: ${templateRecord.name} (${steps.length} steps)`);
          
        } catch (error) {
          console.error(`❌ Error processing row ${rowCount}: ${error.message}`);
          console.error(`   Row data:`, row);
        }
      })
      .on('end', async () => {
        try {
          console.log(`\n📊 Total templates to import: ${templateData.length}`);
          console.log(`📊 Total steps to import: ${allSteps.length}`);
          
          if (templateData.length === 0) {
            console.log('⚠️  No valid template data found to import');
            resolve();
            return;
          }

          // Import templates first
          await db.insert(goal_templates).values(templateData);
          console.log(`🎯 Successfully imported ${templateData.length} goal templates!`);
          
          // Then import steps
          if (allSteps.length > 0) {
            await db.insert(goal_template_steps).values(allSteps);
            console.log(`📋 Successfully imported ${allSteps.length} template steps!`);
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
Usage: tsx scripts/import-goal-templates.ts <csv-file>

Expected CSV format:
name,goal_statement,default_mastery_criteria,default_target_date,status,steps

Example:
"Customer Service Excellence","Master excellent customer service skills","3 consecutive shifts with all required steps Correct","4 weeks","active","[{\"step_order\":1,\"step_description\":\"Greet customers warmly\",\"is_required\":true},{\"step_order\":2,\"step_description\":\"Take orders accurately\",\"is_required\":true}]"

Note: steps field must be a JSON array of step objects with step_order, step_description, and optional is_required fields.
    `);
    process.exit(1);
  }

  importGoalTemplates(csvFile)
    .then(() => {
      console.log('\n✨ Goal template import completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Import failed:', error.message);
      process.exit(1);
    });
}