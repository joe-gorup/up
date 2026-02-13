import React, { useState } from 'react';
import { ArrowLeft, Target } from 'lucide-react';
import { useData } from '../contexts/DataContext';

interface GoalAssignmentProps {
  employeeId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function GoalAssignment({ employeeId, onClose, onSuccess }: GoalAssignmentProps) {
  const { employees, goalTemplates, createGoalFromTemplate, developmentGoals } = useData();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const employee = employees.find(emp => emp.id === employeeId);
  const activeGoals = developmentGoals.filter(goal => 
    goal.employeeId === employeeId && goal.status === 'active'
  ).length;

  const availableTemplates = goalTemplates.filter(template => template.status === 'active');

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;

    setLoading(true);
    try {
      await createGoalFromTemplate(selectedTemplate, employeeId);
      onSuccess();
    } catch (error) {
      console.error('Error assigning goal:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!employee) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Assign Goal</h1>
            <p className="text-gray-600">
              Create a new development goal for {`${employee.first_name} ${employee.last_name}`}
            </p>
          </div>
        </div>
      </div>


      {!selectedTemplate && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Select Goal Template</h2>
          
          {availableTemplates.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-4 px-6 font-medium text-gray-900">Template</th>
                      <th className="text-left py-4 px-6 font-medium text-gray-900">Steps</th>
                      <th className="text-left py-4 px-6 font-medium text-gray-900">Target Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {availableTemplates.map(template => (
                      <tr
                        key={template.id}
                        onClick={() => handleTemplateSelect(template.id)}
                        className="hover:bg-blue-50 cursor-pointer transition-colors"
                        data-testid={`row-template-${template.id}`}
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-start space-x-3">
                            <Target className="h-5 w-5 text-blue-600 flex-shrink-0 mt-1" />
                            <div>
                              <p className="font-medium text-gray-900">{template.name}</p>
                              <p className="text-sm text-gray-500 line-clamp-2">{template.goalStatement}</p>
                            </div>
                          </div>
                        </td>
                        
                        <td className="py-4 px-6">
                          <span className="text-sm text-gray-600">{template.steps.length}</span>
                        </td>
                        
                        <td className="py-4 px-6 text-sm text-gray-600">
                          {template.relativeTargetDuration || template.defaultTargetDate || 'Not set'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {availableTemplates.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
              <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Templates Available</h3>
              <p className="text-gray-600">Create goal templates first before assigning goals to employees.</p>
            </div>
          )}
        </div>
      )}

      {selectedTemplate && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Confirm Goal Assignment</h2>
            <button
              onClick={() => setSelectedTemplate(null)}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              ← Choose Different Template
            </button>
          </div>
          
          {(() => {
            const template = goalTemplates.find(t => t.id === selectedTemplate);
            if (!template) return null;
            
            return (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
                      <p className="text-gray-600 mt-2">{template.goalStatement}</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">Target Date:</span>
                        <span className="ml-2 text-gray-600">{template.defaultTargetDate}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Steps:</span>
                        <span className="ml-2 text-gray-600">{template.steps.length} steps</span>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-gray-700 mb-3">Goal Steps:</h4>
                      <div className="space-y-2">
                        {template.steps.map((step, index) => (
                          <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                              {step.stepOrder}
                            </span>
                            <div className="flex-1">
                              <p className="text-gray-900">{step.stepDescription}</p>
                              {step.isRequired && (
                                <span className="inline-block mt-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                                  Required for mastery
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                      <p className="text-sm text-blue-700">
                        <strong>Mastery Criteria:</strong> This goal will be considered mastered when all required steps are completed correctly for 3 consecutive shifts.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Assigning Goal...' : 'Assign Goal to ' + `${employee.first_name} ${employee.last_name}`}
                  </button>
                </div>
              </form>
            );
          })()}
        </div>
      )}
    </div>
  );
}