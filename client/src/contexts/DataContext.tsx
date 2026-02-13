import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { apiRequest } from '../lib/auth';
import { calculateDateFromRelativeDuration } from '../../../shared/schema';

export interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  profileImageUrl?: string;
  isActive: boolean;
  hasSystemAccess: boolean;
  password?: string; // Only for employees with system access
  allergies: string[];
  emergencyContacts: Array<{
    name: string;
    relationship: string;
    phone: string;
  }>;
  interestsMotivators: string[];
  challenges: string[];
  regulationStrategies: string[];
  last_login: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GoalStep {
  id: string;
  stepOrder: number;
  stepDescription: string;
  isRequired: boolean;
}

export interface DevelopmentGoal {
  id: string;
  employeeId: string;
  title: string;
  description: string;
  startDate: string;
  targetEndDate: string;
  status: 'active' | 'maintenance' | 'archived';
  masteryAchieved: boolean;
  masteryDate?: string;
  consecutiveAllCorrect: number;
  steps: GoalStep[];
}

export interface AssessmentSession {
  id: string;
  managerId: string;
  date: string;
  location: string;
  employeeIds: string[];
  notes?: string;
  status?: string;
  lockedBy?: string | null;
  lockedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}


export interface StepProgress {
  id: string;
  developmentGoalId: string;
  goalStepId: string;
  employeeId: string;
  assessmentSessionId?: string;
  date: string;
  outcome: 'correct' | 'verbal_prompt' | 'na' | 'incorrect';
  notes?: string;
  status?: 'draft' | 'submitted';
  completionTimeSeconds?: number;
  timerManuallyEntered?: boolean;
}

export interface AssessmentSummary {
  id: string;
  employeeId: string;
  assessmentSessionId: string;
  date: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  managerId?: string;
}


export interface PromotionCertification {
  id: string;
  employeeId: string;
  certificationType: 'mentor' | 'shift_manager';
  dateCompleted: string;
  score: number;
  passingScore: number;
  passed: boolean;
  checklistResults: any[];
  certifiedBy?: string;
  notes?: string;
  createdAt: string;
}

export interface GoalTemplate {
  id: string;
  name: string;
  goalStatement: string;
  defaultMasteryCriteria?: string; // Made optional since we're removing it from UI
  relativeTargetDuration: string;
  defaultTargetDate?: string; // Keep for backward compatibility
  status: 'active' | 'archived';
  steps: Array<{
    id: string;
    stepOrder: number;
    stepDescription: string;
    isRequired: boolean;
    timerType?: 'none' | 'optional' | 'required';
  }>;
}

interface DataContextType {
  employees: Employee[];
  activeAssessmentSession: AssessmentSession | null;
  assessmentSummaries: AssessmentSummary[];
  developmentGoals: DevelopmentGoal[];
  goalTemplates: GoalTemplate[];
  stepProgress: StepProgress[];
  certifications: PromotionCertification[];
  loadUserDrafts: (userId: string) => Promise<void>;
  addEmployee: (employee: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  createAssessmentSession: (employeeIds: string[], location?: string) => Promise<{ success: boolean; error?: string; lockedEmployees?: any[]; lockedByManagers?: any[] }>;
  endAssessmentSession: () => void;
  completeAssessmentSession: (sessionId: string) => Promise<void>;
  renewAssessmentSession: (sessionId: string) => Promise<void>;
  updateAssessmentSessionEmployees: (sessionId: string, employeeIds: string[]) => Promise<{ success: boolean; error?: string }>;
  checkEmployeeLocks: (employeeIds: string[]) => Promise<{ locked: any[]; available: string[] }>;
  saveAssessmentSummary: (employeeId: string, summary: string) => void;
  recordStepProgress: (progress: Omit<StepProgress, 'id' | 'date'>) => void;
  saveStepProgressDraft: (progress: Omit<StepProgress, 'id' | 'date'>, documenterUserId: string) => void;
  submitStepProgress: (employeeId: string, documenterUserId: string, assessmentSessionId?: string) => Promise<any>;
  createGoalFromTemplate: (templateId: string, employeeId: string) => void;
  addGoalTemplate: (template: Omit<GoalTemplate, 'id'>) => void;
  updateGoalTemplate: (templateId: string, template: Omit<GoalTemplate, 'id'>) => void;
  archiveGoalTemplate: (templateId: string) => void;
  updateGoal: (goalId: string, updates: Partial<DevelopmentGoal>) => void;
  archiveGoal: (goalId: string) => void;
  addCertification: (cert: Omit<PromotionCertification, 'id' | 'createdAt'>) => Promise<PromotionCertification | null>;
  deleteCertification: (id: string) => Promise<void>;
  refreshCertifications: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeAssessmentSession, setActiveAssessmentSession] = useState<AssessmentSession | null>(null);
  const [assessmentSummaries, setAssessmentSummaries] = useState<AssessmentSummary[]>([]);
  const [developmentGoals, setDevelopmentGoals] = useState<DevelopmentGoal[]>([]);
  const [goalTemplates, setGoalTemplates] = useState<GoalTemplate[]>([]);
  const [stepProgress, setStepProgress] = useState<StepProgress[]>([]);
  const [certifications, setCertifications] = useState<PromotionCertification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load employees
      const employeesResponse = await apiRequest('/api/employees');
      if (employeesResponse.ok) {
        const employeesData = await employeesResponse.json();
        const mappedEmployees = employeesData.map((emp: any) => ({
          id: emp.id,
          first_name: emp.first_name,
          last_name: emp.last_name,
          email: emp.email,
          role: emp.role,
          profileImageUrl: emp.profile_image_url,
          isActive: emp.is_active,
          hasSystemAccess: emp.has_system_access || false,
          allergies: emp.allergies || [],
          emergencyContacts: emp.emergency_contacts || [],
          interestsMotivators: emp.interests_motivators || [],
          challenges: emp.challenges || [],
          regulationStrategies: emp.regulation_strategies || [],
          last_login: emp.last_login || null,
          createdAt: emp.created_at,
          updatedAt: emp.updated_at
        }));
        
        // Deduplicate employees by ID (not email, since Super Scoopers may not have emails)
        const uniqueEmployees = mappedEmployees.filter((emp: any, index: number, arr: any[]) => 
          arr.findIndex((e: any) => e.id === emp.id) === index
        );
        
        setEmployees(uniqueEmployees);
      }

