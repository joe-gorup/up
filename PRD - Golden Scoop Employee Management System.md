# Product Requirements Document
## Golden Scoop Employee Development & Shift Management System

### Executive Summary
Golden Scoop is a comprehensive employee development and shift management application designed for ice cream shop operations. The system enables shift managers and administrators to track employee progress on development goals through structured step-by-step assessments during work shifts.

---

## 1. Product Overview

### 1.1 Purpose
To provide a digital solution for tracking employee skill development, managing work shifts, and documenting progress toward mastery of job-related competencies in an ice cream shop environment.

### 1.2 Target Users
- **Shift Leads / Assistant Managers**: Track employee progress during shifts, document outcomes
- **Administrators**: Manage employees, create goal templates, oversee system operations
- **Job Coaches**: Access assigned scoopers, document check-ins, manage notes and files
- **Guardians**: View linked scoopers' progress, leave notes
- **Super Scoopers (Employees)**: Indirect beneficiaries through structured development tracking

### 1.3 Business Goals
- Standardize employee training and development processes
- Improve employee skill tracking and documentation
- Enable data-driven decisions about employee readiness and performance
- Reduce training inconsistencies across different shifts and managers

---

## 2. Functional Requirements

### 2.1 User Management
**Priority: High**

**User Authentication**
- Demo login system with predefined credentials
- Role-based access control (Admin, Shift Manager)
- Session management and secure access

**User Administration (Admin Only)**
- Create, edit, and manage user accounts
- Assign roles and permissions
- Activate/deactivate user accounts

### 2.2 Employee Management
**Priority: High**

**Employee Profiles**
- Basic information (name, email, phone, address)
- Emergency contact information (multiple contacts supported)
- Allergy and dietary restriction tracking
- Personal motivators and engagement preferences
- Employment status and role information

**Employee Operations**
- Create new employee profiles
- Edit existing employee information
- View comprehensive employee details
- Archive/deactivate employees

**Service Provider Tracking**
- Optional service provider section on Super Scooper profiles
- Track whether an employee has an external service provider
- Record service provider contact details

### 2.3 Goal Template System
**Priority: High**

**Template Management**
- Create reusable goal templates with structured steps
- Define step descriptions and success criteria
- Order steps in logical sequences
- Edit and update existing templates

**Template Categories**
- Skill-based goals (e.g., "Ice Cream Scooping Technique")
- Safety and compliance goals
- Customer service goals
- Operational procedure goals

### 2.4 Development Goal Assignment
**Priority: High**

**Goal Assignment Process**
- Assign goal templates to specific employees
- Set target completion dates
- Define mastery criteria (default: 3 consecutive successful completions)
- Track assignment history

**Goal Tracking**
- Monitor active goals per employee
- View progress toward mastery
- Track completion rates and timelines

### 2.5 Shift Management
**Priority: High**

**Active Shift Operations**
- Start new shifts with employee selection
- Real-time progress tracking during shifts
- Step-by-step assessment interface
- Document outcomes (Correct, Verbal Prompt, N/A)
- Add detailed notes for each step

**Shift Documentation**
- End-of-shift summaries
- Progress documentation
- Performance notes and observations
- Historical shift records

### 2.6 Progress Tracking & Assessment
**Priority: High**

**Real-time Assessment**
- Step-by-step evaluation interface
- Multiple outcome options (Correct, Verbal Prompt, N/A)
- Note-taking capability for detailed feedback
- Progress calculation and display

**Mastery Tracking**
- Automatic detection of mastery achievement
- Consecutive success tracking
- Goal completion notifications
- Progress visualization

### 2.7 Coach Notes & File Management
**Priority: High**

**Coach Notes**
- Job Coaches can create rich text notes for their assigned scoopers
- Notes include title and formatted content
- Only the creating coach or an Administrator can edit or delete notes

**Coach Files**
- Job Coaches can upload files (PDF, TXT, DOC, DOCX, RTF) for assigned scoopers
- Files are stored with access control—only assigned coaches, administrators, and shift leads can view
- Download and delete capabilities with ownership enforcement

### 2.8 Guardian Notes
**Priority: Medium**

