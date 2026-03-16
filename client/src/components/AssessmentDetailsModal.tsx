import { FileText, Info, Clock, Target } from 'lucide-react';
import Modal from './ui/Modal';

interface StepResult {
  id: string;
  step: string;
  outcome: 'correct' | 'verbal_prompt' | 'n/a' | 'incorrect';
  notes?: string;
  completionTime?: number;
  timerManuallyEntered?: boolean;
}

interface GoalSection {
  goalTitle: string;
  steps: StepResult[];
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
  stepResults: StepResult[];
  overallSummary: string;
  goals?: GoalSection[];
}

interface AssessmentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  assessment: AssessmentDetails | null;
}

export default function AssessmentDetailsModal({ isOpen, onClose, assessment }: AssessmentDetailsModalProps) {
  if (!isOpen || !assessment) return null;

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'correct': return 'bg-green-100 text-green-800';
      case 'incorrect': return 'bg-red-100 text-red-800';
      case 'verbal_prompt': return 'bg-yellow-100 text-yellow-800';
      case 'n/a': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getOutcomeText = (outcome: string) => {
    switch (outcome) {
      case 'correct': return 'Correct';
      case 'incorrect': return 'Incorrect';
      case 'verbal_prompt': return 'Verbal Prompt';
      case 'n/a': return 'N/A';
      default: return outcome;
    }
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const renderStep = (step: StepResult, index: number) => (
    <div key={step.id || index} className="border border-gray-200 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-sm font-medium text-gray-900">
          {index + 1}. {step.step}
        </span>
        <span className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium ${getOutcomeColor(step.outcome)}`}>
          {getOutcomeText(step.outcome)}
        </span>
      </div>
      {step.completionTime && step.completionTime > 0 && (
        <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
          <Clock className="h-4 w-4 text-blue-500" />
          <span>Completion time: {formatTime(step.completionTime)}</span>
          {step.timerManuallyEntered && (
            <span className="text-xs px-2 py-1 bg-gray-100 rounded-full">manually entered</span>
          )}
        </div>
      )}
      {step.notes && (
        <div className="mt-2 flex items-start space-x-2">
          <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <span className="text-sm font-medium text-gray-700">Notes:</span>
            <p className="text-sm text-gray-600 mt-1">{step.notes}</p>
          </div>
        </div>
      )}
    </div>
  );

  const hasMultiGoal = assessment.goals && assessment.goals.length > 0;

  return (
    <Modal isOpen={true} onClose={onClose} title={`Assessment Details — ${assessment.date}`} titleIcon={<FileText className="h-6 w-6 text-gray-600" />} size="xl">
      <div className="space-y-6">
        {/* Assessment Information */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Date</h3>
            <p className="text-gray-900">{assessment.date}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Time</h3>
            <p className="text-gray-900">{assessment.time}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Assessor</h3>
            <p className="text-gray-900">{assessment.assessor}</p>
          </div>
        </div>

        {/* Multi-goal view */}
        {hasMultiGoal ? (
          <div className="space-y-5">
            {assessment.goals!.map((goalSection, gi) => (
              <div key={gi} className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-blue-50 px-4 py-3 flex items-center gap-2 border-b border-blue-100">
                  <Target className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  <span className="text-sm font-semibold text-blue-900">{goalSection.goalTitle}</span>
                </div>
                {goalSection.steps.length > 0 ? (
                  <div className="p-3 space-y-3">
                    {goalSection.steps.map((step, idx) => renderStep(step, idx))}
                  </div>
                ) : (
                  <p className="p-4 text-sm text-gray-400 italic">No steps recorded.</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Single-goal legacy view */
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-gray-900">Step Assessment Results</h3>
            {assessment.stepResults.map((step, index) => renderStep(step, index))}
          </div>
        )}

        {/* Overall Assessment Summary */}
        {assessment.overallSummary && (
          <div className="bg-gray-50 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Overall Summary</h3>
            <p className="text-sm text-gray-700 leading-relaxed">{assessment.overallSummary}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