      // Load goal templates
      const templatesResponse = await apiRequest('/api/goal-templates');
      if (templatesResponse.ok) {
        const templatesData = await templatesResponse.json();
        const mappedTemplates = templatesData.map((template: any) => ({
          id: template.id,
          name: template.name,
          goalStatement: template.goal_statement,
          defaultMasteryCriteria: template.default_mastery_criteria,
          defaultTargetDate: template.default_target_date,
          status: template.status,
          steps: template.steps.map((step: any) => ({
            id: step.id,
            stepOrder: step.step_order,
            stepDescription: step.step_description,
            isRequired: step.is_required
          }))
        }));
        setGoalTemplates(mappedTemplates);
      }

      // Load development goals
      const goalsResponse = await apiRequest('/api/development-goals');
      if (goalsResponse.ok) {
        const goalsData = await goalsResponse.json();
        const mappedGoals = goalsData.map((goal: any) => ({
          id: goal.id,
          employeeId: goal.employee_id,
          title: goal.title,
          description: goal.description,
          startDate: goal.start_date,
          targetEndDate: goal.target_end_date,
          status: goal.status,
          masteryAchieved: goal.mastery_achieved,
          masteryDate: goal.mastery_date,
          consecutiveAllCorrect: goal.consecutive_all_correct,
          steps: goal.steps.map((step: any) => ({
            id: step.id,
            stepOrder: step.step_order,
            stepDescription: step.step_description,
            isRequired: step.is_required
          }))
        }));
        setDevelopmentGoals(mappedGoals);
      }

      // Load step progress (submitted only)
      const progressResponse = await apiRequest('/api/step-progress');
      if (progressResponse.ok) {
        const progressData = await progressResponse.json();
        const mappedProgress = progressData.map((progress: any) => ({
          id: progress.id,
          developmentGoalId: progress.development_goal_id,
          goalStepId: progress.goal_step_id,
          employeeId: progress.employee_id,
          assessmentSessionId: progress.assessment_session_id,

          date: progress.date,
          outcome: progress.outcome,
          notes: progress.notes,
          status: progress.status || 'submitted'
        }));
        setStepProgress(mappedProgress);
      }

      // Load assessment summaries
      const summariesResponse = await apiRequest('/api/assessment-summaries');
      if (summariesResponse.ok) {
        const summariesData = await summariesResponse.json();
        const mappedSummaries = summariesData.map((summary: any) => ({
          id: summary.id,
          employeeId: summary.employee_id,
          assessmentSessionId: summary.assessment_session_id,
          date: summary.date,
          summary: summary.summary,
          createdAt: summary.created_at,
          updatedAt: summary.updated_at,
          managerId: summary.manager_id
        }));
        setAssessmentSummaries(mappedSummaries);
      }


      // Load assessment sessions to check for active session
      const assessmentSessionsResponse = await apiRequest('/api/assessment-sessions');
      if (assessmentSessionsResponse.ok) {
        const sessionsData = await assessmentSessionsResponse.json();
        // For now, consider the most recent session as "active" for the current day
        // Only load sessions that are draft or in_progress (not completed or abandoned)
        const today = new Date().toISOString().split('T')[0];
        const todaySessions = sessionsData.filter((session: any) => 
          session.date === today && 
          (session.status === 'draft' || session.status === 'in_progress')
        );
        const activeSession = todaySessions.length > 0 ? todaySessions[0] : null;
        
        if (activeSession) {
          setActiveAssessmentSession({
            id: activeSession.id,
            managerId: activeSession.manager_id,
            date: activeSession.date,
            location: activeSession.location,
            employeeIds: activeSession.employee_ids || [],
            notes: activeSession.notes,
            status: activeSession.status,
            lockedBy: activeSession.locked_by,
            lockedAt: activeSession.locked_at,
            expiresAt: activeSession.expires_at,
            createdAt: activeSession.created_at,
            updatedAt: activeSession.updated_at
          });
        }
      }



