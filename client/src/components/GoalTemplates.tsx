import React, { useState } from 'react';
import { Target, Plus, Edit, Archive, Search, Eye, Copy, X } from 'lucide-react';
import { useData, GoalTemplate } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import Modal from './ui/Modal';

export default function GoalTemplates() {
  const { goalTemplates, addGoalTemplate, updateGoalTemplate, archiveGoalTemplate } = useData();
  const { user } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('active');
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [viewingTemplate, setViewingTemplate] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    goalStatement: '',
    durationNumber: 90,
    durationUnit: 'days',
    status: 'active' as 'active' | 'archived',
    steps: [{ stepOrder: 1, stepDescription: '', isRequired: true, timerType: 'none' as 'none' | 'optional' | 'required' }]
  });

  const filteredTemplates = goalTemplates
    .filter(template => {
      const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.goalStatement.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || template.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanData = {
      ...formData,
      relativeTargetDuration: `${formData.durationNumber} ${formData.durationUnit}`,
      defaultMasteryCriteria: '3 consecutive shifts with all required steps Correct', // Backend still expects this
      steps: formData.steps
        .filter(step => step.stepDescription.trim() !== '')
        .map((step, index) => ({
          ...step,
          id: `${Date.now()}-${index}`
        }))
    };
    
    // Remove the separate duration fields from the data being sent
    const { durationNumber, durationUnit, ...dataToSend } = cleanData;

    if (editingTemplate) {
      updateGoalTemplate(editingTemplate, dataToSend);
    } else {
      addGoalTemplate(dataToSend);
    }
    
    handleCloseForm();
  };

  // Helper function to parse duration strings like "90 days" into number and unit
  const parseDuration = (duration: string) => {
    const match = duration.match(/(\d+)\s*(\w+)/);
    if (match) {
      return {
        number: parseInt(match[1], 10),
        unit: match[2]
      };
    }
    return { number: 90, unit: 'days' }; // fallback
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingTemplate(null);
    setFormData({
      name: '',
      goalStatement: '',
      durationNumber: 90,
      durationUnit: 'days',
      status: 'active',
      steps: [{ stepOrder: 1, stepDescription: '', isRequired: true, timerType: 'none' }]
    });
  };


  const addStep = () => {
    setFormData(prev => ({
      ...prev,
      steps: [...prev.steps, { 
        stepOrder: prev.steps.length + 1, 
        stepDescription: '', 
        isRequired: true,
        timerType: 'none' 
      }]
    }));
  };

  const removeStep = (index: number) => {
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index).map((step, i) => ({
        ...step,
        stepOrder: i + 1
      }))
    }));
  };

  const updateStep = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.map((step, i) => 
        i === index ? { ...step, [field]: value } : step
      )
    }));
  };

  const duplicateTemplate = (template: GoalTemplate) => {
    const duration = parseDuration(template.relativeTargetDuration || '90 days');
    setFormData({
      name: `${template.name} (Copy)`,
      goalStatement: template.goalStatement,
      durationNumber: duration.number,
      durationUnit: duration.unit,
      status: 'active',
      steps: template.steps.map(step => ({
        stepOrder: step.stepOrder,
        stepDescription: step.stepDescription,
        isRequired: step.isRequired,
        timerType: step.timerType || 'none'
      }))
    });
    setShowForm(true);
  };

  const editTemplate = (template: GoalTemplate) => {
    const duration = parseDuration(template.relativeTargetDuration || '90 days');
    setFormData({
      name: template.name,
      goalStatement: template.goalStatement,
      durationNumber: duration.number,
      durationUnit: duration.unit,
      status: template.status,
      steps: template.steps.map(step => ({
        stepOrder: step.stepOrder,
        stepDescription: step.stepDescription,
        isRequired: step.isRequired,
        timerType: step.timerType || 'none'
      }))
    });
    setEditingTemplate(template.id);
    setShowForm(true);
  };

  const handleArchiveTemplate = async (templateId: string) => {
    if (confirm('Are you sure you want to archive this template? This won\'t affect any active goals assigned to employees.')) {
      await archiveGoalTemplate(templateId);
    }
  };

  const viewTemplate = goalTemplates.find(t => t.id === viewingTemplate);

  if (user?.role !== 'Administrator') {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Target className="h-12 w-12 text-red-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
          <p className="text-gray-600">You don't have permission to manage goal templates.</p>
        </div>
      </div>
    );
  }

  if (viewingTemplate && viewTemplate) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setViewingTemplate(null)}
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{viewTemplate.name}</h1>
              <p className="text-gray-600">Goal Template Details</p>
            </div>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={() => editTemplate(viewTemplate)}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
            >
              <Edit className="h-4 w-4" />
              <span>Edit</span>
            </button>
            <button
              onClick={() => duplicateTemplate(viewTemplate)}
              className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-xl hover:bg-gray-700 transition-colors"
            >
              <Copy className="h-4 w-4" />
              <span>Duplicate</span>
            </button>
            {viewTemplate.status === 'active' && (
              <button
                onClick={() => handleArchiveTemplate(viewTemplate.id)}
                className="flex items-center space-x-2 bg-amber-600 text-white px-4 py-2 rounded-xl hover:bg-amber-700 transition-colors"
              >
                <Archive className="h-4 w-4" />
                <span>Archive</span>
              </button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Goal Information</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Goal Statement</label>
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <p className="text-gray-900">{viewTemplate.goalStatement}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mastery Criteria</label>
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                    <p className="text-gray-900">{viewTemplate.defaultMasteryCriteria}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Duration from Start</label>
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                    <p className="text-gray-900">{viewTemplate.relativeTargetDuration || viewTemplate.defaultTargetDate || '90 days'}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  viewTemplate.status === 'active' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {viewTemplate.status === 'active' ? 'Active' : 'Archived'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Goal Steps ({viewTemplate.steps.length})</h2>
            
            <div className="space-y-4">
              {viewTemplate.steps.map((step, index) => (
                <div
                  key={index}
                  className={`p-4 border rounded-xl ${
                    step.isRequired 
                      ? 'border-blue-200 bg-blue-50' 
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <span className="font-medium text-gray-900 mt-1">
                        {step.stepOrder}. {step.stepDescription}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto">
      {/* Search, Filters, and Actions */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>
        
        <div className="flex space-x-2">
          {['all', 'active', 'archived'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status as any)}
              className={`px-4 py-3 rounded-xl font-medium transition-colors text-sm ${
                statusFilter === status
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-3 rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium whitespace-nowrap"
        >
          <Plus className="h-5 w-5" />
          <span>Create Template</span>
        </button>
      </div>

      {/* Template Form Modal */}
      <Modal isOpen={showForm} onClose={handleCloseForm} title={editingTemplate ? 'Edit Template' : 'Create New Template'} size="xl">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                      Template Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                      placeholder="e.g., Ice Cream Flavors Knowledge"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Duration from Start *
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="number"
                        required
                        min="1"
                        max="999"
                        value={formData.durationNumber}
                        onChange={(e) => setFormData(prev => ({ ...prev, durationNumber: parseInt(e.target.value) || 1 }))}
                        className="w-24 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                        data-testid="input-duration-number"
                      />
                      <select
                        required
                        value={formData.durationUnit}
                        onChange={(e) => setFormData(prev => ({ ...prev, durationUnit: e.target.value }))}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                        data-testid="select-duration-unit"
                      >
                        <option value="days">Days</option>
                        <option value="weeks">Weeks</option>
                        <option value="months">Months</option>
                        <option value="years">Years</option>
                      </select>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">Set the target timeframe for goal completion</p>
                  </div>
                </div>

                <div>
                  <label htmlFor="goalStatement" className="block text-sm font-medium text-gray-700 mb-2">
                    Goal Statement *
                  </label>
                  <textarea
                    id="goalStatement"
                    required
                    rows={4}
                    value={formData.goalStatement}
                    onChange={(e) => setFormData(prev => ({ ...prev, goalStatement: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    placeholder="Describe what the employee will achieve and how success will be measured..."
                  />
                </div>


                {/* Goal Steps */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Goal Steps</h3>
                    <button
                      type="button"
                      onClick={addStep}
                      className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Step</span>
                    </button>
                  </div>

                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {formData.steps.map((step, index) => (
                      <div key={index} className="border border-gray-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-gray-900">Step {step.stepOrder}</h4>
                          {formData.steps.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeStep(index)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        
                        <div className="space-y-3">
                          <div>
                            <textarea
                              required
                              value={step.stepDescription}
                              onChange={(e) => updateStep(index, 'stepDescription', e.target.value)}
                              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                              placeholder="Describe this step in detail"
                              rows={2}
                            />
                          </div>
                          
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              id={`required-${index}`}
                              checked={step.isRequired}
                              onChange={(e) => updateStep(index, 'isRequired', e.target.checked)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label htmlFor={`required-${index}`} className="text-sm font-medium text-gray-700">
                              Required for mastery
                            </label>
                          </div>
                          
                          <div className="flex items-center space-x-3">
                            <label htmlFor={`timer-${index}`} className="text-sm font-medium text-gray-700 min-w-0 flex-shrink-0">
                              Timer:
                            </label>
                            <select
                              id={`timer-${index}`}
                              value={step.timerType}
                              onChange={(e) => updateStep(index, 'timerType', e.target.value)}
                              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                              data-testid={`select-timer-type-${index}`}
                            >
                              <option value="none">No Timer</option>
                              <option value="optional">Optional Timer</option>
                              <option value="required">Required Timer</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={handleCloseForm}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                  >
                    {editingTemplate ? 'Update Template' : 'Create Template'}
                  </button>
                </div>
              </form>
      </Modal>

      {/* Templates Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-4 px-6 font-medium text-gray-900">Template</th>
                <th className="text-left py-4 px-6 font-medium text-gray-900">Steps</th>
                <th className="text-left py-4 px-6 font-medium text-gray-900">Target Date</th>
                <th className="text-left py-4 px-6 font-medium text-gray-900">Status</th>
                <th className="text-right py-4 px-6 font-medium text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTemplates.map((template) => (
                <tr key={template.id} className="hover:bg-gray-50">
                  <td className="py-4 px-6">
                    <div>
                      <p className="font-medium text-gray-900">{template.name}</p>
                      <p className="text-sm text-gray-500 line-clamp-2">{template.goalStatement}</p>
                    </div>
                  </td>
                  
                  <td className="py-4 px-6">
                    <span className="text-sm text-gray-600">{template.steps.length}</span>
                  </td>
                  
                  <td className="py-4 px-6 text-sm text-gray-600">
                    {template.relativeTargetDuration || 'Not set'}
                  </td>
                  
                  <td className="py-4 px-6">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      template.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {template.status === 'active' ? 'Active' : 'Archived'}
                    </span>
                  </td>
                  
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => setViewingTemplate(template.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                        title="View template"
                        data-testid={`button-view-template-${template.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      
                      <button
                        onClick={() => editTemplate(template)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-xl transition-colors"
                        title="Edit template"
                        data-testid={`button-edit-template-${template.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      
                      <button
                        onClick={() => duplicateTemplate(template)}
                        className="p-2 text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
                        title="Duplicate template"
                        data-testid={`button-duplicate-template-${template.id}`}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      
                      {template.status === 'active' && (
                        <button
                          onClick={() => handleArchiveTemplate(template.id)}
                          className="p-2 text-amber-600 hover:bg-amber-50 rounded-xl transition-colors"
                          title="Archive template"
                          data-testid={`button-archive-template-${template.id}`}
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredTemplates.length === 0 && (
          <div className="text-center py-12">
            <Target className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || statusFilter !== 'all'
                ? (searchTerm 
                    ? `No templates match "${searchTerm}"` 
                    : 'No templates found. Try adjusting your search criteria.')
                : 'Create your first goal template to get started'
              }
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <button
                onClick={() => setShowForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
              >
                Create First Template
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}