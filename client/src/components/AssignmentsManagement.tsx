import { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, Search } from 'lucide-react';
import { apiRequest } from '../lib/auth';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import Tabs from './ui/Tabs';

interface CoachAssignment {
  id: string;
  coach_id: string;
  scooper_id: string;
  assigned_by?: string;
  created_at?: string;
}

interface GuardianRelationship {
  id: string;
  guardian_id: string;
  scooper_id: string;
  assigned_by?: string;
  created_at?: string;
}

export default function AssignmentsManagement() {
  const { employees } = useData();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'coach' | 'guardian'>('coach');

  const [coachAssignments, setCoachAssignments] = useState<CoachAssignment[]>([]);
  const [guardianRelationships, setGuardianRelationships] = useState<GuardianRelationship[]>([]);

  const [selectedCoachId, setSelectedCoachId] = useState('');
  const [selectedScooperForCoach, setSelectedScooperForCoach] = useState('');
  const [selectedGuardianId, setSelectedGuardianId] = useState('');
  const [selectedScooperForGuardian, setSelectedScooperForGuardian] = useState('');

  const [coachError, setCoachError] = useState('');
  const [guardianError, setGuardianError] = useState('');
  const [coachSuccess, setCoachSuccess] = useState('');
  const [guardianSuccess, setGuardianSuccess] = useState('');

  const jobCoaches = employees.filter(e => e.role === 'Job Coach' && e.isActive);
  const guardians = employees.filter(e => e.role === 'Guardian' && e.isActive);
  const superScoopers = employees.filter(e => e.role === 'Super Scooper' && e.isActive);

  const resolveName = (id: string) => {
    const emp = employees.find(e => e.id === id);
    if (!emp) return id;
    if (emp.first_name || emp.last_name) {
      return `${emp.first_name || ''} ${emp.last_name || ''}`.trim();
    }
    return (emp as any).name || id;
  };

  const fetchCoachAssignments = async () => {
    try {
      const res = await apiRequest('/api/coach-assignments');
      if (res.ok) {
        const data = await res.json();
        setCoachAssignments(data);
      }
    } catch (err) {
      console.error('Failed to fetch coach assignments:', err);
    }
  };

  const fetchGuardianRelationships = async () => {
    try {
      const res = await apiRequest('/api/guardian-relationships');
      if (res.ok) {
        const data = await res.json();
        setGuardianRelationships(data);
      }
    } catch (err) {
      console.error('Failed to fetch guardian relationships:', err);
    }
  };

  useEffect(() => {
    fetchCoachAssignments();
    fetchGuardianRelationships();
  }, []);

  const handleCreateCoachAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setCoachError('');
    setCoachSuccess('');

    if (!selectedCoachId || !selectedScooperForCoach) {
      setCoachError('Please select both a Job Coach and a Super Scooper.');
      return;
    }

    try {
      const res = await apiRequest('/api/coach-assignments', {
        method: 'POST',
        body: JSON.stringify({
          coach_id: selectedCoachId,
          scooper_id: selectedScooperForCoach,
          assigned_by: user?.id,
        }),
      });

      if (res.ok) {
        setCoachSuccess('Coach assignment created successfully.');
        setSelectedCoachId('');
        setSelectedScooperForCoach('');
        await fetchCoachAssignments();
        setTimeout(() => setCoachSuccess(''), 3000);
      } else if (res.status === 409) {
        setCoachError('This coach assignment already exists.');
      } else {
        const data = await res.json().catch(() => ({}));
        setCoachError(data.message || data.error || 'Failed to create coach assignment.');
      }
    } catch (err) {
      setCoachError('Network error. Please try again.');
    }
  };

  const handleCreateGuardianRelationship = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardianError('');
    setGuardianSuccess('');

    if (!selectedGuardianId || !selectedScooperForGuardian) {
      setGuardianError('Please select both a Guardian and a Super Scooper.');
      return;
    }

    try {
      const res = await apiRequest('/api/guardian-relationships', {
        method: 'POST',
        body: JSON.stringify({
          guardian_id: selectedGuardianId,
          scooper_id: selectedScooperForGuardian,
          assigned_by: user?.id,
        }),
      });

      if (res.ok) {
        setGuardianSuccess('Guardian relationship created successfully.');
        setSelectedGuardianId('');
        setSelectedScooperForGuardian('');
        await fetchGuardianRelationships();
        setTimeout(() => setGuardianSuccess(''), 3000);
      } else if (res.status === 409) {
        setGuardianError('This guardian relationship already exists.');
      } else {
        const data = await res.json().catch(() => ({}));
        setGuardianError(data.message || data.error || 'Failed to create guardian relationship.');
      }
    } catch (err) {
      setGuardianError('Network error. Please try again.');
    }
  };

  const handleDeleteCoachAssignment = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this coach assignment?')) return;

    try {
      const res = await apiRequest(`/api/coach-assignments/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchCoachAssignments();
      }
    } catch (err) {
      console.error('Failed to delete coach assignment:', err);
    }
  };

  const handleDeleteGuardianRelationship = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this guardian relationship?')) return;

    try {
      const res = await apiRequest(`/api/guardian-relationships/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchGuardianRelationships();
      }
    } catch (err) {
      console.error('Failed to delete guardian relationship:', err);
    }
  };

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto">
      <Tabs
        tabs={[
          { id: 'coach', label: 'Coach Assignments', icon: <Users className="h-4 w-4" /> },
          { id: 'guardian', label: 'Guardian Relationships', icon: <UserPlus className="h-4 w-4" /> },
        ]}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as 'coach' | 'guardian')}
        className="mb-6"
      />

      {activeTab === 'coach' && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Coach Assignment</h2>
            <form onSubmit={handleCreateCoachAssignment} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Job Coach</label>
                  <select
                    value={selectedCoachId}
                    onChange={(e) => setSelectedCoachId(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Job Coach</option>
                    {jobCoaches.map(coach => (
                      <option key={coach.id} value={coach.id}>
                        {coach.first_name} {coach.last_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Super Scooper</label>
                  <select
                    value={selectedScooperForCoach}
                    onChange={(e) => setSelectedScooperForCoach(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Super Scooper</option>
                    {superScoopers.map(scooper => (
                      <option key={scooper.id} value={scooper.id}>
                        {scooper.first_name} {scooper.last_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {coachError && (
                <p className="text-red-600 text-sm">{coachError}</p>
              )}
              {coachSuccess && (
                <p className="text-green-600 text-sm">{coachSuccess}</p>
              )}

              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <UserPlus className="h-4 w-4" />
                <span>Create Assignment</span>
              </button>
            </form>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Existing Coach Assignments</h2>
            </div>
            {coachAssignments.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No coach assignments yet. Create one above.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {coachAssignments.map(assignment => (
                  <div key={assignment.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center space-x-4">
                      <div>
                        <p className="text-sm text-gray-500">Job Coach</p>
                        <p className="font-medium text-gray-900">{resolveName(assignment.coach_id)}</p>
                      </div>
                      <span className="text-gray-400">→</span>
                      <div>
                        <p className="text-sm text-gray-500">Super Scooper</p>
                        <p className="font-medium text-gray-900">{resolveName(assignment.scooper_id)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteCoachAssignment(assignment.id)}
                      className="text-red-600 hover:bg-red-50 rounded-xl p-2 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'guardian' && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Guardian Relationship</h2>
            <form onSubmit={handleCreateGuardianRelationship} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Guardian</label>
                  <select
                    value={selectedGuardianId}
                    onChange={(e) => setSelectedGuardianId(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Guardian</option>
                    {guardians.map(guardian => (
                      <option key={guardian.id} value={guardian.id}>
                        {guardian.first_name} {guardian.last_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Super Scooper</label>
                  <select
                    value={selectedScooperForGuardian}
                    onChange={(e) => setSelectedScooperForGuardian(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Super Scooper</option>
                    {superScoopers.map(scooper => (
                      <option key={scooper.id} value={scooper.id}>
                        {scooper.first_name} {scooper.last_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {guardianError && (
                <p className="text-red-600 text-sm">{guardianError}</p>
              )}
              {guardianSuccess && (
                <p className="text-green-600 text-sm">{guardianSuccess}</p>
              )}

              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <UserPlus className="h-4 w-4" />
                <span>Create Relationship</span>
              </button>
            </form>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Existing Guardian Relationships</h2>
            </div>
            {guardianRelationships.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No guardian relationships yet. Create one above.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {guardianRelationships.map(relationship => (
                  <div key={relationship.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center space-x-4">
                      <div>
                        <p className="text-sm text-gray-500">Guardian</p>
                        <p className="font-medium text-gray-900">{resolveName(relationship.guardian_id)}</p>
                      </div>
                      <span className="text-gray-400">→</span>
                      <div>
                        <p className="text-sm text-gray-500">Super Scooper</p>
                        <p className="font-medium text-gray-900">{resolveName(relationship.scooper_id)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteGuardianRelationship(relationship.id)}
                      className="text-red-600 hover:bg-red-50 rounded-xl p-2 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
