import React, { useState } from 'react';
import { ArrowLeft, Calendar, Clock, User, Target, Eye } from 'lucide-react';
import AssessmentDetailsModal from './AssessmentDetailsModal';
import { Employee } from '../contexts/DataContext';

interface AssessmentHistoryProps {
  employee: Employee;
  onBackToAssessment: () => void;
}

interface AssessmentRecord {
  id: string;
  date: string;
  time: string;
  managerName: string;
  goalsAssessed: number;
  goalName: string;
  summary: string;
}

interface AssessmentDetails {
  id: string;
  date: string;
  time: string;
  assessor: string;
  goalName: string;
  progressBefore: number;
  progressAfter: number;
  consecutiveBefore: number;
  consecutiveAfter: number;
  consecutiveTarget: number;
  stepResults: Array<{
    id: string;
    step: string;
    outcome: 'correct' | 'verbal_prompt' | 'n/a';
    notes?: string;
    completionTime?: number; // Time in seconds
    timerManuallyEntered?: boolean;
  }>;
  overallSummary: string;
}

import { useData } from '../contexts/DataContext';

// Detailed assessment data for the modal
const mockDetailedAssessments: { [key: string]: AssessmentDetails } = {
  '1': {
    id: '1',
    date: 'Saturday, August 31, 2024',
    time: '14:30',
    assessor: 'Manager Sarah',
    goalName: 'Ice Cream Preparation',
    progressBefore: 0,
    progressAfter: 15,
    consecutiveBefore: 0,
    consecutiveAfter: 1,
    consecutiveTarget: 3,
    stepResults: [
      {
        id: 'step1',
        step: 'Wash hands and sanitize work area',
        outcome: 'correct',
        notes: 'Remembered to use warm water and soap for full 20 seconds. Good technique!'
      },
      {
        id: 'step2',
        step: 'Check ice cream temperature',
        outcome: 'verbal_prompt',
        notes: 'Needed reminder to check temperature before scooping. Improved after guidance.'
      },
      {
        id: 'step3',
        step: 'Verify allergen information',
        outcome: 'verbal_prompt',
        notes: 'Forgot to ask about nut allergies initially. Made sure to double-check after reminder.'
      }
    ],
    overallSummary: 'Alex showed great enthusiasm and was eager to learn. Demonstrated strong hand hygiene and good customer interaction skills. Main areas for improvement: remembering temperature checks and allergy protocols. Responded well to feedback and showed immediate improvement when guided. Overall, a very positive first assessment with clear potential for growth.'
  },
  '2': {
    id: '2',
    date: 'Tuesday, August 27, 2024',
    time: '10:15',
    assessor: 'Trainer Mike',
    goalName: 'Customer Service',
    progressBefore: 20,
    progressAfter: 35,
    consecutiveBefore: 1,
    consecutiveAfter: 2,
    consecutiveTarget: 3,
    stepResults: [
      {
        id: 'step1',
        step: 'Greet customers warmly',
        outcome: 'correct',
        notes: 'Natural and friendly greeting, made customers feel welcome immediately.'
      },
      {
        id: 'step2',
        step: 'Ask about flavor preferences',
        outcome: 'correct',
        notes: 'Good questioning technique to understand customer needs.'
      },
      {
        id: 'step3',
        step: 'Suggest complementary items',
        outcome: 'correct',
        notes: 'Naturally suggested toppings and made appropriate upselling recommendations.'
      }
    ],
    overallSummary: 'Alex demonstrated excellent communication skills with customers and showed genuine care for their experience. Strong progress in product knowledge and upselling techniques. Areas for continued development include handling difficult customer situations and managing stress during busy periods. Shows great potential for leadership roles.'
  }
};