      // Load certifications
      const certsResponse = await apiRequest('/api/certifications');
      if (certsResponse.ok) {
        const certsData = await certsResponse.json();
        const mappedCerts = certsData.map((cert: any) => ({
          id: cert.id,
          employeeId: cert.employee_id,
          certificationType: cert.certification_type,
          dateCompleted: cert.date_completed,
          score: cert.score,
          passingScore: cert.passing_score,
          passed: cert.passed,
          checklistResults: cert.checklist_results || [],
          certifiedBy: cert.certified_by,
          notes: cert.notes,
          createdAt: cert.created_at
        }));
        setCertifications(mappedCerts);
      }

    } catch (error) {
      console.error('Error loading data:', error);
      // Fallback to demo data if API fails
      loadDemoData();
    } finally {
      setLoading(false);
    }
  };

  const loadDemoData = () => {
    console.log('Loading demo data...');
    // Load demo employees
    const demoEmployees: Employee[] = [
      {
        id: '1',
        first_name: 'Alex',
        last_name: 'Johnson',
        email: 'alex.johnson@goldenscoop.com',
        role: 'Super Scooper',
        profileImageUrl: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=2',
        isActive: true,
        hasSystemAccess: false,
        allergies: ['Nuts', 'Dairy'],
        emergencyContacts: [
          { name: 'Sarah Johnson', relationship: 'Mother', phone: '555-0123' }
        ],
        interestsMotivators: ['Music', 'Art', 'Praise and recognition'],
        challenges: ['Loud noises', 'Sudden changes'],
        regulationStrategies: ['5-minute breaks', 'Visual schedules', 'Calm voice'],
        last_login: null,
        createdAt: '2024-01-15T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z'
      },
      {
        id: '2',
        first_name: 'Emma',
        last_name: 'Davis',
        email: 'emma.davis@goldenscoop.com',
        role: 'Super Scooper',
        profileImageUrl: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=2',
        isActive: true,
        hasSystemAccess: false,
        allergies: [],
        emergencyContacts: [
          { name: 'Mike Davis', relationship: 'Father', phone: '555-0456' }
        ],
        interestsMotivators: ['Animals', 'Colorful stickers', 'Team activities'],
        challenges: ['Complex instructions'],
        regulationStrategies: ['Break tasks into steps', 'Use positive reinforcement'],
        last_login: null,
        createdAt: '2024-01-20T00:00:00Z',
        updatedAt: '2024-01-20T00:00:00Z'
      }
    ];

    // Load demo goal templates
    const demoTemplates: GoalTemplate[] = [
      {
        id: '1',
        name: 'Ice Cream Flavors Knowledge',
        goalStatement: 'Employee will demonstrate knowledge of all ice cream flavors and their ingredients',
        defaultMasteryCriteria: '3 consecutive assessments with all required steps Correct',
        relativeTargetDuration: '90 days',
        status: 'active',
        steps: [
          {
            id: '1',
            stepOrder: 1,
            stepDescription: 'Name all available ice cream flavors',
            isRequired: true
          },
          {
            id: '2',
            stepOrder: 2,
            stepDescription: 'Identify ingredients in each flavor',
            isRequired: true
          }
        ]
      }
    ];

    // Load demo development goals
    const demoGoals: DevelopmentGoal[] = [
      {
        id: '1',
        employeeId: '1',
        title: 'Ice Cream Flavors Knowledge',
        description: 'Learn all ice cream flavors and their ingredients',
        startDate: '2024-01-15',
        targetEndDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'active',
        masteryAchieved: false,
        consecutiveAllCorrect: 1,
        steps: [
          {
            id: '1',
            stepOrder: 1,
            stepDescription: 'Name all available ice cream flavors',
            isRequired: true
          },
          {
            id: '2',
            stepOrder: 2,
            stepDescription: 'Identify ingredients in each flavor',
            isRequired: true
          }
        ]
      }
    ];

    setEmployees(demoEmployees);
    setGoalTemplates(demoTemplates);
    setDevelopmentGoals(demoGoals);
    setStepProgress([]);
    console.log('Demo data loaded successfully');
  };

  const addEmployee = async (employeeData: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const response = await apiRequest('/api/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: employeeData.first_name,
          last_name: employeeData.last_name,
          email: employeeData.email,
          role: employeeData.role,
          profile_image_url: employeeData.profileImageUrl,
          is_active: employeeData.isActive,
          has_system_access: employeeData.hasSystemAccess,
          ...(employeeData.hasSystemAccess && employeeData.password && { password: employeeData.password }),
          allergies: employeeData.allergies,
          emergency_contacts: employeeData.emergencyContacts,
          interests_motivators: employeeData.interestsMotivators,
          challenges: employeeData.challenges,
          regulation_strategies: employeeData.regulationStrategies
        }),
      });

      if (response.ok) {
        const newEmployee = await response.json();
        const mappedEmployee = {
          id: newEmployee.id,
          first_name: newEmployee.first_name,
          last_name: newEmployee.last_name,
          email: newEmployee.email,
          role: newEmployee.role,
          profileImageUrl: newEmployee.profile_image_url,
          isActive: newEmployee.is_active,
          hasSystemAccess: newEmployee.has_system_access || false,
          allergies: newEmployee.allergies || [],
          emergencyContacts: newEmployee.emergency_contacts || [],
          interestsMotivators: newEmployee.interests_motivators || [],
          challenges: newEmployee.challenges || [],
          regulationStrategies: newEmployee.regulation_strategies || [],
          last_login: newEmployee.last_login || null,
          createdAt: newEmployee.created_at,
          updatedAt: newEmployee.updated_at
        };
        setEmployees(prev => [...prev, mappedEmployee]);
      } else if (response.status === 409) {
        const error = await response.json();
        throw new Error(error.error || 'Employee with this email already exists');
      } else {
        throw new Error('Failed to add employee');
      }
    } catch (error) {
      console.error('Error adding employee:', error);
      throw error;
    }
  };

  const updateEmployee = async (id: string, updates: Partial<Employee>) => {
    try {
      const updateData: any = {};
      if (updates.first_name) updateData.first_name = updates.first_name;
      if (updates.last_name) updateData.last_name = updates.last_name;
      if (updates.email) updateData.email = updates.email;
      if (updates.role) updateData.role = updates.role;
      if (updates.profileImageUrl !== undefined) updateData.profile_image_url = updates.profileImageUrl;
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
      if (updates.hasSystemAccess !== undefined) updateData.has_system_access = updates.hasSystemAccess;
      if (updates.allergies) updateData.allergies = updates.allergies;
      if (updates.emergencyContacts) updateData.emergency_contacts = updates.emergencyContacts;
      if (updates.interestsMotivators) updateData.interests_motivators = updates.interestsMotivators;
      if (updates.challenges) updateData.challenges = updates.challenges;
      if (updates.regulationStrategies) updateData.regulation_strategies = updates.regulationStrategies;

      const response = await apiRequest(`/api/employees/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        const updatedEmployee = await response.json();
        const mappedEmployee = {
          id: updatedEmployee.id,
          first_name: updatedEmployee.first_name,
          last_name: updatedEmployee.last_name,
          email: updatedEmployee.email,
          role: updatedEmployee.role,
          profileImageUrl: updatedEmployee.profile_image_url,
          isActive: updatedEmployee.is_active,
          hasSystemAccess: updatedEmployee.has_system_access || false,
          allergies: updatedEmployee.allergies || [],
          emergencyContacts: updatedEmployee.emergency_contacts || [],
          interestsMotivators: updatedEmployee.interests_motivators || [],
          challenges: updatedEmployee.challenges || [],
          regulationStrategies: updatedEmployee.regulation_strategies || [],
          last_login: updatedEmployee.last_login || null,
          createdAt: updatedEmployee.created_at,
          updatedAt: updatedEmployee.updated_at
        };
        setEmployees(prev => prev.map(emp => emp.id === id ? mappedEmployee : emp));
      }
    } catch (error) {
      console.error('Error updating employee:', error);
    }
  };

  // NEW ASSESSMENT SESSION FUNCTIONS
  const createAssessmentSession = async (employeeIds: string[], location?: string): Promise<{ success: boolean; error?: string; lockedEmployees?: any[]; lockedByManagers?: any[] }> => {
    try {
      console.log('Creating assessment session with employees:', employeeIds, 'location:', location);
      
      const managerId = user?.id || 'demo-manager';
      
      const sessionData = {
        manager_id: managerId,
        date: new Date().toISOString().split('T')[0],
        location: location || '9540 Nall Avenue',
        employee_ids: employeeIds,
        notes: null
      };
      
      console.log('Sending assessment session data:', sessionData);
      
      const response = await apiRequest('/api/assessment-sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sessionData),
      });
      
      if (response.ok) {
        const newSession = await response.json();
        console.log('Received new assessment session:', newSession);
        
        setActiveAssessmentSession({
          id: newSession.id,
          managerId: newSession.manager_id,
          date: newSession.date,
          location: newSession.location,
          employeeIds: newSession.employee_ids || [],
          notes: newSession.notes,
          status: newSession.status,
          lockedBy: newSession.locked_by,
          lockedAt: newSession.locked_at,
          expiresAt: newSession.expires_at,
          createdAt: newSession.created_at,
          updatedAt: newSession.updated_at
        });
        
        console.log('Active assessment session updated successfully');
        return { success: true };
      } else if (response.status === 409) {
        // Conflict - employees are locked
        const errorData = await response.json();
        console.error('Employees are locked:', errorData);
        return { 
          success: false, 
          error: errorData.error,
          lockedEmployees: errorData.lockedEmployees,
          lockedByManagers: errorData.lockedByManagers
        };
      } else {
        const errorText = await response.text();
        console.error('Failed to create assessment session:', response.status, errorText);
        return { success: false, error: `Failed to create assessment session: ${response.status}` };
      }
    } catch (error) {
      console.error('Error creating assessment session:', error);
      return { success: false, error: String(error) };
    }
  };

  const endAssessmentSession = async () => {
    if (!activeAssessmentSession) return;
    
    try {
      // Complete the session (releases lock)
      await completeAssessmentSession(activeAssessmentSession.id);
      setActiveAssessmentSession(null);
    } catch (error) {
      console.error('Error ending assessment session:', error);
    }
  };

  const completeAssessmentSession = async (sessionId: string) => {
    try {
      const response = await apiRequest(`/api/assessment-sessions/${sessionId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Failed to complete assessment session');
      }
    } catch (error) {
      console.error('Error completing assessment session:', error);
    }
  };

  const renewAssessmentSession = async (sessionId: string) => {
    try {
      const response = await apiRequest(`/api/assessment-sessions/${sessionId}/renew`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const renewedSession = await response.json();
        // Update the active session if it's the one being renewed
        if (activeAssessmentSession && activeAssessmentSession.id === sessionId) {
          setActiveAssessmentSession({
            ...activeAssessmentSession,
            expiresAt: renewedSession.expires_at,
            updatedAt: renewedSession.updated_at
          });
        }
      }
    } catch (error) {
      console.error('Error renewing assessment session:', error);
    }
  };

  const updateAssessmentSessionEmployees = async (sessionId: string, employeeIds: string[]) => {
    try {
      const response = await apiRequest(`/api/assessment-sessions/${sessionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ employee_ids: employeeIds }),
      });

      if (response.ok) {
        const updatedSession = await response.json();
        // Update the active session
        if (activeAssessmentSession && activeAssessmentSession.id === sessionId) {
          setActiveAssessmentSession({
            ...activeAssessmentSession,
            employeeIds: updatedSession.employee_ids,
            updatedAt: updatedSession.updated_at
          });
        }
        return { success: true };
      } else {
        console.error('Failed to update assessment session employees');
        return { success: false, error: 'Failed to update session' };
      }
    } catch (error) {
      console.error('Error updating assessment session employees:', error);
      return { success: false, error: String(error) };
    }
  };

  const checkEmployeeLocks = async (employeeIds: string[]): Promise<{ locked: any[]; available: string[] }> => {
    try {
      const response = await apiRequest('/api/assessment-sessions/check-locks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ employee_ids: employeeIds }),
      });

      if (response.ok) {
        return await response.json();
      }
      return { locked: [], available: [] };
    } catch (error) {
      console.error('Error checking employee locks:', error);
      return { locked: [], available: [] };
    }
  };

  const saveAssessmentSummary = async (employeeId: string, summary: string) => {
    if (!activeAssessmentSession) return;
    
    try {
      const response = await apiRequest('/api/assessment-summaries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employee_id: employeeId,
          assessment_session_id: activeAssessmentSession.id,
          date: new Date().toISOString().split('T')[0],
          summary: summary
        }),
      });

      if (response.ok) {
        const newSummary = await response.json();
        const mappedSummary = {
          id: newSummary.id,
          employeeId: newSummary.employee_id,
          assessmentSessionId: newSummary.assessment_session_id,
          date: newSummary.date,
          summary: newSummary.summary,
          createdAt: newSummary.created_at,
          updatedAt: newSummary.updated_at
        };
        
        setAssessmentSummaries(prev => {
          const filtered = prev.filter(s => 
            !(s.employeeId === employeeId && s.assessmentSessionId === activeAssessmentSession.id)
          );
          return [...filtered, mappedSummary];
        });
      }
    } catch (error) {
      console.error('Error saving assessment summary:', error);
    }
  };


  const recordStepProgress = async (progress: Omit<StepProgress, 'id' | 'date'>) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const response = await apiRequest('/api/step-progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          development_goal_id: progress.developmentGoalId,
          goal_step_id: progress.goalStepId,
          employee_id: progress.employeeId,
          assessment_session_id: progress.assessmentSessionId,

          date: today,
          outcome: progress.outcome,
          notes: progress.notes
        }),
      });

      if (response.ok) {
        const newProgress = await response.json();
        const mappedProgress = {
          id: newProgress.id,
          developmentGoalId: newProgress.development_goal_id,
          goalStepId: newProgress.goal_step_id,
          employeeId: newProgress.employee_id,
          assessmentSessionId: newProgress.assessment_session_id,
          date: newProgress.date,
          outcome: newProgress.outcome,
          notes: newProgress.notes
        };
        
        setStepProgress(prev => {
          const filtered = prev.filter(p => 
            !(p.developmentGoalId === progress.developmentGoalId &&
              p.goalStepId === progress.goalStepId &&
              p.employeeId === progress.employeeId &&
              p.date === today)
          );
          return [...filtered, mappedProgress];
        });
        
        // Update goal progress
        updateGoalProgress(progress.developmentGoalId, progress.employeeId);
      }
    } catch (error) {
      console.error('Error recording step progress:', error);
    }
  };

  // Save step progress as draft
  const saveStepProgressDraft = async (progress: Omit<StepProgress, 'id' | 'date'>, documenterUserId: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const response = await apiRequest('/api/step-progress/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          development_goal_id: progress.developmentGoalId,
          goal_step_id: progress.goalStepId,
          employee_id: progress.employeeId,
          assessment_session_id: progress.assessmentSessionId,

          documenter_user_id: documenterUserId,
          date: today,
          outcome: progress.outcome,
          notes: progress.notes
        }),
      });

      if (response.ok) {
        const newProgress = await response.json();
        const mappedProgress = {
          id: newProgress.id,
          developmentGoalId: newProgress.development_goal_id,
          goalStepId: newProgress.goal_step_id,
          employeeId: newProgress.employee_id,
          assessmentSessionId: newProgress.assessment_session_id,
          date: newProgress.date,
          outcome: newProgress.outcome,
          notes: newProgress.notes,
          status: newProgress.status
        };
        
        setStepProgress(prev => {
          const filtered = prev.filter(p => 
            !(p.developmentGoalId === progress.developmentGoalId &&
              p.goalStepId === progress.goalStepId &&
              p.employeeId === progress.employeeId &&
              p.date === today)
          );
          return [...filtered, mappedProgress];
        });
      }
    } catch (error) {
      console.error('Error saving step progress draft:', error);
    }
  };

  // Submit all draft progress for an employee
  const submitStepProgress = async (employeeId: string, documenterUserId: string, assessmentSessionId?: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const response = await apiRequest('/api/step-progress/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employee_id: employeeId,
          documenter_user_id: documenterUserId,
          assessment_session_id: assessmentSessionId,
          date: today
        }),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Reload step progress and development goals to get updated data
        await loadData();
        
        return result;
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit progress');
      }
    } catch (error) {
      console.error('Error submitting step progress:', error);
      throw error;
    }
  };

  // Load user-specific drafts and merge with existing step progress
  const loadUserDrafts = async (userId: string) => {
    try {
      const response = await apiRequest(`/api/step-progress/drafts/${userId}`);
      if (response.ok) {
        const draftsData = await response.json();
        const mappedDrafts = draftsData.map((progress: any) => ({
          id: progress.id,
          developmentGoalId: progress.development_goal_id,
          goalStepId: progress.goal_step_id,
          employeeId: progress.employee_id,
          assessmentSessionId: progress.assessment_session_id,

          date: progress.date,
          outcome: progress.outcome,
          notes: progress.notes,
          status: progress.status || 'draft'
        }));

        // Merge with existing submitted progress, removing any old drafts for this user
        setStepProgress(prev => {
          const filteredSubmitted = prev.filter(p => p.status !== 'draft');
          return [...filteredSubmitted, ...mappedDrafts];
        });
      }
    } catch (error) {
      console.error('Error loading user drafts:', error);
    }
  };

  const updateGoalProgressDemo = (goalId: string, employeeId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const todayProgress = stepProgress.filter(p => 
      p.developmentGoalId === goalId && 
      p.employeeId === employeeId && 
      p.date === today
    );

    const goal = developmentGoals.find(g => g.id === goalId);
    if (!goal) return;

    const requiredSteps = goal.steps.filter(s => s.isRequired);
    const completedCorrectly = todayProgress.filter(p => p.outcome === 'correct').length;
    const allCorrectToday = completedCorrectly === requiredSteps.length;

    const newConsecutive = allCorrectToday ? goal.consecutiveAllCorrect + 1 : 0;
    const masteryAchieved = newConsecutive >= 3;
    
    setDevelopmentGoals(prev => prev.map(g => {
      if (g.id === goalId) {
        return {
          ...g,
          consecutiveAllCorrect: newConsecutive,
          masteryAchieved,
          masteryDate: masteryAchieved && !g.masteryAchieved ? today : g.masteryDate,
          status: masteryAchieved ? 'maintenance' : g.status
        };
      }
      return g;
    }));
  };


  const updateGoalProgress = (goalId: string, employeeId: string) => {
    const updateProgressAsync = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const todayProgress = stepProgress.filter(p => 
          p.developmentGoalId === goalId && 
          p.employeeId === employeeId && 
          p.date === today
        );

        const goal = developmentGoals.find(g => g.id === goalId);
        if (!goal) return;

        const requiredSteps = goal.steps.filter(s => s.isRequired);
        const completedCorrectly = todayProgress.filter(p => p.outcome === 'correct').length;
        const allCorrectToday = completedCorrectly === requiredSteps.length;

        const newConsecutive = allCorrectToday ? goal.consecutiveAllCorrect + 1 : 0;
        const masteryAchieved = newConsecutive >= 3;
        
        const updates: any = {
          consecutive_all_correct: newConsecutive,
          mastery_achieved: masteryAchieved
        };

        if (masteryAchieved && !goal.masteryAchieved) {
          updates.mastery_date = today;
          updates.status = 'maintenance';
        }

        const response = await apiRequest(`/api/development-goals/${goalId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        });

        if (!response.ok) throw new Error('Failed to update goal');

        // Update local state
        setDevelopmentGoals(prev => prev.map(g => {
          if (g.id === goalId) {
            return {
              ...g,
              consecutiveAllCorrect: newConsecutive,
              masteryAchieved,
              masteryDate: masteryAchieved && !g.masteryAchieved ? today : g.masteryDate,
              status: masteryAchieved ? 'maintenance' : g.status
            };
          }
          return g;
        }));
      } catch (error) {
        console.error('Error updating goal progress:', error);
      }
    };

    updateProgressAsync();
  };

  const createGoalFromTemplate = async (templateId: string, employeeId: string) => {
    try {
      const template = goalTemplates.find(t => t.id === templateId);
      if (!template) return;

      // Create the goal
      const goalResponse = await apiRequest('/api/development-goals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employee_id: employeeId,
          title: template.name,
          description: template.goalStatement,
          start_date: new Date().toISOString().split('T')[0],
          target_end_date: calculateDateFromRelativeDuration(template.relativeTargetDuration || '90 days'),
          status: 'active',
          mastery_achieved: false,
          consecutive_all_correct: 0,
          steps: template.steps.map(step => ({
            step_order: step.stepOrder,
            step_description: step.stepDescription,
            is_required: step.isRequired
          }))
        }),
      });

      if (goalResponse.ok) {
        // Reload the data to get the updated goals with steps
        await loadData();
      } else {
        console.error('Failed to create goal from template:', await goalResponse.text());
        throw new Error('Failed to create goal from template');
      }
    } catch (error) {
      console.error('Error creating goal from template:', error);
    }
  };

  const addGoalTemplate = async (templateData: Omit<GoalTemplate, 'id'>) => {
    try {
      const response = await apiRequest('/api/goal-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: templateData.name,
          goal_statement: templateData.goalStatement,
          default_mastery_criteria: templateData.defaultMasteryCriteria,
          relative_target_duration: templateData.relativeTargetDuration,
          status: templateData.status,
          steps: templateData.steps.map(step => ({
            stepDescription: step.stepDescription,
            isRequired: step.isRequired
          }))
        }),
      });

      if (response.ok) {
        // Reload templates to get the new one with proper structure
        await loadData();
      } else {
        console.error('Failed to add goal template:', await response.text());
      }
    } catch (error) {
      console.error('Error adding goal template:', error);
    }
  };

  const updateGoalTemplate = async (templateId: string, templateData: Omit<GoalTemplate, 'id'>) => {
    try {
      const response = await apiRequest(`/api/goal-templates/${templateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: templateData.name,
          goal_statement: templateData.goalStatement,
          default_mastery_criteria: templateData.defaultMasteryCriteria,
          relative_target_duration: templateData.relativeTargetDuration,
          status: templateData.status,
          steps: templateData.steps.map(step => ({
            stepDescription: step.stepDescription,
            isRequired: step.isRequired
          }))
        }),
      });

      if (response.ok) {
        // Reload templates to get the updated structure
        await loadData();
      }
    } catch (error) {
      console.error('Error updating goal template:', error);
    }
  };

  const archiveGoalTemplate = async (templateId: string) => {
    try {
      const response = await apiRequest(`/api/goal-templates/${templateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'archived' }),
      });

      if (response.ok) {
        // Update the local state
        setGoalTemplates(prev => prev.map(template => 
          template.id === templateId 
            ? { ...template, status: 'archived' as const }
            : template
        ));
      }
    } catch (error) {
      console.error('Error archiving goal template:', error);
    }
  };

  const updateGoal = async (goalId: string, updates: Partial<DevelopmentGoal>) => {
    try {
      const updateData: any = {};
      if (updates.title) updateData.title = updates.title;
      if (updates.description) updateData.description = updates.description;
      if (updates.startDate) updateData.start_date = updates.startDate;
      if (updates.targetEndDate) updateData.target_end_date = updates.targetEndDate;
      if (updates.status) updateData.status = updates.status;
      if (updates.masteryAchieved !== undefined) updateData.mastery_achieved = updates.masteryAchieved;
      if (updates.masteryDate) updateData.mastery_date = updates.masteryDate;
      if (updates.consecutiveAllCorrect !== undefined) updateData.consecutive_all_correct = updates.consecutiveAllCorrect;

      const response = await apiRequest(`/api/development-goals/${goalId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        const updatedGoal = await response.json();
        setDevelopmentGoals(prev => prev.map(goal => 
          goal.id === goalId 
            ? { 
                ...goal, 
                title: updatedGoal.title,
                description: updatedGoal.description,
                startDate: updatedGoal.start_date,
                targetEndDate: updatedGoal.target_end_date,
                status: updatedGoal.status,
                masteryAchieved: updatedGoal.mastery_achieved,
                masteryDate: updatedGoal.mastery_date,
                consecutiveAllCorrect: updatedGoal.consecutive_all_correct
              }
            : goal
        ));
      }
    } catch (error) {
      console.error('Error updating goal:', error);
    }
  };

  const archiveGoal = async (goalId: string) => {
    try {
      const response = await apiRequest(`/api/development-goals/${goalId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'archived' }),
      });

      if (response.ok) {
        setDevelopmentGoals(prev => prev.map(goal => 
          goal.id === goalId 
            ? { ...goal, status: 'archived' as const }
            : goal
        ));
      }
    } catch (error) {
      console.error('Error archiving goal:', error);
    }
  };

  const refreshCertifications = async () => {
    try {
      const certsResponse = await apiRequest('/api/certifications');
      if (certsResponse.ok) {
        const certsData = await certsResponse.json();
        const mappedCerts = certsData.map((cert: any) => ({
          id: cert.id,
          employeeId: cert.employee_id,
          certificationType: cert.certification_type,
          dateCompleted: cert.date_completed,
          score: cert.score,
          passingScore: cert.passing_score,
          passed: cert.passed,
          checklistResults: cert.checklist_results || [],
          certifiedBy: cert.certified_by,
          notes: cert.notes,
          createdAt: cert.created_at
        }));
        setCertifications(mappedCerts);
      }
    } catch (error) {
      console.error('Error refreshing certifications:', error);
    }
  };

  const addCertification = async (cert: Omit<PromotionCertification, 'id' | 'createdAt'>): Promise<PromotionCertification | null> => {
    try {
      const response = await apiRequest('/api/certifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: cert.employeeId,
          certification_type: cert.certificationType,
          date_completed: cert.dateCompleted,
          score: cert.score,
          passing_score: cert.passingScore,
          passed: cert.passed,
          checklist_results: cert.checklistResults,
          certified_by: cert.certifiedBy || null,
          notes: cert.notes || null
        }),
      });

      if (response.ok) {
        const newCert = await response.json();
        const mapped: PromotionCertification = {
          id: newCert.id,
          employeeId: newCert.employee_id,
          certificationType: newCert.certification_type,
          dateCompleted: newCert.date_completed,
          score: newCert.score,
          passingScore: newCert.passing_score,
          passed: newCert.passed,
          checklistResults: newCert.checklist_results || [],
          certifiedBy: newCert.certified_by,
          notes: newCert.notes,
          createdAt: newCert.created_at
        };
        setCertifications(prev => [mapped, ...prev]);
        return mapped;
      }
      return null;
    } catch (error) {
      console.error('Error adding certification:', error);
      return null;
    }
  };

  const deleteCertification = async (id: string) => {
    try {
      const response = await apiRequest(`/api/certifications/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setCertifications(prev => prev.filter(c => c.id !== id));
      }
    } catch (error) {
      console.error('Error deleting certification:', error);
    }
  };

  // Set loading to false after data is loaded
  useEffect(() => {
    if (employees.length > 0 || goalTemplates.length > 0) {
      setLoading(false);
    }
  }, [employees, goalTemplates]);

  // Show loading screen only for the first few seconds
  const [showLoading, setShowLoading] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLoading(false);
      setLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  if (loading && showLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Golden Scoop...</p>
          <p className="text-sm text-gray-500 mt-2">Setting up demo data</p>
        </div>
      </div>
    );
  }

  return (
    <DataContext.Provider value={{
      employees,
      activeAssessmentSession,
      assessmentSummaries,
      developmentGoals,
      goalTemplates,
      stepProgress,
      addEmployee,
      updateEmployee,
      createAssessmentSession,
      endAssessmentSession,
      completeAssessmentSession,
      renewAssessmentSession,
      updateAssessmentSessionEmployees,
      checkEmployeeLocks,
      saveAssessmentSummary,
      recordStepProgress,
      saveStepProgressDraft,
      submitStepProgress,
      loadUserDrafts,
      createGoalFromTemplate,
      addGoalTemplate,
      updateGoalTemplate,
      archiveGoalTemplate,
      updateGoal,
      archiveGoal,
      certifications,
      addCertification,
      deleteCertification,
      refreshCertifications
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}