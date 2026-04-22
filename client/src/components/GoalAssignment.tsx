import React, { useState, useMemo } from 'react';
import { ArrowLeft, Target, AlertCircle, Lock } from 'lucide-react';
import { useData, type Employee, type GoalTemplate, type DevelopmentGoal } from '../contexts/DataContext';
import { usePermissions } from '../hooks/usePermissions';

interface GoalAssignmentProps {
  initialEmployeeId?: string;
  allowedEmployeeIds?: string[];
  audienceLabel?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function GoalAssignment({ initialEmployeeId, allowedEmployeeIds, audienceLabel, onClose, onSuccess }: GoalAssignmentProps) {
  const { employees, goalTemplates, developmentGoals, bulkAssignGoal } = useData();
  const { canModify } = usePermissions();
  const canAssignGoals = canModify('goal_assignment');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(
    () => new Set(initialEmployeeId ? [initialEmployeeId] : [])
  );
  const [skipExisting, setSkipExisting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const allowedSet = useMemo(
    () => (allowedEmployeeIds ? new Set(allowedEmployeeIds) : null),
    [allowedEmployeeIds]
  );

  const activeEmployees = useMemo<Employee[]>(
    () => employees
      .filter((e) => e.isActive)
      .filter((e) => !allowedSet || allowedSet.has(e.id))
      .sort((a, b) =>
        `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
      ),
    [employees, allowedSet]
  );

  const availableTemplates = goalTemplates.filter((template) => template.status === 'active');

  const template: GoalTemplate | null = selectedTemplate
    ? goalTemplates.find((t) => t.id === selectedTemplate) ?? null
    : null;

  const employeesWithExistingGoal = useMemo<Set<string>>(() => {
    if (!template) return new Set<string>();
    const ids = developmentGoals
      .filter((g: DevelopmentGoal) => g.title === template.name && g.status === 'active')
      .map((g: DevelopmentGoal) => g.employeeId);
    return new Set<string>(ids);
  }, [developmentGoals, template]);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
  };

  const toggleEmployee = (id: string) => {
    setSelectedEmployeeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllEligible = () => {
    const next = new Set<string>();
    activeEmployees.forEach((e) => {
      if (!skipExisting || !employeesWithExistingGoal.has(e.id)) {
        next.add(e.id);
      }
    });
    setSelectedEmployeeIds(next);
  };

  const clearAll = () => setSelectedEmployeeIds(new Set());

  const effectiveSelectedIds = useMemo(() => {
    return Array.from(selectedEmployeeIds).filter(id =>
      !skipExisting || !employeesWithExistingGoal.has(id)
    );
  }, [selectedEmployeeIds, skipExisting, employeesWithExistingGoal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate || effectiveSelectedIds.length === 0) return;
    if (!canAssignGoals) {
      setErrorMessage('You do not have permission to assign goals.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      await bulkAssignGoal(selectedTemplate, effectiveSelectedIds, skipExisting);
      onSuccess();
    } catch (err) {
      console.error('Error assigning goals:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to assign goals');
    } finally {
      setLoading(false);
    }
  };

  const selectedCount = effectiveSelectedIds.length;
  const totalChecked = selectedEmployeeIds.size;
  const skippedCount = totalChecked - selectedCount;

  if (!canAssignGoals) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center space-x-4 mb-8">
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Assign Goals</h1>
        </div>
        <div
          className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex items-start gap-3"
          data-testid="permission-denied"
        >
          <Lock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900">You don't have permission to assign goals.</p>
            <p className="text-sm text-amber-800 mt-1">
              Ask an Administrator to enable the Goal Assignment permission for your role in Permission Settings.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Assign Goals</h1>
            <p className="text-gray-600">
              Create a new development goal for one or more employees
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
                    {availableTemplates.map((tpl) => (
                      <tr
                        key={tpl.id}
                        onClick={() => handleTemplateSelect(tpl.id)}
                        className="hover:bg-blue-50 cursor-pointer transition-colors"
                        data-testid={`row-template-${tpl.id}`}
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-start space-x-3">
                            <Target className="h-5 w-5 text-blue-600 flex-shrink-0 mt-1" />
                            <div>
                              <p className="font-medium text-gray-900">{tpl.name}</p>
                              <p className="text-sm text-gray-500 line-clamp-2">{tpl.goalStatement}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sm text-gray-600">{tpl.steps.length}</span>
                        </td>
                        <td className="py-4 px-6 text-sm text-gray-600">
                          {tpl.relativeTargetDuration || tpl.defaultTargetDate || 'Not set'}
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

      {selectedTemplate && template && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Confirm Goal Assignment</h2>
            <button
              onClick={() => setSelectedTemplate(null)}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              data-testid="button-change-template"
            >
              ← Choose Different Template
            </button>
          </div>

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
                    <span className="ml-2 text-gray-600">{template.relativeTargetDuration || template.defaultTargetDate}</span>
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
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              {initialEmployeeId ? (
                (() => {
                  const emp = activeEmployees.find((e) => e.id === initialEmployeeId);
                  const hasExisting = emp ? employeesWithExistingGoal.has(emp.id) : false;
                  return (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Assigning to</h4>
                      <div
                        className="flex items-center justify-between p-3 border border-blue-200 bg-blue-50/40 rounded-lg"
                        data-testid="single-employee-summary"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {emp ? `${emp.first_name} ${emp.last_name}` : 'Selected employee'}
                          </p>
                          {emp?.role && (
                            <p className="text-xs text-gray-500">{emp.role}</p>
                          )}
                        </div>
                        {hasExisting && (
                          <span
                            className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700"
                            data-testid="badge-existing-single"
                          >
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Already has this goal active
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : (
              <>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-gray-900">Select Employees ({selectedCount} selected)</h4>
                <div className="flex items-center space-x-3 text-sm">
                  <button
                    type="button"
                    onClick={selectAllEligible}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                    data-testid="button-select-all"
                  >
                    Select all eligible
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-gray-600 hover:text-gray-800 font-medium"
                    data-testid="button-clear-all"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <label className="flex items-center space-x-2 mb-4 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={skipExisting}
                  onChange={(e) => setSkipExisting(e.target.checked)}
                  className="rounded border-gray-300"
                  data-testid="checkbox-skip-existing"
                />
                <span>Skip employees who already have this goal active</span>
              </label>

              <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {activeEmployees.length === 0 && (
                  <div className="p-4 text-center text-gray-500 text-sm">No active employees</div>
                )}
                {activeEmployees.map((emp) => {
                  const hasExisting = employeesWithExistingGoal.has(emp.id);
                  const isChecked = selectedEmployeeIds.has(emp.id);
                  const isSkipped = isChecked && hasExisting && skipExisting;
                  return (
                    <label
                      key={emp.id}
                      className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 ${
                        hasExisting && skipExisting ? 'bg-gray-50' : ''
                      }`}
                      data-testid={`row-employee-${emp.id}`}
                    >
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleEmployee(emp.id)}
                          className="rounded border-gray-300"
                          data-testid={`checkbox-employee-${emp.id}`}
                        />
                        <div>
                          <p className={`font-medium ${hasExisting && skipExisting ? 'text-gray-500' : 'text-gray-900'}`}>
                            {emp.first_name} {emp.last_name}
                          </p>
                          <p className="text-xs text-gray-500">{emp.role}</p>
                        </div>
                      </div>
                      {hasExisting && (
                        <span
                          className={`inline-flex items-center text-xs px-2 py-1 rounded-full ${
                            isSkipped
                              ? 'bg-gray-200 text-gray-600'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                          data-testid={`badge-existing-${emp.id}`}
                        >
                          <AlertCircle className="h-3 w-3 mr-1" />
                          {isSkipped ? 'Will be skipped' : 'Already assigned'}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>

              {skippedCount > 0 && (
                <p className="mt-3 text-xs text-gray-500">
                  {skippedCount} selected employee{skippedCount === 1 ? '' : 's'} will be skipped (already has this goal).
                </p>
              )}
              </>
              )}
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" data-testid="error-message">
                {errorMessage}
              </div>
            )}

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                data-testid="button-cancel"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || selectedCount === 0 || !canAssignGoals}
                className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="button-submit"
              >
                {loading
                  ? 'Assigning...'
                  : initialEmployeeId
                    ? 'Assign Goal'
                    : selectedCount === 0
                      ? 'Select at least one employee'
                      : `Assign Goal to ${selectedCount} ${selectedCount === 1 ? 'Employee' : 'Employees'}`}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
