# Goal Templates CSV Upload Guide for Microsoft Copilot

## Overview
This guide helps you understand how to properly fill out the CSV template for bulk uploading goal templates to the Golden Scoop employee development system.

## File Format
- **File Type**: CSV (Comma Separated Values)
- **Encoding**: UTF-8
- **Template File**: `goal-templates-bulk-upload-template.csv`

## Column Definitions

### 1. `name` (Required)
- **Purpose**: The title/name of the goal template
- **Format**: Plain text string
- **Examples**: 
  - "Ice Cream Flavors Knowledge"
  - "Customer Service Excellence" 
  - "Cash Register Operations"
- **Guidelines**: Keep it descriptive but concise (under 50 characters)

### 2. `goal_statement` (Required)
- **Purpose**: Detailed description of what the employee will achieve
- **Format**: Plain text string
- **Example**: "Employee will demonstrate comprehensive knowledge of all ice cream flavors, their ingredients, and allergen information to provide excellent customer service"
- **Guidelines**: 
  - Be specific about the expected outcome
  - Include measurable behaviors when possible
  - Typically 1-2 sentences, 50-200 characters

### 3. `default_mastery_criteria` (Required)
- **Purpose**: Defines when an employee has mastered this goal
- **Format**: Plain text string
- **Common Examples**:
  - "3 consecutive shifts with all required steps Correct"
  - "5 consecutive shifts with all required steps Correct"
  - "2 consecutive shifts with all steps Correct or Verbal Prompt"
- **Guidelines**: 
  - Use "consecutive shifts" for consistency
  - Specify the number of shifts required
  - Mention the acceptable outcome levels

### 4. `relative_target_duration` (Required)
- **Purpose**: Expected timeframe for goal completion from assignment
- **Format**: Plain text string
- **Examples**:
  - "30 days" (for basic skills)
  - "90 days" (for complex skills)
  - "6 months" (for advanced competencies)
  - "2 weeks" (for urgent/simple goals)
- **Guidelines**: Be realistic based on skill complexity

### 5. `steps` (Required)
- **Purpose**: JSON array containing the step-by-step breakdown of the goal
- **Format**: JSON array with specific structure
- **Critical**: Must be properly escaped JSON within the CSV

#### Step Object Structure:
Each step must include:
- `step_order`: Number (1, 2, 3, etc.)
- `step_description`: String describing the specific action/behavior
- `is_required`: Boolean (true/false) - whether this step is mandatory for mastery

#### Step JSON Format Example:
```json
[
  {
    "step_order": 1,
    "step_description": "Greet every customer with a smile and friendly welcome",
    "is_required": true
  },
  {
    "step_order": 2, 
    "step_description": "Listen actively to customer orders and repeat back for confirmation",
    "is_required": true
  },
  {
    "step_order": 3,
    "step_description": "Recommend additional items based on preferences",
    "is_required": false
  }
]
```

#### Important JSON Guidelines:
- **Escaping**: In CSV, double quotes inside the JSON must be escaped as `""`
- **No Line Breaks**: Keep the entire JSON array on one line
- **Sequential Order**: Number steps sequentially starting from 1
- **Required vs Optional**: Use `is_required: false` for bonus/optional steps

## CSV Formatting Rules

### Proper Escaping Example:
```csv
name,goal_statement,default_mastery_criteria,relative_target_duration,steps
Customer Service,"Provide excellent service",3 consecutive shifts,90 days,"[{""step_order"": 1, ""step_description"": ""Greet customers warmly"", ""is_required"": true}]"
```

### Common Mistakes to Avoid:
1. **Unescaped Quotes**: Don't use single quotes in JSON - use escaped double quotes
2. **Line Breaks in JSON**: Keep JSON on single line
3. **Missing Commas**: Ensure proper comma separation between array elements
4. **Wrong Data Types**: 
   - `step_order` must be number, not string
   - `is_required` must be boolean (true/false), not string

## Best Practices

### Goal Creation:
- **Specific**: Each step should be clearly observable and measurable
- **Relevant**: Steps should directly relate to job performance
- **Progressive**: Steps should build on each other when possible
- **Achievable**: Set realistic expectations for each timeframe

### Step Guidelines:
- **Limit**: Aim for 3-8 steps per goal (system supports 30+ but keep manageable)
- **Clarity**: Use action verbs and specific behaviors
- **Measurability**: Make steps observable by shift managers
- **Required vs Optional**: Mark critical steps as required, nice-to-have as optional

### Duration Guidelines:
- **Basic Skills**: 2-4 weeks
- **Intermediate Skills**: 2-3 months  
- **Advanced Skills**: 3-6 months
- **Safety/Compliance**: Often shorter (1-4 weeks)

## Example Templates by Category

### Customer Service (4 steps, 90 days):
```csv
Customer Service Excellence,"Consistently provide friendly, helpful customer service",3 consecutive shifts with all required steps Correct,90 days,"[{""step_order"": 1, ""step_description"": ""Greet every customer with a smile"", ""is_required"": true}, {""step_order"": 2, ""step_description"": ""Listen actively to orders"", ""is_required"": true}, {""step_order"": 3, ""step_description"": ""Handle special requests appropriately"", ""is_required"": true}, {""step_order"": 4, ""step_description"": ""Thank customers and invite return"", ""is_required"": true}]"
```

### Technical Skills (5 steps, 90 days):
```csv
Cash Register Operations,Operate register accurately and handle transactions,3 consecutive shifts with all required steps Correct,90 days,"[{""step_order"": 1, ""step_description"": ""Enter order items correctly"", ""is_required"": true}, {""step_order"": 2, ""step_description"": ""Calculate total with tax"", ""is_required"": true}, {""step_order"": 3, ""step_description"": ""Process payment method"", ""is_required"": true}, {""step_order"": 4, ""step_description"": ""Give correct change"", ""is_required"": true}, {""step_order"": 5, ""step_description"": ""Print receipt for customer"", ""is_required"": false}]"
```

### Safety/Compliance (6 steps, 30 days):
```csv
Food Safety and Hygiene,Follow all food safety protocols and hygiene standards,5 consecutive shifts with all required steps Correct,30 days,"[{""step_order"": 1, ""step_description"": ""Wash hands properly before handling food"", ""is_required"": true}, {""step_order"": 2, ""step_description"": ""Use gloves when handling ready-to-eat foods"", ""is_required"": true}, {""step_order"": 3, ""step_description"": ""Maintain proper temperature for storage"", ""is_required"": true}, {""step_order"": 4, ""step_description"": ""Clean scoops between flavors"", ""is_required"": true}, {""step_order"": 5, ""step_description"": ""Follow equipment cleaning schedule"", ""is_required"": true}, {""step_order"": 6, ""step_description"": ""Report food safety hazards"", ""is_required"": true}]"
```

## Upload Process
1. Download the template file from the system
2. Fill in your goal template data following this guide
3. Save as CSV file (UTF-8 encoding)
4. Upload through the "Bulk Upload" tab in Goal Templates section
5. Review the upload results and fix any errors reported

## Error Prevention Checklist
- [ ] All required columns filled
- [ ] JSON properly escaped with double quotes as `""`
- [ ] Step order numbers are sequential (1, 2, 3...)
- [ ] All steps have required boolean value
- [ ] No line breaks within cells
- [ ] File saved as proper CSV format

## System Limits
- Maximum 30+ steps per goal template (recommended: 3-8)
- Name field: Recommended under 50 characters
- Goal statement: Recommended 50-200 characters
- No limit on number of templates per upload

This guide ensures successful bulk upload of goal templates that align with the Golden Scoop employee development system requirements.