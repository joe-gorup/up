#!/usr/bin/env tsx

import * as fs from 'fs';
import csv from 'csv-parser';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { employees } from '../shared/schema';

// Database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = postgres(connectionString);
const db = drizzle(sql);

interface EmployeeCSVRow {
  name: string;
  role?: string;
  profile_image_url?: string;
  is_active?: string;
  allergies?: string; // JSON string or comma-separated
  emergency_contacts?: string; // JSON string
  interests_motivators?: string; // JSON string or comma-separated
  challenges?: string; // JSON string or comma-separated
  regulation_strategies?: string; // JSON string or comma-separated
}

/**
 * Parses CSV field that can be either JSON string or comma-separated values
 */
function parseCSVField(value: string): any[] {
  if (!value || value.trim() === '') return [];
  
  // Try to parse as JSON first
  try {
    return JSON.parse(value);
  } catch {
    // Fall back to comma-separated values
    return value.split(',').map(item => item.trim()).filter(item => item);
  }
}

/**
 * Parses emergency contacts from CSV (expects JSON format)
 */
function parseEmergencyContacts(value: string): any[] {
  if (!value || value.trim() === '') return [];
  
  try {
    return JSON.parse(value);
  } catch {
    console.warn(`Invalid emergency contacts format: ${value}. Expected JSON format.`);
    return [];
  }
}

/**
 * Imports employees from CSV file
 */
export async function importEmployees(csvFilePath: string): Promise<void> {
  console.log(`📁 Reading employee data from: ${csvFilePath}`);
  
  if (!fs.existsSync(csvFilePath)) {
    throw new Error(`CSV file not found: ${csvFilePath}`);
  }

  const employeeData: any[] = [];
  let rowCount = 0;

  return new Promise((resolve, reject) => {
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (row: EmployeeCSVRow) => {
        rowCount++;
        
        try {
          // Parse name into first_name and last_name
          const nameParts = (row.name || '').trim().split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';
          
          const employeeRecord = {
            name: row.name,  // Keep legacy field
            first_name: firstName,
            last_name: lastName,
            email: row.email || `${firstName.toLowerCase()}.${lastName.toLowerCase()}@goldenscoop.org`,
            role: row.role || 'Super Scooper',
            profile_image_url: row.profile_image_url || null,
            is_active: row.is_active ? row.is_active.toLowerCase() === 'true' : true,
            has_system_access: false, // Default to no system access for CSV imports
            allergies: parseCSVField(row.allergies || ''),
            emergency_contacts: parseEmergencyContacts(row.emergency_contacts || ''),
            interests_motivators: parseCSVField(row.interests_motivators || ''),
            challenges: parseCSVField(row.challenges || ''),
            regulation_strategies: parseCSVField(row.regulation_strategies || '')
          };

          employeeData.push(employeeRecord);
          console.log(`✅ Processed employee: ${employeeRecord.name}`);
          
        } catch (error) {
          console.error(`❌ Error processing row ${rowCount}: ${error.message}`);
          console.error(`   Row data:`, row);
        }
      })
      .on('end', async () => {
        try {
          console.log(`\n📊 Total employees to import: ${employeeData.length}`);
          
          if (employeeData.length === 0) {
            console.log('⚠️  No valid employee data found to import');
            resolve();
            return;
          }

          // Import to database
          await db.insert(employees).values(employeeData);
          console.log(`🎉 Successfully imported ${employeeData.length} employees!`);
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
Usage: tsx scripts/import-employees.ts <csv-file>

Expected CSV format:
name,role,profile_image_url,is_active,allergies,emergency_contacts,interests_motivators,challenges,regulation_strategies

Example:
"Alex Johnson","Super Scooper","https://example.com/photo.jpg","true","[\"Nuts\",\"Dairy\"]","[{\"name\":\"Sarah Johnson\",\"relationship\":\"Mother\",\"phone\":\"555-0123\"}]","[\"Music\",\"Art\"]","[\"Loud noises\"]","[\"5-minute breaks\"]"

Note: Arrays can be JSON format or comma-separated (allergies,interests_motivators,challenges,regulation_strategies)
Emergency contacts must be in JSON format with name, relationship, phone fields.
    `);
    process.exit(1);
  }

  importEmployees(csvFile)
    .then(() => {
      console.log('\n✨ Employee import completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Import failed:', error.message);
      process.exit(1);
    });
}