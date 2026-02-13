# Golden Scoop Data Import Scripts

This directory contains scripts to process spreadsheet data and import it into the Golden Scoop employee development system.

## Quick Start

### Option 1: Bulk Import from Spreadsheet
```bash
# Convert Excel/Google Sheets file and import all data at once
tsx scripts/bulk-import.ts --spreadsheet your-data.xlsx
```

### Option 2: Individual Script Usage

1. **Convert spreadsheet to CSV:**
   ```bash
   tsx scripts/spreadsheet-to-csv.ts your-data.xlsx
   ```

2. **Import employees:**
   ```bash
   tsx scripts/import-employees.ts scripts/csv-data/employees.csv
   ```

3. **Import goal templates:**
   ```bash
   tsx scripts/import-goal-templates.ts scripts/csv-data/goal-templates.csv
   ```

4. **Assign goals to employees:**
   ```bash
   tsx scripts/assign-goals.ts scripts/csv-data/goal-assignments.csv
   ```

## CSV Format Requirements

### Employees CSV Format
```csv
name,role,profile_image_url,is_active,allergies,emergency_contacts,interests_motivators,challenges,regulation_strategies
"John Smith","Super Scooper","","true","[\"Peanuts\"]","[{\"name\":\"Jane Smith\",\"relationship\":\"Mother\",\"phone\":\"555-1234\"}]","[\"Sports\",\"Music\"]","[\"Loud environments\"]","[\"Regular breaks\",\"Calm communication\"]"
```

**Field Details:**
- `name` (required): Employee's full name
- `role` (optional): Job role, defaults to "Super Scooper"
- `profile_image_url` (optional): URL to profile photo
- `is_active` (optional): "true" or "false", defaults to true
- `allergies`: JSON array of allergy strings or comma-separated values
- `emergency_contacts`: JSON array with objects containing name, relationship, phone
- `interests_motivators`: JSON array or comma-separated values
- `challenges`: JSON array or comma-separated values  
- `regulation_strategies`: JSON array or comma-separated values

### Goal Templates CSV Format
```csv
name,goal_statement,default_mastery_criteria,default_target_date,status,steps
"Customer Service Excellence","Master excellent customer service","3 consecutive shifts with all required steps Correct","4 weeks","active","[{\"step_order\":1,\"step_description\":\"Greet customers warmly\",\"is_required\":true}]"
```

**Field Details:**
- `name` (required): Template name
- `goal_statement` (required): Description of the goal
- `default_mastery_criteria` (optional): Criteria for mastery, defaults to "3 consecutive shifts with all required steps Correct"
- `default_target_date` (required): Target completion timeframe
- `status` (optional): "active" or "archived", defaults to "active"
- `steps` (required): JSON array of step objects with step_order, step_description, is_required

### Goal Assignments CSV Format  
```csv
employee_name,template_name,title,description,target_end_date,status
"John Smith","Customer Service Excellence","Customer Service Goals","Master excellent customer service","2025-10-30","active"
```

**Field Details:**
- `employee_name` (required): Must match existing employee name exactly
- `template_name` (required): Must match existing goal template name exactly
- `title` (optional): Custom goal title, uses template name if not provided
- `description` (optional): Custom description, uses template goal_statement if not provided
- `target_end_date` (required): End date in YYYY-MM-DD format
- `status` (optional): Goal status, defaults to "active"

## Example Files

Check the `scripts/example-templates/` directory for sample CSV files that show the correct format for each data type.

## Troubleshooting

### Common Issues

1. **"Employee not found" errors**: Make sure employee names in goal-assignments.csv match exactly with names in employees.csv
2. **"Template not found" errors**: Import goal templates before assigning goals to employees
3. **JSON parsing errors**: Ensure JSON fields are properly escaped in CSV (use double quotes around JSON, escape internal quotes)
4. **Database connection errors**: Ensure DATABASE_URL environment variable is set

### Data Validation Tips

- Employee emergency contacts must be valid JSON with name, relationship, and phone fields
- Goal template steps must include step_order, step_description, and optionally is_required
- Dates should be in YYYY-MM-DD format
- Boolean fields accept "true"/"false" (case insensitive)

## Script Execution Order

For best results, run scripts in this order:
1. Convert spreadsheet to CSV (if needed)
2. Import employees first
3. Import goal templates second  
4. Assign goals to employees last

The bulk import script automatically handles this ordering for you.