import { useState, useEffect } from 'react';
import { ArrowLeft, Edit, Plus, Target, CheckCircle, Clock, AlertTriangle, Phone, Heart, Brain, Shield, Zap, Archive, X, Save, ChevronDown, ChevronRight, Star, Lightbulb, Users, UserCheck, Link, Copy, Check, Mail, Trash2, ClipboardCheck } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../lib/auth';
import GoalAssignment from './GoalAssignment';
import CoachCheckin from './CoachCheckin';
import EmployeeAvatar from './EmployeeAvatar';

interface EmployeeDetailProps {
  employeeId: string;
  onClose: () => void;
  onEdit: (employeeId: string) => void;
}

export default function EmployeeDetail({ employeeId, onClose, onEdit }: EmployeeDetailProps) {
  const { employees, developmentGoals, stepProgress, goalTemplates, updateGoal, archiveGoal } = useData();
  const { user } = useAuth();
  const [showGoalAssignment, setShowGoalAssignment] = useState(false);
  const [editingGoal, setEditingGoal] = useState<string | null>(null);
  const [expandedGoals, setExpandedGoals] = useState<Record<string, boolean>>({});
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    targetEndDate: ''
  });
  const [connectedGuardians, setConnectedGuardians] = useState<any[]>([]);
  const [assignedCoaches, setAssignedCoaches] = useState<any[]>([]);
  const [invitationEmail, setInvitationEmail] = useState(employees.find(e => e.id === employeeId)?.email || '');
  const [invitationLink, setInvitationLink] = useState('');
  const [invitationLoading, setInvitationLoading] = useState(false);
  const [invitationCopied, setInvitationCopied] = useState(false);
  const [invitationError, setInvitationError] = useState('');
  const [showAddGuardian, setShowAddGuardian] = useState(false);
  const [guardianForm, setGuardianForm] = useState({ first_name: '', last_name: '', email: '', phone: '', relationship_type: 'Parent/Guardian' });
  const [guardianSaving, setGuardianSaving] = useState(false);
  const [guardianError, setGuardianError] = useState('');
  const [coachMentees, setCoachMentees] = useState<any[]>([]);
  const [selectedMenteeId, setSelectedMenteeId] = useState('');
  const [menteeError, setMenteeError] = useState('');
  const [showCheckins, setShowCheckins] = useState(false);

  useEffect(() => {
    async function fetchRelationships() {
      const isManager = ['Administrator', 'Shift Lead', 'Assistant Manager'].includes(user?.role || '');
      if (!isManager) return;
      try {
        const employee = employees.find(e => e.id === employeeId);

        if (employee?.role === 'Job Coach') {
          const menteeRes = await apiRequest(`/api/coach-assignments/coach/${employeeId}`);
          if (menteeRes.ok) {
            const data = await menteeRes.json();
            setCoachMentees(data);
          }
        } else {
          const [guardianRes, coachRes] = await Promise.all([
            apiRequest(`/api/guardian-relationships/scooper/${employeeId}`),
            apiRequest(`/api/coach-assignments/scooper/${employeeId}`)
          ]);
          if (guardianRes.ok) {
            const data = await guardianRes.json();
            setConnectedGuardians(data);
          }
          if (coachRes.ok) {
            const data = await coachRes.json();
            setAssignedCoaches(data);
          }
        }
      } catch (err) {
      }
    }
    fetchRelationships();
  }, [employeeId, user?.role]);

  const getPersonName = (id: string) => {
    const emp = employees.find(e => e.id === id);
    if (!emp) return id;
    return emp.first_name && emp.last_name ? `${emp.first_name} ${emp.last_name}` : id;
  };

  const employee = employees.find(emp => emp.id === employeeId);
  const employeeGoals = developmentGoals.filter(goal => goal.employeeId === employeeId);
  
  if (!employee) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-600">Employee not found</p>
          <button onClick={onClose} className="mt-4 text-blue-600 hover:text-blue-700">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const activeGoals = employeeGoals.filter(goal => goal.status === 'active');
  const maintenanceGoals = employeeGoals.filter(goal => goal.status === 'maintenance');
  const archivedGoals = employeeGoals.filter(goal => goal.status === 'archived');

  const getRecentProgress = (goalId: string) => {
    const recent = stepProgress
      .filter(p => p.developmentGoalId === goalId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
    
    return recent;
  };

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

  const handleGenerateInvitation = async () => {
    if (!invitationEmail.trim()) {
      setInvitationError('Please enter an email address');
      return;
    }
    setInvitationLoading(true);
    setInvitationError('');
    setInvitationLink('');
    try {
      const res = await apiRequest('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId, email: invitationEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInvitationError(data.error || 'Failed to generate invitation');
        return;
      }
      setInvitationLink(data.setupUrl);
    } catch (err) {
      setInvitationError('Failed to generate invitation link');
    } finally {
      setInvitationLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(invitationLink);
      setInvitationCopied(true);
      setTimeout(() => setInvitationCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = invitationLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setInvitationCopied(true);
      setTimeout(() => setInvitationCopied(false), 2000);
    }
  };

  const handleCreateGuardian = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardianSaving(true);
    setGuardianError('');
    try {
      const res = await apiRequest('/api/guardian-relationships/create-with-guardian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scooper_id: employeeId,
          first_name: guardianForm.first_name.trim(),
          last_name: guardianForm.last_name.trim(),
          email: guardianForm.email.trim(),
          phone: guardianForm.phone.trim(),
          relationship_type: guardianForm.relationship_type,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setGuardianError(data.error || 'Failed to create guardian');
        return;
      }
      setGuardianForm({ first_name: '', last_name: '', email: '', phone: '', relationship_type: 'Parent/Guardian' });
      setShowAddGuardian(false);
      const guardianRes = await apiRequest(`/api/guardian-relationships/scooper/${employeeId}`);
      if (guardianRes.ok) {
        const data = await guardianRes.json();
        setConnectedGuardians(data);
      }
    } catch (err) {
      setGuardianError('Failed to create guardian');
    } finally {
      setGuardianSaving(false);
    }
  };

  const handleAssignMentee = async () => {
    if (!selectedMenteeId) return;
    setMenteeError('');
    try {
      const res = await apiRequest('/api/coach-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coach_id: employeeId,
          scooper_id: selectedMenteeId,
          assigned_by: user?.id,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setMenteeError(data.error || 'Failed to assign mentee');
        return;
      }
      setSelectedMenteeId('');
      const menteeRes = await apiRequest(`/api/coach-assignments/coach/${employeeId}`);
      if (menteeRes.ok) {
        const data = await menteeRes.json();
        setCoachMentees(data);
      }
    } catch (err) {
      setMenteeError('Failed to assign mentee');
    }
  };

  const handleRemoveMentee = async (assignmentId: string) => {
    if (!window.confirm('Are you sure you want to remove this mentee assignment?')) return;
    try {
      await apiRequest(`/api/coach-assignments/${assignmentId}`, { method: 'DELETE' });
      setCoachMentees(prev => prev.filter(a => a.id !== assignmentId));
    } catch (err) {
      console.error('Failed to remove mentee:', err);
    }
  };

  const handleRemoveGuardian = async (relationshipId: string) => {
    if (!window.confirm('Are you sure you want to remove this guardian?')) return;
    try {
      await apiRequest(`/api/guardian-relationships/${relationshipId}`, { method: 'DELETE' });
      setConnectedGuardians(prev => prev.filter(r => r.id !== relationshipId));
    } catch (err) {
      console.error('Failed to remove guardian:', err);
    }
  };

  const getGoalProgress = (goal: any) => {
    const requiredSteps = goal.steps.filter((step: any) => step.isRequired);
    return {
      totalRequired: requiredSteps.length,
      consecutiveCorrect: goal.consecutiveAllCorrect,
      masteryProgress: Math.min((goal.consecutiveAllCorrect / 3) * 100, 100)
    };
  };

  if (showGoalAssignment) {
    return (
      <GoalAssignment
        employeeId={employeeId}
        onClose={() => setShowGoalAssignment(false)}
        onSuccess={() => setShowGoalAssignment(false)}
      />
    );
  }

  if (showCheckins && employee.role === 'Super Scooper') {
    return (
      <CoachCheckin
        employeeId={employeeId}
        employeeName={`${employee.first_name} ${employee.last_name}`}
        onClose={() => setShowCheckins(false)}
      />
    );
  }

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 sm:gap-0">
        <div className="flex items-center space-x-4">
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div className="flex items-center space-x-4">
            <EmployeeAvatar 
              name={`${employee.first_name} ${employee.last_name}`}
              imageUrl={employee.profileImageUrl}
              size="lg"
            />
            <div>
              <h1 className="text-xl sm:text-3xl font-bold text-gray-900">{`${employee.first_name} ${employee.last_name}`}</h1>
              <p className="text-gray-600">{employee.role}</p>
              <div className="flex items-center space-x-2 mt-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  employee.isActive 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {employee.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 sm:space-x-3">
          {user?.role === 'Administrator' && employee.role !== 'Job Coach' && (
            <button
              onClick={() => setShowGoalAssignment(true)}
              className="flex items-center space-x-2 bg-blue-600 text-white px-2 sm:px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors text-sm sm:text-base"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Assign Goal</span>
              <span className="sm:hidden" title="Assign Goal">Goal</span>
            </button>
          )}
          
          {user?.role === 'Administrator' && (
            <button
              onClick={() => onEdit(employeeId)}
              className="flex items-center space-x-2 bg-gray-600 text-white px-2 sm:px-4 py-2 rounded-xl hover:bg-gray-700 transition-colors text-sm sm:text-base"
              title="Edit employee"
            >
              <Edit className="h-4 w-4" />
              <span className="hidden sm:inline">Edit</span>
            </button>
          )}

          {employee.role === 'Super Scooper' && (user?.role === 'Administrator' || user?.role === 'Job Coach') && (
            <button
              onClick={() => setShowCheckins(true)}
              className="flex items-center space-x-2 bg-amber-500 text-white px-2 sm:px-4 py-2 rounded-xl hover:bg-amber-600 transition-colors text-sm sm:text-base"
              title="Check-In Notes"
            >
              <ClipboardCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Check-In Notes</span>
              <span className="sm:hidden">Check-In</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - About Me Information */}
        <div className="lg:col-span-1 space-y-6">
          {/* Safety Information */}
          {(employee.allergies.length > 0 || employee.emergencyContacts.length > 0) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Shield className="h-5 w-5 text-red-500" />
                <h2 className="text-lg font-semibold text-gray-900">Safety Information</h2>
              </div>

              {employee.allergies.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-medium text-gray-900 mb-2 flex items-center">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mr-2" />
                    Allergies
                  </h3>
                  <div className="space-y-1 ml-6">
                    {employee.allergies.map((allergy, index) => (
                      <span
                        key={index}
                        className="inline-block bg-red-100 text-red-800 px-2 py-1 rounded-full text-sm mr-2 mb-1"
                      >
                        {allergy}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {employee.emergencyContacts.length > 0 && (
                <div>
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
          )}

          {/* Job Coaches */}
          {assignedCoaches.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
              <div className="flex items-center space-x-2 mb-4">
                <UserCheck className="h-5 w-5 text-green-500" />
                <h2 className="text-lg font-semibold text-gray-900">Job Coach{assignedCoaches.length > 1 ? 'es' : ''}</h2>
              </div>
              <div className="space-y-2">
                {assignedCoaches.map((assignment: any) => (
                  <div key={assignment.id} className="text-sm bg-green-50 text-green-800 px-3 py-2 rounded-lg">
                    {getPersonName(assignment.coach_id)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assigned Mentees Section - for Job Coaches, visible to managers */}
          {employee.role === 'Job Coach' && ['Administrator', 'Shift Lead', 'Assistant Manager'].includes(user?.role || '') && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-green-500" />
                  <h2 className="text-lg font-semibold text-gray-900">Assigned Mentees</h2>
                </div>
              </div>

              {user?.role === 'Administrator' && (
                <div className="mb-4">
                  {menteeError && (
                    <div className="text-sm text-red-600 bg-red-50 p-2 rounded-lg mb-3">{menteeError}</div>
                  )}
                  <div className="flex items-center gap-3">
                    <select
                      value={selectedMenteeId}
                      onChange={e => setSelectedMenteeId(e.target.value)}
                      className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="">Select an employee to assign...</option>
                      {employees
                        .filter(e =>
                          e.isActive &&
                          e.role === 'Super Scooper' &&
                          !coachMentees.some(m => m.scooper_id === e.id)
                        )
                        .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`))
                        .map(e => (
                          <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                        ))
                      }
                    </select>
                    <button
                      onClick={handleAssignMentee}
                      disabled={!selectedMenteeId}
                      className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
                    >
                      Assign
                    </button>
                  </div>
                </div>
              )}

              {coachMentees.length > 0 ? (
                <div className="space-y-3">
                  {coachMentees.map((assignment: any) => (
                    <div key={assignment.id} className="flex items-center justify-between bg-green-50 px-4 py-3 rounded-xl">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{getPersonName(assignment.scooper_id)}</p>
                        <p className="text-xs text-gray-500">
                          {employees.find(e => e.id === assignment.scooper_id)?.email || ''}
                        </p>
                      </div>
                      {user?.role === 'Administrator' && (
                        <button
                          onClick={() => handleRemoveMentee(assignment.id)}
                          className="text-red-400 hover:text-red-600 p-1"
                          title="Remove assignment"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No mentees assigned yet.</p>
              )}
            </div>
          )}

          {/* Guardians Section - for Super Scoopers, visible to managers */}
          {employee.role === 'Super Scooper' && ['Administrator', 'Shift Lead', 'Assistant Manager'].includes(user?.role || '') && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-purple-500" />
                  <h2 className="text-lg font-semibold text-gray-900">Guardians</h2>
                </div>
                {user?.role === 'Administrator' && (
                  <button
                    onClick={() => setShowAddGuardian(!showAddGuardian)}
                    className="flex items-center space-x-1 text-sm font-medium text-purple-600 hover:text-purple-700"
                  >
                    {showAddGuardian ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    <span>{showAddGuardian ? 'Cancel' : 'Add Guardian'}</span>
                  </button>
                )}
              </div>

              {showAddGuardian && (
                <form onSubmit={handleCreateGuardian} className="bg-purple-50 rounded-xl p-4 mb-4 space-y-3">
                  <h3 className="font-medium text-gray-900 text-sm">New Guardian</h3>
                  {guardianError && (
                    <div className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">{guardianError}</div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">First Name *</label>
                      <input
                        type="text"
                        required
                        value={guardianForm.first_name}
                        onChange={e => setGuardianForm(prev => ({ ...prev, first_name: e.target.value }))}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        placeholder="First name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Last Name *</label>
                      <input
                        type="text"
                        required
                        value={guardianForm.last_name}
                        onChange={e => setGuardianForm(prev => ({ ...prev, last_name: e.target.value }))}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        placeholder="Last name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                      <input
                        type="email"
                        value={guardianForm.email}
                        onChange={e => setGuardianForm(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        placeholder="Email address"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={guardianForm.phone}
                        onChange={e => setGuardianForm(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        placeholder="Phone number"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Relationship</label>
                      <select
                        value={guardianForm.relationship_type}
                        onChange={e => setGuardianForm(prev => ({ ...prev, relationship_type: e.target.value }))}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      >
                        <option value="Parent/Guardian">Parent/Guardian</option>
                        <option value="Legal Guardian">Legal Guardian</option>
                        <option value="Case Manager">Case Manager</option>
                        <option value="Family Member">Family Member</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={guardianSaving}
                      className="bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
                    >
                      {guardianSaving ? 'Saving...' : 'Add Guardian'}
                    </button>
                  </div>
                </form>
              )}

              {connectedGuardians.length > 0 ? (
                <div className="space-y-3">
                  {connectedGuardians.map((rel: any) => {
                    const guardianName = rel.guardian_first_name && rel.guardian_last_name
                      ? `${rel.guardian_first_name} ${rel.guardian_last_name}`
                      : getPersonName(rel.guardian_id);
                    return (
                      <div key={rel.id} className="flex items-center justify-between bg-purple-50 px-4 py-3 rounded-xl">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{guardianName}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                            {rel.guardian_email && (
                              <p className="text-xs text-gray-500">{rel.guardian_email}</p>
                            )}
                            {rel.relationship_type && (
                              <p className="text-xs text-purple-600">{rel.relationship_type}</p>
                            )}
                          </div>
                        </div>
                        {user?.role === 'Administrator' && (
                          <button
                            onClick={() => handleRemoveGuardian(rel.id)}
                            className="text-red-400 hover:text-red-600 p-1"
                            title="Remove guardian"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No guardians linked yet.</p>
              )}
            </div>
          )}

          {/* Account Access - for Job Coach and Guardian roles, visible to Admins */}
          {user?.role === 'Administrator' && ['Job Coach', 'Guardian'].includes(employee.role) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Mail className="h-5 w-5 text-indigo-500" />
                <h2 className="text-lg font-semibold text-gray-900">Account Access</h2>
              </div>

              {(employee as any).has_system_access && (employee as any).password ? (
                <div className="flex items-center space-x-2 text-sm text-green-700 bg-green-50 p-3 rounded-lg mb-3">
                  <CheckCircle className="h-4 w-4" />
                  <span>Account is set up - {employee.email}</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg mb-3">
                  <AlertTriangle className="h-4 w-4" />
                  <span>No account set up yet</span>
                </div>
              )}

              <p className="text-sm text-gray-600 mb-3">
                Generate an invitation link for this {employee.role.toLowerCase()} to create their login credentials.
              </p>

              <div className="space-y-3">
                <input
                  type="text"
                  value={invitationEmail}
                  onChange={(e) => setInvitationEmail(e.target.value)}
                  placeholder="Enter email or username"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-base"
                />

                <button
                  onClick={handleGenerateInvitation}
                  disabled={invitationLoading}
                  className="w-full flex items-center justify-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  <Link className="h-4 w-4" />
                  <span>{invitationLoading ? 'Generating...' : 'Generate Invitation Link'}</span>
                </button>

                {invitationError && (
                  <p className="text-sm text-red-600">{invitationError}</p>
                )}

                {invitationLink && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 font-medium">Invitation link (expires in 7 days):</p>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        readOnly
                        value={invitationLink}
                        className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 font-mono"
                      />
                      <button
                        onClick={handleCopyLink}
                        className={`p-2 rounded-lg transition-colors ${
                          invitationCopied
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        title="Copy link"
                      >
                        {invitationCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400">Share this link with the {employee.role.toLowerCase()} to let them set up their account.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Support Information */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
            <div className="flex items-center space-x-2 mb-4">
             <Heart className="h-5 w-5 text-pink-500" />
             <h2 className="text-lg font-semibold text-gray-900">Support Information</h2>
            </div>

            <div className="space-y-6">
              {employee.interestsMotivators.length > 0 && (
                <div>
                 <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
                    <Heart className="h-4 w-4 text-green-600 mr-2" />
                    Interests & Motivators
                  </h3>
                  <div className="flex flex-wrap gap-2 ml-6">
                    {employee.interestsMotivators.map((interest, index) => (
                      <span
                        key={index}
                       className="px-3 py-2 bg-green-100 text-green-800 rounded-full text-sm"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {employee.challenges.length > 0 && (
                <div>
                 <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
                    <Zap className="h-4 w-4 text-orange-500 mr-2" />
                    Challenges
                  </h3>
                  <div className="flex flex-wrap gap-2 ml-6">
                    {employee.challenges.map((challenge, index) => (
                      <span
                        key={index}
                       className="px-3 py-2 bg-yellow-100 text-yellow-800 rounded-full text-sm"
                      >
                        {challenge}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {employee.regulationStrategies.length > 0 && (
                <div>
                 <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
                    <Brain className="h-4 w-4 text-purple-600 mr-2" />
                    Support Strategies
                  </h3>
                  <div className="flex flex-wrap gap-2 ml-6">
                    {employee.regulationStrategies.map((strategy, index) => (
                      <span
                        key={index}
                       className="px-3 py-2 bg-blue-100 text-blue-800 rounded-full text-sm"
                      >
                        {strategy}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Goals */}
        {employee.role !== 'Job Coach' && (
        <div className="lg:col-span-2 space-y-6">
          {/* Active Goals */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <Target className="h-5 w-5 text-blue-500" />
                <h2 className="text-lg font-semibold text-gray-900">Active Goals</h2>
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                  {activeGoals.length}/2
                </span>
              </div>
            </div>

            {activeGoals.length > 0 ? (
              <div className="space-y-6">
                {activeGoals.map(goal => {
                  const progress = getGoalProgress(goal);
                  const recentProgress = getRecentProgress(goal.id);
                  
                  return (
                    <div key={goal.id} className="border border-gray-200 rounded-xl p-4">
                      {editingGoal === goal.id ? (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Goal Title</label>
                            <input
                              type="text"
                              value={editForm.title}
                              onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                            <textarea
                              value={editForm.description}
                              onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                              rows={3}
                              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Target End Date</label>
                            <input
                              type="date"
                              value={editForm.targetEndDate}
                              onChange={(e) => setEditForm(prev => ({ ...prev, targetEndDate: e.target.value }))}
                              className="w-48 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                            />
                          </div>
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={handleCancelEdit}
                              className="flex items-center space-x-2 bg-gray-600 text-white px-3 py-2 rounded-xl hover:bg-gray-700 transition-colors"
                            >
                              <X className="h-4 w-4" />
                              <span>Cancel</span>
                            </button>
                            <button
                              onClick={handleSaveGoal}
                              className="flex items-center space-x-2 bg-green-600 text-white px-3 py-2 rounded-xl hover:bg-green-700 transition-colors"
                            >
                              <Save className="h-4 w-4" />
                              <span>Save</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900 mb-1">{goal.title}</h3>
                              <p className="text-sm text-gray-600 mb-3">{goal.description}</p>
                              
                              <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                                <span>Started: {new Date(goal.startDate).toLocaleDateString()}</span>
                                <span>Target: {new Date(goal.targetEndDate).toLocaleDateString()}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-2 ml-4">
                              <div className="text-right">
                                <div className="text-lg font-bold text-blue-600">
                                  {goal.consecutiveAllCorrect}/3
                                </div>
                                <div className="text-xs text-gray-500">consecutive correct</div>
                              </div>
                              
                              {user?.role === 'Administrator' && (
                                <div className="flex flex-col space-y-1">
                                  <button
                                    onClick={() => handleEditGoal(goal)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                                    title="Edit goal"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleArchiveGoal(goal.id, goal.title)}
                                    className="p-2 text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
                                    title="Archive goal"
                                  >
                                    <Archive className="h-4 w-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="mb-4">
                            <div className="flex justify-between text-sm text-gray-600 mb-1">
                              <span>Mastery Progress</span>
                              <span>{Math.round(progress.masteryProgress)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progress.masteryProgress}%` }}
                              ></div>
                            </div>
                          </div>

                          {/* Goal Steps */}
                          {/* Goal Steps - Collapsible */}
                          <div className="mb-4">
                            <button
                              onClick={() => {
                                const newExpanded = { ...expandedGoals };
                                newExpanded[goal.id] = !newExpanded[goal.id];
                                setExpandedGoals(newExpanded);
                              }}
                              className="flex items-center space-x-2 text-left w-full hover:bg-gray-50 p-2 rounded-xl transition-colors"
                            >
                              {expandedGoals[goal.id] ? (
                                <ChevronDown className="h-4 w-4 text-gray-500" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-500" />
                              )}
                              <h4 className="font-medium text-gray-900">Steps ({progress.totalRequired}) - Click to expand</h4>
                            </button>
                            
                            {expandedGoals[goal.id] && (
                              <div className="mt-4 space-y-2 border-t border-gray-200 pt-4">
                                {goal.steps.map((step: any) => (
                                  <div
                                    key={step.id}
                                    className="flex items-center space-x-2 text-sm p-3 rounded-xl bg-white border border-gray-200 shadow-sm"
                                  >
                                    <span className="font-medium text-gray-700">
                                      {step.stepOrder}.
                                    </span>
                                    <span className="flex-1 text-gray-900">{step.stepDescription}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Recent Progress */}
                          {recentProgress.length > 0 && (
                            <div>
                              <h4 className="font-medium text-gray-900 mb-2">Recent Progress</h4>
                              <div className="flex space-x-1">
                                {recentProgress.slice(0, 5).reverse().map((progress, index) => (
                                  <div
                                    key={index}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                                      progress.outcome === 'correct'
                                        ? 'bg-green-100 text-green-700'
                                        : progress.outcome === 'verbal_prompt'
                                        ? 'bg-yellow-100 text-yellow-700'
                                        : 'bg-gray-100 text-gray-600'
                                    }`}
                                    title={`${new Date(progress.date).toLocaleDateString()}: ${progress.outcome}`}
                                  >
                                    {progress.outcome === 'correct' ? '✓' : 
                                     progress.outcome === 'verbal_prompt' ? '◐' : '◯'}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Mastery Status */}
                      {!editingGoal && goal.consecutiveAllCorrect >= 2 && (
                        <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                          <div className="flex items-center space-x-2">
                            <AlertTriangle className="h-5 w-5 text-orange-500" />
                            <div>
                              <p className="font-medium text-orange-800">Near Mastery!</p>
                              <p className="text-sm text-orange-700">
                                {3 - goal.consecutiveAllCorrect} more consecutive correct shift{3 - goal.consecutiveAllCorrect !== 1 ? 's' : ''} needed for mastery.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {!editingGoal && goal.masteryAchieved && (
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
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Target className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Goals</h3>
                <p className="text-gray-600 mb-4">Assign development goals to start tracking progress</p>
                <button
                  onClick={() => setShowGoalAssignment(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
                >
                  Assign First Goal
                </button>
              </div>
            )}
          </div>

          {/* Maintenance Goals */}
          {maintenanceGoals.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
              <div className="flex items-center space-x-2 mb-6">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <h2 className="text-lg font-semibold text-gray-900">Maintenance Goals</h2>
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                  {maintenanceGoals.length}
                </span>
              </div>

              <div className="space-y-4">
                {maintenanceGoals.map(goal => (
                  <div key={goal.id} className="border border-green-200 rounded-xl p-4 bg-green-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{goal.title}</h3>
                        <p className="text-sm text-gray-600">
                          Mastered on {goal.masteryDate ? new Date(goal.masteryDate).toLocaleDateString() : 'Unknown'}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-6 w-6 text-green-500" />
                        {user?.role === 'Administrator' && (
                          <button
                            onClick={() => handleArchiveGoal(goal.id, goal.title)}
                            className="p-2 text-gray-600 hover:bg-white hover:bg-opacity-50 rounded-xl transition-colors"
                            title="Archive goal"
                          >
                            <Archive className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Archived Goals */}
          {archivedGoals.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
              <div className="flex items-center space-x-2 mb-6">
                <Clock className="h-5 w-5 text-gray-400" />
                <h2 className="text-lg font-semibold text-gray-900">Archived Goals</h2>
                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs font-medium">
                  {archivedGoals.length}
                </span>
              </div>

              <div className="space-y-4">
                {archivedGoals.map(goal => (
                  <div key={goal.id} className="border border-gray-200 rounded-xl p-4">
                    <h3 className="font-semibold text-gray-900">{goal.title}</h3>
                    <p className="text-sm text-gray-600">
                      {goal.startDate} - {goal.targetEndDate}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}