- Guardians can leave notes about their linked super scoopers from the "My Loved Ones" page
- One note per guardian-scooper pair (upsert behavior)
- Only the guardian who created the note can edit or delete it
- Administrators, shift leads, and job coaches can view all guardian notes for a scooper

### 2.9 Reporting & Analytics
**Priority: Medium**

**Dashboard Overview**
- Key performance metrics
- Active shift summary
- Employee progress overview
- System usage statistics

**Progress Reports**
- Individual employee progress
- Goal completion rates
- Skill development trends
- Performance analytics

---

## 3. Technical Requirements

### 3.1 Architecture
- **Frontend**: React with TypeScript, Vite build system
- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Demo system with role-based access

### 3.2 Data Models
- Employees (unified user/employee profiles with authentication)
- Goal Templates (reusable goal structures)
- Development Goals (employee-specific goal instances)
- Step Progress (individual step outcomes)
- Assessment Sessions (active sessions and summaries)
- Coach Assignments, Guardian Relationships (role-based linking)
- Coach Notes, Coach Files, Guardian Notes (documentation and communication)
- Promotion Certifications (mentor/shift lead certs)
- Account Invitations (user onboarding tokens)

### 3.3 Performance Requirements
- Page load times under 3 seconds
- Real-time updates during active shifts
- Responsive design for tablet and desktop use
- Concurrent user support (multiple shift managers)

### 3.4 Security Requirements
- Role-based access control
- Secure data transmission
- Protection of employee personal information
- Session management and timeout

---

## 4. User Experience Requirements

### 4.1 Design Standards
- Consistent rounded corner styling (rounded-xl)
- Professional color scheme suitable for workplace use
- Intuitive navigation and clear information hierarchy
- Responsive design for various screen sizes

### 4.2 Usability Requirements
- Minimal training required for shift managers
- Clear visual indicators for progress and status
- Easy-to-understand assessment interface
- Quick access to frequently used functions

### 4.3 Accessibility
- Clear text and sufficient color contrast
- Keyboard navigation support
- Screen reader compatibility
- Mobile-friendly interface design

---

## 5. Business Rules

### 5.1 Mastery Criteria
- Goals are considered mastered after 3 consecutive successful completions
- "Correct" outcomes count toward mastery
- "Verbal Prompt" and "N/A" outcomes reset the consecutive counter
- Mastery status is automatically calculated and displayed

### 5.2 Access Control
- Administrators can manage all system functions
- Shift Leads and Assistant Managers can document assessments and view all scoopers
- Job Coaches can only access assigned scoopers (via coach_assignments)
- Guardians can view assigned scoopers and leave notes (via guardian_relationships)
- Super Scoopers have minimal system access

### 5.3 Data Integrity
- Employee information must be complete before goal assignment
- Active shifts must be properly ended before starting new shifts
- Progress data is immutable once recorded

---

## 6. Success Metrics

### 6.1 User Adoption
- 100% of shift managers actively using the system
- Regular goal tracking during all shifts
- Consistent data entry and documentation

### 6.2 Operational Efficiency
- Reduced time spent on manual progress tracking
- Improved consistency in employee development
- Better visibility into training needs and gaps

### 6.3 Employee Development
- Measurable progress toward goal mastery
- Reduced time to competency for new employees
- Improved employee satisfaction through structured development

---

## 7. Future Enhancements

### 7.1 Phase 2 Features
- Employee self-service portal
- Advanced reporting and analytics
- Integration with scheduling systems
- Mobile app for shift managers

### 7.2 Advanced Capabilities
- Automated goal recommendations
- Performance trend analysis
- Integration with payroll systems
- Multi-location support

---

## 8. Technical Specifications

### 8.1 Database Schema
- Normalized relational design
- Foreign key constraints for data integrity
- Optimized indexes for query performance
- Audit trail capabilities

### 8.2 API Design
- RESTful API architecture
- Standardized error handling
- Comprehensive input validation
- Consistent response formats

### 8.3 Frontend Architecture
- Component-based React design
- TypeScript for type safety
- Context API for state management
- Responsive CSS with Tailwind

---

*Document Version: 1.1*  
*Last Updated: March 2026*  
*Status: Implementation In Progress — Coach/Guardian features added*
