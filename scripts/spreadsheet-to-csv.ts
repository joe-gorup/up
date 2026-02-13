#!/usr/bin/env tsx

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

interface ConversionOptions {
  inputFile: string;
  outputDir?: string;
  sheetName?: string;
}

/**
 * Converts spreadsheet files (Excel, Google Sheets) to CSV format
 */
export async function convertSpreadsheetToCSV(options: ConversionOptions): Promise<string[]> {
  const { inputFile, outputDir = 'scripts/csv-data', sheetName } = options;
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Read the spreadsheet file
  const workbook = XLSX.readFile(inputFile);
  const outputFiles: string[] = [];

  if (sheetName) {
    // Convert specific sheet
    if (!workbook.SheetNames.includes(sheetName)) {
      throw new Error(`Sheet "${sheetName}" not found in workbook`);
    }
    
    const worksheet = workbook.Sheets[sheetName];
    const csvData = XLSX.utils.sheet_to_csv(worksheet);
    const outputPath = path.join(outputDir, `${sheetName}.csv`);
    
    fs.writeFileSync(outputPath, csvData);
    outputFiles.push(outputPath);
    console.log(`✅ Converted sheet "${sheetName}" to ${outputPath}`);
    
  } else {
    // Convert all sheets
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const csvData = XLSX.utils.sheet_to_csv(worksheet);
      const outputPath = path.join(outputDir, `${sheetName}.csv`);
      
      fs.writeFileSync(outputPath, csvData);
      outputFiles.push(outputPath);
      console.log(`✅ Converted sheet "${sheetName}" to ${outputPath}`);
    }
  }

  return outputFiles;
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Usage: tsx scripts/spreadsheet-to-csv.ts <input-file> [options]

Options:
  --sheet <name>     Convert only the specified sheet
  --output <dir>     Output directory (default: scripts/csv-data)

Examples:
  tsx scripts/spreadsheet-to-csv.ts data.xlsx
  tsx scripts/spreadsheet-to-csv.ts data.xlsx --sheet "Employees" --output ./data
    `);
    process.exit(1);
  }

  const inputFile = args[0];
  let outputDir: string | undefined;
  let sheetName: string | undefined;

  // Parse command line arguments
  for (let i = 1; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    
    switch (flag) {
      case '--sheet':
        sheetName = value;
        break;
      case '--output':
        outputDir = value;
        break;
      default:
        console.error(`Unknown flag: ${flag}`);
        process.exit(1);
    }
  }

  // Validate input file exists
  if (!fs.existsSync(inputFile)) {
    console.error(`❌ Input file "${inputFile}" not found`);
    process.exit(1);
  }

  // Convert spreadsheet
  convertSpreadsheetToCSV({ inputFile, outputDir, sheetName })
    .then((files) => {
      console.log(`\n🎉 Successfully converted to ${files.length} CSV file(s):`);
      files.forEach(file => console.log(`   - ${file}`));
    })
    .catch((error) => {
      console.error('❌ Conversion failed:', error.message);
      process.exit(1);
    });
}