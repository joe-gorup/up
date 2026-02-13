#!/usr/bin/env tsx

import * as path from 'path';
import * as fs from 'fs';
import { convertSpreadsheetToCSV } from './spreadsheet-to-csv';
import { importEmployees } from './import-employees';
import { importGoalTemplates } from './import-goal-templates';
import { assignGoals } from './assign-goals';

interface BulkImportOptions {
  spreadsheetFile?: string;
  csvDir?: string;
  employeesCSV?: string;
  templatesCSV?: string;
  assignmentsCSV?: string;
}

/**
 * Performs bulk import of all data from spreadsheet or CSV files
 */
export async function bulkImport(options: BulkImportOptions): Promise<void> {
  console.log('🚀 Starting bulk import process...\n');
  
  let csvDir = options.csvDir || 'scripts/csv-data';
  
  // Step 1: Convert spreadsheet to CSV if provided
  if (options.spreadsheetFile) {
    console.log('📊 Converting spreadsheet to CSV...');
    const convertedFiles = await convertSpreadsheetToCSV({
      inputFile: options.spreadsheetFile,
      outputDir: csvDir
    });
    console.log(`✅ Converted ${convertedFiles.length} sheets to CSV\n`);
  }

  // Step 2: Import employees
  const employeesFile = options.employeesCSV || path.join(csvDir, 'employees.csv');
  if (fs.existsSync(employeesFile)) {
    console.log('👥 Importing employees...');
    await importEmployees(employeesFile);
    console.log('✅ Employee import completed\n');
  } else {
    console.log(`⚠️  Employees CSV not found at: ${employeesFile}`);
  }

  // Step 3: Import goal templates
  const templatesFile = options.templatesCSV || path.join(csvDir, 'goal-templates.csv');
  if (fs.existsSync(templatesFile)) {
    console.log('🎯 Importing goal templates...');
    await importGoalTemplates(templatesFile);
    console.log('✅ Goal templates import completed\n');
  } else {
    console.log(`⚠️  Goal templates CSV not found at: ${templatesFile}`);
  }

  // Step 4: Assign goals to employees
  const assignmentsFile = options.assignmentsCSV || path.join(csvDir, 'goal-assignments.csv');
  if (fs.existsSync(assignmentsFile)) {
    console.log('🔗 Assigning goals to employees...');
    await assignGoals(assignmentsFile);
    console.log('✅ Goal assignments completed\n');
  } else {
    console.log(`⚠️  Goal assignments CSV not found at: ${assignmentsFile}`);
  }

  console.log('🎉 Bulk import process completed successfully!');
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Usage: tsx scripts/bulk-import.ts [options]

Options:
  --spreadsheet <file>    Convert spreadsheet file to CSV first
  --csv-dir <dir>        Directory containing CSV files (default: scripts/csv-data)
  --employees <file>     Specific employees CSV file
  --templates <file>     Specific goal templates CSV file  
  --assignments <file>   Specific goal assignments CSV file

Examples:
  # Convert spreadsheet and import all data
  tsx scripts/bulk-import.ts --spreadsheet data.xlsx
  
  # Import from existing CSV files
  tsx scripts/bulk-import.ts --csv-dir ./my-data
  
  # Import specific files
  tsx scripts/bulk-import.ts --employees staff.csv --templates goals.csv --assignments assignments.csv

Expected file structure:
- employees.csv: Employee profiles with support information
- goal-templates.csv: Reusable goal templates with steps
- goal-assignments.csv: Assignments of goals to specific employees

See scripts/example-templates/ for sample CSV formats.
    `);
    process.exit(1);
  }

  const options: BulkImportOptions = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    
    switch (flag) {
      case '--spreadsheet':
        options.spreadsheetFile = value;
        break;
      case '--csv-dir':
        options.csvDir = value;
        break;
      case '--employees':
        options.employeesCSV = value;
        break;
      case '--templates':
        options.templatesCSV = value;
        break;
      case '--assignments':
        options.assignmentsCSV = value;
        break;
      default:
        console.error(`Unknown flag: ${flag}`);
        process.exit(1);
    }
  }

  bulkImport(options)
    .then(() => {
      console.log('\n✨ All imports completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Bulk import failed:', error.message);
      process.exit(1);
    });
}