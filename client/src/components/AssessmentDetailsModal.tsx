import { FileText, Info, Clock } from 'lucide-react';
import Modal from './ui/Modal';

interface StepResult {
  id: string;
  step: string;
  outcome: 'correct' | 'verbal_prompt' | 'n/a' | 'incorrect';
  notes?: string;
  completionTime?: number; // Time in seconds
  timerManuallyEntered?: boolean;
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
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`Assessment Details - ${assessment.date.split(', ')[1]}`} titleIcon={<FileText className="h-6 w-6 text-gray-600" />} size="xl">
        <div className="space-y-6">
          {/* Assessment Information */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Date:</h3>
              <p className="text-gray-900">{assessment.date}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Time:</h3>
              <p className="text-gray-900">{assessment.time}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Assessor:</h3>
              <p className="text-gray-900">{assessment.assessor}</p>
            </div>
          </div>

          {/* Goal Information */}
          <div className="bg-blue-50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{assessment.goalName}</h3>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">
                  {assessment.consecutiveAfter}/{assessment.consecutiveTarget}
                </div>
                <div className="text-sm text-gray-600">consecutive correct</div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Progress:</span>
                <span className="ml-2 font-medium">
                  {assessment.progressBefore}% → {assessment.progressAfter}%
                </span>
              </div>
              <div>
                <span className="text-gray-600">Consecutive Correct:</span>
                <span className="ml-2 font-medium">
                  {assessment.consecutiveBefore} → {assessment.consecutiveAfter}
                </span>
              </div>
            </div>
          </div>

          {/* Step Assessment Results */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Step Assessment Results</h3>
            <div className="space-y-4">
              {assessment.stepResults.map((step, index) => (
                <div key={step.id} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <span className="text-lg font-medium text-gray-900">
                        {index + 1}. {step.step}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getOutcomeColor(step.outcome)}`}>
                        {getOutcomeText(step.outcome)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Timer information */}
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
                    <div className="mt-3 flex items-start space-x-2">
                      <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-sm font-medium text-gray-700">Notes:</span>
                        <p className="text-sm text-gray-600 mt-1">{step.notes}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Overall Assessment Summary */}
          <div className="bg-gray-50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Assessment Summary</h3>
            <p className="text-gray-700 leading-relaxed">{assessment.overallSummary}</p>
          </div>
        </div>
    </Modal>
  );
}