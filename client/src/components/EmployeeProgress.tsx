import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Target, CheckCircle, AlertCircle, Clock, MessageSquare, Save, ChevronDown, ChevronUp, User, Phone, Heart, Brain, Shield, Zap, AlertTriangle, ChevronRight, FileText, Edit, Plus, Send, Archive, X } from 'lucide-react';
import { useData, Employee } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/use-toast';
import GoalAssignment from './GoalAssignment';
import AssessmentHistory from './AssessmentHistory';
import Timer from './Timer';

// Move OutcomeSelector outside the main component to prevent recreation on every render
const OutcomeSelector = ({ 
  value, 
  onChange, 
  disabled = false,
  stepId
}: { 
  value?: 'correct' | 'verbal_prompt' | 'na' | 'incorrect'; 
  onChange: (value: 'correct' | 'verbal_prompt' | 'na' | 'incorrect') => void;
  disabled?: boolean;
  stepId: string;
}) => {
  const options = [
    { 
      value: 'correct' as const, 
      label: 'Correct', 
      textColor: 'text-green-700', 
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      hoverColor: 'hover:bg-green-100'
    },
    { 
      value: 'incorrect' as const, 
      label: 'Incorrect', 
      textColor: 'text-white', 
      bgColor: 'bg-red-600',
      borderColor: 'border-red-700',
      hoverColor: 'hover:bg-red-700'
    },
    { 
      value: 'verbal_prompt' as const, 
      label: 'Verbal Prompt', 
      textColor: 'text-yellow-700', 
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      hoverColor: 'hover:bg-yellow-100'
    },
    { 
      value: 'na' as const, 
      label: 'N/A', 
      textColor: 'text-slate-700', 
      bgColor: 'bg-slate-100',
      borderColor: 'border-slate-300',
      hoverColor: 'hover:bg-slate-200'
    }
  ];

  const handleClick = (optionValue: 'correct' | 'verbal_prompt' | 'na' | 'incorrect') => {
    if (!disabled) {
      onChange(optionValue);
    }
  };
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Outcome selection">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          aria-pressed={value === option.value}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleClick(option.value);
          }}
          className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all duration-200 ${
            value === option.value
              ? `${option.bgColor} ${option.textColor} ${option.borderColor} shadow-sm`
              : option.value === 'incorrect'
              ? `bg-white text-gray-600 border-gray-300 hover:bg-red-50`
              : `bg-white text-gray-600 border-gray-300 ${option.hoverColor}`
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-sm'}`}
          data-testid={`button-outcome-${option.value}-${stepId}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

interface EmployeeProgressProps {
  employee: Employee;
  assessmentSessionId?: string;
  shiftId?: string; // Legacy support
  onViewProfile?: () => void;
  onEditEmployee?: (employeeId: string) => void;
}

export default function EmployeeProgress({ employee, assessmentSessionId, shiftId, onViewProfile, onEditEmployee }: EmployeeProgressProps) {
  const { user } = useAuth();
  const { developmentGoals, stepProgress, recordStepProgress, saveAssessmentSummary, assessmentSummaries, saveStepProgressDraft, submitStepProgress, updateGoal, archiveGoal, loadUserDrafts } = useData();
  const { toast } = useToast();
  const [outcomes, setOutcomes] = useState<Record<string, { outcome: 'correct' | 'verbal_prompt' | 'na' | 'incorrect'; notes: string }>>({});
  const [showNotes, setShowNotes] = useState<Record<string, boolean>>({});
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [timerData, setTimerData] = useState<Record<string, { seconds: number; manuallyEntered: boolean }>>({}); // Timer state for each step
  const [showHistory, setShowHistory] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSupportDetails, setShowSupportDetails] = useState(false);
  const [showGoalAssignment, setShowGoalAssignment] = useState(false);
  const [editingGoal, setEditingGoal] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    targetEndDate: ''
  });
  const [shiftSummary, setShiftSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [includedGoals, setIncludedGoals] = useState<Record<string, boolean>>({});
  const [showGoalSelectionBanner, setShowGoalSelectionBanner] = useState(false);

  // Check if user has seen the goal selection banner before
  useEffect(() => {
    const hasSeenBanner = localStorage.getItem('hasSeenGoalSelectionBanner');
    if (!hasSeenBanner) {
      setShowGoalSelectionBanner(true);
    }
  }, []);

  const dismissGoalSelectionBanner = () => {
    localStorage.setItem('hasSeenGoalSelectionBanner', 'true');
    setShowGoalSelectionBanner(false);
  };

  // Load user drafts when component mounts or user changes
  useEffect(() => {
    if (user?.id) {
      loadUserDrafts(user.id);
    }
  }, [user?.id, loadUserDrafts]);
  
  const employeeGoals = developmentGoals.filter(goal => 
    goal.employeeId === employee.id && goal.status === 'active'
  );

  // Initialize all goals as included by default
  useEffect(() => {
    const initialIncluded: Record<string, boolean> = {};
    employeeGoals.forEach(goal => {
      initialIncluded[goal.id] = true;
    });
    setIncludedGoals(initialIncluded);
  }, [employeeGoals.length]);

  const toggleGoalInclusion = (goalId: string) => {
    setIncludedGoals(prev => ({
      ...prev,
      [goalId]: !prev[goalId]
    }));
  };
  
  // On active shifts, expand goals by default
  const [expandedGoals, setExpandedGoals] = useState<Record<string, boolean>>(() => {
    const initialExpanded: Record<string, boolean> = {};
    employeeGoals.forEach(goal => {
      initialExpanded[goal.id] = true; // Expanded by default on active shifts
    });
    return initialExpanded;
  });

  const toggleGoalExpansion = (goalId: string) => {
    setExpandedGoals(prev => ({
      ...prev,
      [goalId]: !prev[goalId]
    }));
  };

  const today = new Date().toISOString().split('T')[0];
  const todayProgress = stepProgress.filter(p => 
    p.employeeId === employee.id && 
    p.date === today &&
    (assessmentSessionId ? p.assessmentSessionId === assessmentSessionId : true)
  );

  // Get existing summary (assessment only)
  const existingSummary = assessmentSummaries.find((s: any) => 
    s.employeeId === employee.id && 
    s.assessmentSessionId === assessmentSessionId &&
    s.date === today
  );

  // Use a ref to track if we've initialized to prevent re-initialization
  const initializedRef = useRef<string | null>(null);
  
  // Create a stable serialization of todayProgress to detect content changes
  const progressKey = useMemo(() => {
    return todayProgress
      .map(p => `${p.goalStepId}:${p.outcome}:${p.notes || ''}`)
      .sort()
      .join('|');
  }, [todayProgress]);
  
  useEffect(() => {
    // Initialize or update when employee changes or when today's progress is loaded
    const initialOutcomes: Record<string, { outcome: 'correct' | 'verbal_prompt' | 'na' | 'incorrect'; notes: string }> = {};
    const initialLocalNotes: Record<string, string> = {};
    
    todayProgress.forEach(progress => {
      const stepId = progress.goalStepId;
      // Only populate if there's an outcome (to distinguish between no data and explicit data)
      if (progress.outcome) {
        initialOutcomes[stepId] = {
          outcome: progress.outcome,
          notes: progress.notes || ''
        };
        initialLocalNotes[stepId] = progress.notes || '';
      }
    });
    
    // Update outcomes whenever we have draft data or when employee changes
    setOutcomes(initialOutcomes);
    setLocalNotes(initialLocalNotes);
    
    // Only reset unsaved changes flag when employee changes (not on draft load)
    if (initializedRef.current !== employee.id) {
      setHasUnsavedChanges(false);
      initializedRef.current = employee.id;
    }
  }, [employee.id, progressKey]); // Re-run when employee or progress content changes

  useEffect(() => {
    // Initialize shift summary with existing data
    if (existingSummary) {
      setShiftSummary(existingSummary.summary);
    }
  }, [existingSummary]);

  const handleOutcomeChange = (goalId: string, stepId: string, outcome: 'correct' | 'verbal_prompt' | 'na' | 'incorrect') => {
    const key = stepId;
    // Auto-open notes section for verbal prompts
    if (outcome === 'verbal_prompt') {
      setShowNotes(prev => ({ ...prev, [key]: true }));
    } else if (outcome === 'na') {
      // Close notes section for N/A
      setShowNotes(prev => ({ ...prev, [key]: false }));
      // Clear notes for N/A
      setLocalNotes(prev => ({ ...prev, [key]: '' }));
    }
    
    // Update local state immediately for responsive UI
    const newOutcome = {
      outcome, 
      notes: outcome === 'na' ? '' : (localNotes[key] || outcomes[key]?.notes || '')
    };
    
    setOutcomes(prev => ({
      ...prev,
      [key]: newOutcome
    }));
    
    setHasUnsavedChanges(true);
  };

  const handleNotesChange = useCallback((goalId: string, stepId: string, notes: string) => {
    // Update local notes immediately for smooth typing
    setLocalNotes(prev => ({
      ...prev,
      [stepId]: notes
    }));
    
    setHasUnsavedChanges(true);
  }, []);

  const handleTimerChange = useCallback((stepId: string, timeInSeconds: number, manuallyEntered: boolean) => {
    setTimerData(prev => ({
      ...prev,
      [stepId]: { seconds: timeInSeconds, manuallyEntered }
    }));
    
    setHasUnsavedChanges(true);
  }, []);


  const handleSummaryChange = (summary: string) => {
    setShiftSummary(summary);
    setHasUnsavedChanges(true);
  };


  // Goal editing functions
  const handleEditGoal = (goal: any) => {
    setEditingGoal(goal.id);
    setEditForm({
      title: goal.title,
      description: goal.description,
      targetEndDate: goal.targetEndDate
    });
  };

  const handleSaveGoal = () => {
    if (editingGoal) {
      updateGoal(editingGoal, editForm);
      setEditingGoal(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingGoal(null);
    setEditForm({ title: '', description: '', targetEndDate: '' });
  };

  const handleArchiveGoal = (goalId: string, goalTitle: string) => {
    if (confirm(`Are you sure you want to archive "${goalTitle}"? This will move it to archived status.`)) {
      archiveGoal(goalId);
    }
  };

  // Assessment-level validation and actions
  const isSubmitEnabled = () => {
    // Only check required steps for goals that are included in the assessment
    const includedEmployeeGoals = employeeGoals.filter(goal => includedGoals[goal.id] !== false);
    
    // Check if all required steps across all included goals have been filled out
    const allRequiredSteps = includedEmployeeGoals.flatMap(goal => 
      goal.steps.filter(step => step.isRequired)
    );
    
    // If no required steps, just check if summary is filled or any step has outcome from included goals
    if (allRequiredSteps.length === 0) {
      // Only count outcomes for steps in included goals
      const includedGoalStepIds = new Set(
        includedEmployeeGoals.flatMap(goal => goal.steps.map(step => step.id))
      );
      const hasIncludedProgress = Object.keys(outcomes).some(stepId => includedGoalStepIds.has(stepId));
      const hasAnyProgress = hasIncludedProgress || shiftSummary.trim().length > 0;
      return hasAnyProgress;
    }
    
    const completedRequiredSteps = allRequiredSteps.filter(step => {
      const outcome = outcomes[step.id];
      const hasOutcome = outcome && outcome.outcome;
      
      // Check timer requirements (commented out as timerType is not in schema yet)
      // if (step.timerType === 'required') {
      //   const timerDuration = timerData[step.id]?.seconds || 0;
      //   if (timerDuration <= 0) {
      //     return false; // Required timer not completed
      //   }
      // }
      
      return hasOutcome; // Accept any outcome including 'na', 'correct', or 'verbal_prompt'
    });
    
    return completedRequiredSteps.length === allRequiredSteps.length;
  };

  // Assessment-level save and submit functions
  const handleSaveDraft = async () => {
    try {
      setIsSaving(true);
      
      // Save all outcomes only for included goals as drafts
      const allStepProgressData = [];
      const includedEmployeeGoals = employeeGoals.filter(goal => includedGoals[goal.id] !== false);
      
      for (const goal of includedEmployeeGoals) {
        for (const step of goal.steps) {
          const outcome = outcomes[step.id];
          const notes = localNotes[step.id] || '';
          const timer = timerData[step.id];
          
          if (outcome || notes.trim() || timer) {
            allStepProgressData.push({
              developmentGoalId: goal.id,
              goalStepId: step.id,
              employeeId: employee.id,
              assessmentSessionId: assessmentSessionId,
              outcome: outcome?.outcome || 'na',
              notes,
              completionTimeSeconds: timer?.seconds || undefined,
              timerManuallyEntered: timer?.manuallyEntered || false
            });
          }
        }
      }
      
      // Save all step progress as drafts
      for (const data of allStepProgressData) {
        await saveStepProgressDraft(data, user?.id || '');
      }
      
      // Save assessment summary
      if (shiftSummary.trim() && assessmentSessionId) {
        await saveAssessmentSummary(employee.id, shiftSummary.trim());
      }
      
      toast({
        type: 'success',
        title: 'Draft Saved!',
        description: 'Assessment and summary draft saved successfully',
        duration: 3000
      });
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error saving assessment draft:', error);
      toast({
        type: 'error',
        title: 'Save Failed',
        description: 'Error saving assessment draft. Please try again.',
        duration: 5000
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSaving(true);
      
      // First save all changes as drafts
      await handleSaveDraft();
      
      // Then submit all drafts
      const result = await submitStepProgress(employee.id, user?.id || '', assessmentSessionId);
      
      toast({
        type: 'success',
        title: 'Assessment Submitted!',
        description: `Successfully submitted ${result.submittedItems} goals and overall summary`,
        duration: 4000
      });
      
      // Reset unsaved changes state
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error submitting assessment:', error);
      toast({
        type: 'error',
        title: 'Submission Failed',
        description: 'Error submitting assessment. Please try again.',
        duration: 5000
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleViewPastAssessments = () => {
    setShowHistory(true);
  };

  const handleBackToAssessment = () => {
    setShowHistory(false);
  };
  
  // Navigation guard - prompt user about unsaved changes
  const handleNavigationAttempt = (callback: () => void) => {
    if (hasUnsavedChanges) {
      const userChoice = confirm(
        'You have unsaved changes to this assessment.\n\n' +
        'Choose OK to save a draft and continue, or Cancel to return and complete the assessment.'
      );
      
      if (userChoice) {
        // User chose to save draft and continue
        handleSaveDraft().then(() => {
          callback();
        }).catch(() => {
          toast({
            type: 'error',
            title: 'Save Error',
            description: 'Error saving draft. Please try again.',
            duration: 5000
          });
        });
      }
      // If user chose Cancel, do nothing (stay on current screen)
    } else {
      // No unsaved changes, proceed with navigation
      callback();
    }
  };

  // Auto-save when leaving the page
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes to this assessment. Save a draft before leaving?';
        return 'You have unsaved changes to this assessment. Save a draft before leaving?';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const getGoalProgress = (goal: any) => {
    const requiredSteps = goal.steps.filter((step: any) => step.isRequired);
    const todayRequiredProgress = todayProgress.filter(p => {
      const step = goal.steps.find((s: any) => s.id === p.goalStepId);
      return step?.isRequired && p.outcome === 'correct';
    });
    
    return {
      completedToday: todayRequiredProgress.length,
      totalRequired: requiredSteps.length,
      allCorrectToday: todayRequiredProgress.length === requiredSteps.length,
      consecutiveStreak: goal.consecutiveAllCorrect
    };
  };

  if (showGoalAssignment) {
    return (
      <GoalAssignment
        employeeId={employee.id}
        onClose={() => setShowGoalAssignment(false)}
        onSuccess={() => setShowGoalAssignment(false)}
      />
    );
  }

  // Show assessment history if requested
  if (showHistory) {
    return (
      <AssessmentHistory
        employee={employee}
        onBackToAssessment={handleBackToAssessment}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Employee Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
              <span className="text-lg sm:text-xl font-semibold text-gray-600">
                {`${employee.first_name[0] || ''}${employee.last_name[0] || ''}`.toUpperCase()}
              </span>
            </div>
            
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900">{`${employee.first_name} ${employee.last_name}`}</h1>
              <p className="text-gray-500 text-sm sm:text-base">{employee.role}</p>
            </div>
          </div>

          <button
            onClick={() => setShowSupportDetails(!showSupportDetails)}
            className="flex items-center justify-center sm:justify-start space-x-2 px-4 py-3 bg-white border border-blue-300 text-blue-600 rounded-xl hover:bg-blue-50 transition-colors text-sm font-medium w-full sm:w-auto"
          >
            <div className="h-5 w-5 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">i</span>
            </div>
            <span>About Me</span>
            {showSupportDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {/* Allergies - Prominent Safety Information */}
        {employee.allergies.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
            <span className="text-sm font-semibold text-red-800">Allergies:</span>
            {employee.allergies.map((allergy, index) => (
              <span
                key={index}
                className="px-3 py-1.5 bg-red-100 text-red-800 rounded-full text-sm"
              >
                {allergy}
              </span>
            ))}
          </div>
        )}

        {/* Expandable Support Details */}
        {showSupportDetails && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Header */}
              <div className="lg:col-span-3 flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Heart className="h-5 w-5 text-pink-500" />
                  <h2 className="text-xl font-semibold text-gray-900">About Me</h2>
                </div>
                {user?.role === 'Administrator' && onEditEmployee && (
                  <button
                    onClick={() => onEditEmployee(employee.id)}
                    className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-xl hover:bg-gray-700 transition-colors"
                    data-testid="button-edit-employee"
                  >
                    <Edit className="h-4 w-4" />
                    <span>Edit</span>
                  </button>
                )}
              </div>

              {/* Interests & Motivators */}
              {employee.interestsMotivators.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Interests & Motivators</h3>
                  <div className="flex flex-wrap gap-2">
                    {employee.interestsMotivators.map((interest, index) => (
                      <span
                        key={index}
                        className="px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Challenges */}
              {employee.challenges.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Challenges</h3>
                  <div className="flex flex-wrap gap-2">
                    {employee.challenges.map((challenge, index) => (
                      <span
                        key={index}
                        className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium"
                      >
                        {challenge}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Support Strategies */}
              {employee.regulationStrategies.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Support Strategies</h3>
                  <div className="flex flex-wrap gap-2">
                    {employee.regulationStrategies.map((strategy, index) => (
                      <span
                        key={index}
                        className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                      >
                        {strategy}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Emergency Contacts */}
              {employee.emergencyContacts.length > 0 && (
                <div className="lg:col-span-3">
                  <h3 className="font-medium text-gray-900 mb-2 flex items-center">
                    <Phone className="h-4 w-4 text-blue-500 mr-2" />
                    Emergency Contacts
                  </h3>
                  <div className="space-y-3 ml-6">
                    {employee.emergencyContacts.map((contact, index) => (
                      <div key={index} className="text-sm bg-gray-50 p-3 rounded-lg">
                        <p className="font-medium text-gray-900">{contact.name}</p>
                        <p className="text-gray-600 ml-2">{contact.relationship}</p>
                        <p className="text-blue-600 ml-2">{contact.phone}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </div>

      {/* Development Goals */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 px-3 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-blue-500 flex-shrink-0" />
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Development Goals Assessment</h2>
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                {employeeGoals.length}
              </span>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              {user?.role === 'Administrator' && (
                <button
                  onClick={() => setShowGoalAssignment(true)}
                  className="flex items-center justify-center space-x-2 bg-gray-600 text-white px-4 py-3 rounded-xl hover:bg-gray-700 transition-colors text-sm font-medium"
                  data-testid="button-assign-goal"
                >
                  <Plus className="h-5 w-5" />
                  <span>Assign Goal</span>
                </button>
              )}
              
              <div className="flex gap-2 sm:gap-3">
                <button
                  onClick={handleSaveDraft}
                  disabled={isSaving}
                  className="flex-1 sm:flex-initial px-4 sm:px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="button-save-assessment-draft"
                >
                  <div className="flex items-center justify-center space-x-2">
                    <FileText className="h-5 w-5" />
                    <span>{isSaving ? 'Saving...' : 'Save Draft'}</span>
                  </div>
                </button>
                
                <button
                  onClick={handleSubmit}
                  disabled={!isSubmitEnabled() || isSaving}
                  className="flex-1 sm:flex-initial px-4 sm:px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="button-submit-assessment"
                >
                  <div className="flex items-center justify-center space-x-2">
                    <Send className="h-5 w-5" />
                    <span>Submit</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-6">
          {/* Goal Selection Info Banner */}
          {showGoalSelectionBanner && employeeGoals.length > 1 && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">i</span>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-blue-900 mb-1">Select which goals to assess today</h3>
                  <p className="text-sm text-blue-800">
                    You can choose to document only some goals. Excluded goals won't affect their mastery progress. Use the toggle on each goal to include or exclude it from today's assessment.
                  </p>
                </div>
                <button
                  onClick={dismissGoalSelectionBanner}
                  className="flex-shrink-0 text-blue-500 hover:text-blue-700"
                  aria-label="Dismiss"
                  data-testid="button-dismiss-goal-selection-banner"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}

          <div className="space-y-8">
            {employeeGoals.length > 0 ? (
              employeeGoals.map((goal) => {
                const progress = getGoalProgress(goal);
                const isIncluded = includedGoals[goal.id] !== false;
                
                return (
                  <div key={goal.id} className="border border-gray-200 rounded-xl p-3 sm:p-6 bg-gray-50">
                    {editingGoal === goal.id ? (
                      // Inline editing form
                      <div className="space-y-4">
                        <div>
                          <label htmlFor={`goal-title-${goal.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                            Goal Title
                          </label>
                          <input
                            id={`goal-title-${goal.id}`}
                            type="text"
                            value={editForm.title}
                            onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                          />
                        </div>
                        <div>
                          <label htmlFor={`goal-description-${goal.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                          </label>
                          <textarea
                            id={`goal-description-${goal.id}`}
                            value={editForm.description}
                            onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                            rows={3}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                          />
                        </div>
                        <div>
                          <label htmlFor={`goal-target-date-${goal.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                            Target End Date
                          </label>
                          <input
                            id={`goal-target-date-${goal.id}`}
                            type="date"
                            value={editForm.targetEndDate}
                            onChange={(e) => setEditForm(prev => ({ ...prev, targetEndDate: e.target.value }))}
                            className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                          />
                        </div>
                        <div className="flex space-x-3">
                          <button
                            onClick={handleSaveGoal}
                            className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                          >
                            <div className="flex items-center space-x-2">
                              <Save className="h-4 w-4" />
                              <span>Save</span>
                            </div>
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                          >
                            <div className="flex items-center space-x-2">
                              <X className="h-4 w-4" />
                              <span>Cancel</span>
                            </div>
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Regular goal display
                      <>
                        {/* Goal Inclusion Toggle */}
                        <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: isIncluded ? '#dcfce7' : '#f3f4f6' }}>
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => toggleGoalInclusion(goal.id)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                isIncluded ? 'bg-green-600 focus:ring-green-500' : 'bg-gray-400 focus:ring-gray-400'
                              }`}
                              role="switch"
                              aria-checked={isIncluded}
                              data-testid={`toggle-goal-inclusion-${goal.id}`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  isIncluded ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                            <span className={`text-sm font-medium ${isIncluded ? 'text-green-800' : 'text-gray-600'}`}>
                              {isIncluded ? 'Included in Assessment' : 'Excluded from Assessment'}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                          <div className="flex-1">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">{goal.title}</h3>
                            <p className="text-sm text-gray-600 mb-3">{goal.description}</p>
                            
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                              <span>Started: {new Date(goal.startDate).toLocaleDateString()}</span>
                              <span>Target: {new Date(goal.targetEndDate).toLocaleDateString()}</span>
                            </div>
                          </div>
                      
                      <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2">
                        {user?.role === 'Administrator' && (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEditGoal(goal)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                              title="Edit goal"
                              data-testid={`button-edit-goal-${goal.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleArchiveGoal(goal.id, goal.title)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                              title="Archive goal"
                              data-testid={`button-archive-goal-${goal.id}`}
                            >
                              <Archive className="h-4 w-4" />
                            </button>
                          </div>
                        )}

                        <div className="text-right">
                          <div className="text-xl sm:text-2xl font-bold text-blue-600 mb-1">
                            {goal.consecutiveAllCorrect}/3
                            <span className="text-base sm:text-lg ml-2 text-gray-600">
                              ({Math.round((goal.consecutiveAllCorrect / 3) * 100)}%)
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">consecutive correct</div>
                        </div>
                      </div>
                    </div>

                    {/* Goal Steps - Collapsible - Only show if goal is included */}
                    {isIncluded && (
                      <div className="space-y-4">
                        <div>
                          <button
                            onClick={() => toggleGoalExpansion(goal.id)}
                            className="flex items-center space-x-2 text-left w-full hover:bg-white p-2 rounded-xl transition-colors"
                          >
                            {expandedGoals[goal.id] ? (
                              <ChevronDown className="h-4 w-4 text-gray-500" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-gray-500" />
                            )}
                            <h4 className="font-medium text-gray-900">Steps ({goal.steps.length}) - Click to expand</h4>
                          </button>
                          
                          {expandedGoals[goal.id] && (
                          <div className="mt-4 space-y-4 border-t border-gray-200 pt-4">
                            {goal.steps.map((step: any, stepIndex: number) => {
                              const stepKey = step.id;
                              const stepProgress = outcomes[stepKey];
                              const hasNotes = showNotes[stepKey];
                              
                              
                              return (
                                <div
                                  key={step.id}
                                  className="border border-gray-300 rounded-xl p-3 sm:p-4 bg-white shadow-sm"
                                >
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-2 mb-2">
                                        <span className="font-medium text-gray-900">
                                          {step.stepOrder}.
                                        </span>
                                        <span className="text-gray-700">{step.stepDescription}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Timer Component - Only show for timed steps */}
                                  {step.timerType && step.timerType !== 'none' && (
                                    <div className="mb-4">
                                      <div className="flex items-center space-x-2 mb-2">
                                        <Clock className="h-4 w-4 text-blue-500" />
                                        <span className="text-sm font-medium text-gray-700">
                                          Timer {step.timerType === 'required' && <span className="text-red-500">*</span>}
                                        </span>
                                      </div>
                                      <Timer
                                        onTimeChange={(timeInSeconds, manuallyEntered) => 
                                          handleTimerChange(step.id, timeInSeconds, manuallyEntered)
                                        }
                                        initialTime={timerData[step.id]?.seconds || 0}
                                        isManuallyEntered={timerData[step.id]?.manuallyEntered || false}
                                        disabled={false}
                                        className="w-full max-w-md"
                                      />
                                    </div>
                                  )}

                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                    <OutcomeSelector
                                      value={outcomes[stepKey]?.outcome}
                                      stepId={step.id}
                                      onChange={(outcome) => handleOutcomeChange(goal.id, step.id, outcome)}
                                      disabled={false}
                                    />
                                    
                                    <button
                                      onClick={() => setShowNotes(prev => ({ ...prev, [stepKey]: !prev[stepKey] }))}
                                      className="flex items-center space-x-1 text-gray-500 hover:text-gray-700 text-sm self-end sm:self-auto"
                                    >
                                      <MessageSquare className="h-4 w-4" />
                                      <span>Notes</span>
                                    </button>
                                  </div>

                                  {hasNotes && (
                                    <div className="mt-3">
                                      {outcomes[stepKey]?.outcome === 'verbal_prompt' && (
                                        <div className="mb-2 text-sm text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                                          <strong>Note required:</strong> Please describe what verbal prompt was given.
                                        </div>
                                      )}
                                      <textarea
                                        value={localNotes[stepKey] || ''}
                                        onChange={(e) => handleNotesChange(goal.id, step.id, e.target.value)}
                                        placeholder={
                                          outcomes[stepKey]?.outcome === 'verbal_prompt' 
                                            ? "Describe the verbal prompt given (required)..." 
                                            : "Add notes about this step..."
                                        }
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                                        required={outcomes[stepKey]?.outcome === 'verbal_prompt'}
                                        rows={2}
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        </div>
                      </div>
                    )}

                    {/* Mastery Status */}
                    {goal.consecutiveAllCorrect >= 2 && (
                      <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                        <div className="flex items-center space-x-2">
                          <AlertCircle className="h-5 w-5 text-orange-500" />
                          <div>
                            <p className="font-medium text-orange-800">Near Mastery!</p>
                            <p className="text-sm text-orange-700">
                              {3 - goal.consecutiveAllCorrect} more consecutive correct shift{3 - goal.consecutiveAllCorrect !== 1 ? 's' : ''} needed for mastery.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {goal.masteryAchieved && (
                      <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          <div>
                            <p className="font-medium text-green-800">Goal Mastered!</p>
                            <p className="text-sm text-green-700">
                              Achieved on {goal.masteryDate ? new Date(goal.masteryDate).toLocaleDateString() : 'today'}. 
                              This goal is now in maintenance mode.
                            </p>
                          </div>
                        </div>
                      </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12">
                <Target className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Goals</h3>
                <p className="text-gray-600">This employee doesn't have any active development goals yet.</p>
              </div>
            )}

            {/* Overall Performance Summary - Integrated into Assessment */}
            <div className="mt-8 border-t border-gray-200 pt-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Overall Performance Summary</h3>
                </div>
                <button
                  onClick={() => handleViewPastAssessments()}
                  className="flex items-center justify-center sm:justify-start space-x-2 px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 hover:border-gray-300 transition-colors w-full sm:w-auto"
                  data-testid="button-view-past-assessments"
                >
                  <Clock className="h-5 w-5" />
                  <span>View Past Assessments ({assessmentSummaries.filter(summary => summary.employeeId === employee.id).length})</span>
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-3">
                    Provide an overall summary of {employee.first_name}'s performance during this assessment, including strengths, areas for improvement, and any notable observations.
                  </p>
                  <textarea
                    id="shift-summary"
                    value={shiftSummary}
                    onChange={(e) => handleSummaryChange(e.target.value)}
                    placeholder={`Write a summary of ${employee.first_name}'s performance today...

Examples:
• Great job greeting customers with enthusiasm today
• Showed improvement in remembering ice cream flavors
• Needed reminders for cleaning procedures but followed through well
• Worked well with team members during busy periods`}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
                    rows={6}
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-start space-x-2">
                    <div className="h-5 w-5 rounded-full bg-blue-600 flex items-center justify-center mt-0.5">
                      <span className="text-white text-xs font-bold">i</span>
                    </div>
                    <div className="text-sm text-blue-700">
                      <p className="font-medium mb-1">Tips for writing effective summaries:</p>
                      <ul className="list-disc list-inside space-y-1 text-blue-600">
                        <li>Focus on specific behaviors and achievements</li>
                        <li>Include both strengths and areas for growth</li>
                        <li>Note any support strategies that worked well</li>
                        <li>Mention interactions with customers and team members</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Unsaved Changes Indicator */}
          {hasUnsavedChanges && (
            <div className="mt-6 sm:mt-8 bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 bg-amber-500 rounded-full animate-pulse flex-shrink-0"></div>
                  <span className="text-sm text-amber-700 font-medium">You have unsaved changes</span>
                </div>
                <span className="text-sm text-amber-600 ml-4 sm:ml-0">Use "Save Draft" or "Submit" buttons above to save your progress</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}