export default function AssessmentHistory({ employee, onBackToAssessment }: AssessmentHistoryProps) {
  const { assessmentSummaries, stepProgress, developmentGoals, employees } = useData();
  const [selectedAssessment, setSelectedAssessment] = useState<AssessmentDetails | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Get real assessment data for this employee
  const employeeAssessments = assessmentSummaries
    .filter(summary => summary.employeeId === employee.id)
    .map(summary => {
      const assessmentDate = new Date(summary.date);
      const employeeGoals = developmentGoals.filter(goal => goal.employeeId === employee.id);
      
      // Look up manager name from employees list
      const manager = employees.find(emp => emp.id === summary.managerId);
      const managerName = manager 
        ? `${manager.first_name} ${manager.last_name}` 
        : 'Manager';
      
      return {
        id: summary.id,
        date: assessmentDate.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        time: assessmentDate.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: false 
        }),
        managerName: managerName,
        goalsAssessed: employeeGoals.length,
        goalName: employeeGoals.length > 0 ? employeeGoals[0].title : 'Various Goals',
        summary: summary.summary
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleViewDetails = (assessmentId: string) => {
    const summary = assessmentSummaries.find(s => s.id === assessmentId);
    if (summary) {
      const assessmentDate = new Date(summary.date);
      const employeeGoals = developmentGoals.filter(goal => goal.employeeId === employee.id);
      const relatedStepProgress = stepProgress.filter(sp => 
        sp.employeeId === employee.id && 
        sp.assessmentSessionId === summary.assessmentSessionId // Match by session ID instead of date
      );

      // Look up manager name from employees list
      const manager = employees.find(emp => emp.id === summary.managerId);
      const managerName = manager 
        ? `${manager.first_name} ${manager.last_name}` 
        : 'Manager';

      const assessment: AssessmentDetails = {
        id: summary.id,
        date: assessmentDate.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        time: assessmentDate.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: false 
        }),
        assessor: managerName,
        goalName: employeeGoals.length > 0 ? employeeGoals[0].title : 'Various Goals',
        progressBefore: 0,
        progressAfter: relatedStepProgress.length,
        consecutiveBefore: 0,
        consecutiveAfter: relatedStepProgress.filter(sp => sp.outcome === 'correct').length,
        consecutiveTarget: 3,
        stepResults: relatedStepProgress
          .map(sp => {
            // Find the step to get its order
            let stepOrder = 999;
            let stepDescription = 'Unknown Step';
            for (const goal of employeeGoals) {
              const step = goal.steps.find(s => s.id === sp.goalStepId);
              if (step) {
                stepOrder = step.stepOrder;
                stepDescription = step.stepDescription;
                break;
              }
            }
            return {
              stepOrder,
              sp,
              stepDescription
            };
          })
          .sort((a, b) => a.stepOrder - b.stepOrder)
          .map(({ sp, stepDescription }) => ({
            id: sp.id,
            step: stepDescription,
            outcome: sp.outcome === 'na' ? 'n/a' : sp.outcome,
            notes: sp.notes,
            completionTime: sp.completionTimeSeconds,
            timerManuallyEntered: sp.timerManuallyEntered
          })),
        overallSummary: summary.summary
      };
      
      setSelectedAssessment(assessment);
      setIsModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedAssessment(null);
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={onBackToAssessment}
          className="flex items-center space-x-2 px-4 py-2 mb-4 text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium"
          data-testid="button-back-to-assessment"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">Back to Current Assessment</span>
        </button>
        
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assessment History</h1>
          <p className="text-gray-600 mt-1">
            View past assessment results and progress for {`${employee.first_name} ${employee.last_name}`}
          </p>
        </div>
      </div>

      {/* Employee Profile Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center space-x-4">
          <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-xl font-semibold text-blue-600">
              {getInitials(`${employee.first_name} ${employee.last_name}`)}
            </span>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{`${employee.first_name} ${employee.last_name}`}</h2>
            <p className="text-gray-600">{employee.role}</p>
            <p className="text-sm text-gray-500 mt-1">
              {employeeAssessments.length} assessment{employeeAssessments.length !== 1 ? 's' : ''} on record
            </p>
          </div>
        </div>
      </div>

      {/* Assessment History List */}
      <div className="space-y-4">
        {employeeAssessments.map((assessment) => (
          <div
            key={assessment.id}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
          >
            {/* Assessment Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2 text-gray-700">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">{assessment.date}</span>
                </div>
                <div className="flex items-center space-x-2 text-gray-700">
                  <Clock className="h-4 w-4" />
                  <span>{assessment.time}</span>
                </div>
                <div className="flex items-center space-x-2 text-gray-700">
                  <User className="h-4 w-4" />
                  <span>{assessment.managerName}</span>
                </div>
              </div>
              
              <button
                onClick={() => handleViewDetails(assessment.id)}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                data-testid={`button-view-details-${assessment.id}`}
              >
                <Eye className="h-4 w-4" />
                <span>View Details</span>
              </button>
            </div>

            {/* Goals Assessed */}
            <div className="flex items-center space-x-2 mb-3">
              <Target className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600">
                Goals assessed: {assessment.goalsAssessed}
              </span>
            </div>

            {/* Goal Name */}
            <div className="mb-4">
              <span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-sm font-medium rounded-full">
                {assessment.goalName}
              </span>
            </div>

            {/* Assessment Summary */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Assessment Summary</h3>
              <p className="text-gray-700 text-sm leading-relaxed">
                {assessment.summary}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State (if no assessments) */}
      {employeeAssessments.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Target className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Assessment History</h3>
          <p className="text-gray-600">
            {`${employee.first_name} ${employee.last_name}`} doesn't have any completed assessments yet.
          </p>
        </div>
      )}

      {/* Assessment Details Modal */}
      <AssessmentDetailsModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        assessment={selectedAssessment}
      />
    </div>
  );
}