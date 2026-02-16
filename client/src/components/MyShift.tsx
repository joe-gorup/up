import { useState } from 'react';
import { Users, Target, CheckCircle, Clock, Search, ChevronRight, PinOff, X, ClipboardList, AlertTriangle, Phone, Heart, Brain } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import EmployeeAvatar from './EmployeeAvatar';
import EmployeeDetail from './EmployeeDetail';

export default function MyShift() {
  const { employees, developmentGoals, stepProgress } = useData();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    const saved = sessionStorage.getItem(`myshift-pinned-${user?.id}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [pendingSelections, setPendingSelections] = useState<string[]>([]);

  const assessableEmployees = employees.filter(emp =>
    emp.isActive && ['Super Scooper', 'Assistant Manager'].includes(emp.role)
  );

  const pinnedEmployees = assessableEmployees.filter(emp => pinnedIds.includes(emp.id));

  const availableEmployees = assessableEmployees
    .filter(emp => !pinnedIds.includes(emp.id))
    .filter(emp => {
      if (!searchQuery.trim()) return true;
      const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
      return fullName.includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => {
      const firstNameCompare = (a.first_name || '').localeCompare(b.first_name || '');
      if (firstNameCompare !== 0) return firstNameCompare;
      return (a.last_name || '').localeCompare(b.last_name || '');
    });

  const savePinned = (ids: string[]) => {
    setPinnedIds(ids);
    sessionStorage.setItem(`myshift-pinned-${user?.id}`, JSON.stringify(ids));
  };

  const unpinEmployee = (id: string) => {
    const updated = pinnedIds.filter(pid => pid !== id);
    savePinned(updated);
  };

  const clearAll = () => {
    savePinned([]);
  };

  const togglePendingSelection = (employeeId: string) => {
    setPendingSelections(prev =>
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handleOpenSearch = () => {
    setPendingSelections([]);
    setSearchQuery('');
    setShowSearch(true);
  };

  const handleAddSelected = () => {
    if (pendingSelections.length > 0) {
      const updated = [...pinnedIds, ...pendingSelections];
      savePinned(updated);
    }
    setPendingSelections([]);
    setSearchQuery('');
    setShowSearch(false);
  };

  const getEmployeeGoals = (employeeId: string) => {
    return developmentGoals.filter(goal =>
      goal.employeeId === employeeId && goal.status === 'active'
    );
  };

  const getEmployeeStats = (employeeId: string) => {
    const goals = developmentGoals.filter(g => g.employeeId === employeeId);
    const activeGoals = goals.filter(g => g.status === 'active');
    const masteredGoals = goals.filter(g => g.masteryAchieved);
    const recentProgress = stepProgress
      .filter(p => p.employeeId === employeeId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
    const successRate = recentProgress.length > 0
      ? Math.round((recentProgress.filter(p => p.outcome === 'correct').length / recentProgress.length) * 100)
      : 0;
    return { activeGoals: activeGoals.length, masteredGoals: masteredGoals.length, successRate };
  };

  if (selectedEmployeeId) {
    return (
      <EmployeeDetail
        employeeId={selectedEmployeeId}
        onClose={() => setSelectedEmployeeId(null)}
        onEdit={() => {}}
      />
    );
  }

  if (showSearch) {
    return (
      <div className="p-3 sm:p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Add Employees to Shift</h2>
            <p className="text-sm text-gray-500 mt-1">
              Select employees to add to your working list
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowSearch(false); setPendingSelections([]); setSearchQuery(''); }}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddSelected}
              disabled={pendingSelections.length === 0}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all ${
                pendingSelections.length > 0
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              }`}
            >
              {pendingSelections.length > 0
                ? `Add ${pendingSelections.length} Employee${pendingSelections.length !== 1 ? 's' : ''}`
                : 'Add to Shift'}
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                autoFocus
              />
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setPendingSelections([])}
              className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              Clear All
            </button>
            <button
              onClick={() => setPendingSelections(availableEmployees.map(emp => emp.id))}
              className="px-4 py-3 bg-blue-100 text-blue-700 rounded-xl hover:bg-blue-200 transition-colors text-sm font-medium"
            >
              Select All
            </button>
          </div>
        </div>

        <div className="sm:hidden space-y-3">
          {availableEmployees.map((employee) => {
            const isSelected = pendingSelections.includes(employee.id);
            const employeeGoals = getEmployeeGoals(employee.id);

            return (
              <button
                key={employee.id}
                onClick={() => togglePendingSelection(employee.id)}
                className={`w-full text-left rounded-xl border p-4 transition-all ${
                  isSelected
                    ? 'bg-blue-50 border-blue-300 shadow-sm'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    readOnly
                    className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded flex-shrink-0 pointer-events-none"
                  />
                  <EmployeeAvatar
                    name={`${employee.first_name} ${employee.last_name}`}
                    imageUrl={employee.profileImageUrl}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{`${employee.first_name} ${employee.last_name}`}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-sm text-gray-500">{employee.role}</span>
                      <span className="text-sm font-medium text-blue-600">
                        {employeeGoals.length} goal{employeeGoals.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  {employee.allergies.length > 0 && (
                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  )}
                </div>
              </button>
            );
          })}

          {availableEmployees.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No employees found</h3>
              <p className="text-gray-600">
                {searchQuery.trim()
                  ? `No employees match "${searchQuery}"`
                  : 'All employees are already on your shift list'
                }
              </p>
            </div>
          )}
        </div>

        <div className="hidden sm:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-center py-4 px-4 font-medium text-gray-900 w-12">
                  <input
                    type="checkbox"
                    checked={pendingSelections.length === availableEmployees.length && availableEmployees.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setPendingSelections(availableEmployees.map(emp => emp.id));
                      } else {
                        setPendingSelections([]);
                      }
                    }}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </th>
                <th className="text-left py-4 px-4 font-medium text-gray-900">Employee</th>
                <th className="text-left py-4 px-4 font-medium text-gray-900">Role</th>
                <th className="text-left py-4 px-4 font-medium text-gray-900 hidden lg:table-cell">Support Info</th>
                <th className="text-left py-4 px-4 font-medium text-gray-900">Active Goals</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {availableEmployees.map((employee) => {
                const isSelected = pendingSelections.includes(employee.id);
                const employeeGoals = getEmployeeGoals(employee.id);

                return (
                  <tr
                    key={employee.id}
                    className={`hover:bg-gray-50 cursor-pointer ${
                      isSelected ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => togglePendingSelection(employee.id)}
                  >
                    <td className="py-4 px-4 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => togglePendingSelection(employee.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3">
                        <EmployeeAvatar
                          name={`${employee.first_name} ${employee.last_name}`}
                          imageUrl={employee.profileImageUrl}
                          size="md"
                        />
                        <p className="font-medium text-gray-900">{`${employee.first_name} ${employee.last_name}`}</p>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <span className="text-sm text-gray-900">{employee.role}</span>
                    </td>

                    <td className="py-4 px-4 hidden lg:table-cell">
                      <div className="flex items-center space-x-3">
                        {employee.allergies.length > 0 && (
                          <div className="flex items-center space-x-1 text-amber-600">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-xs">{employee.allergies.length}</span>
                          </div>
                        )}
                        {employee.emergencyContacts.length > 0 && (
                          <div className="flex items-center space-x-1 text-blue-600">
                            <Phone className="h-4 w-4" />
                            <span className="text-xs">{employee.emergencyContacts.length}</span>
                          </div>
                        )}
                        {employee.interestsMotivators.length > 0 && (
                          <div className="flex items-center space-x-1 text-green-600">
                            <Heart className="h-4 w-4" />
                            <span className="text-xs">{employee.interestsMotivators.length}</span>
                          </div>
                        )}
                        {employee.regulationStrategies.length > 0 && (
                          <div className="flex items-center space-x-1 text-purple-600">
                            <Brain className="h-4 w-4" />
                            <span className="text-xs">{employee.regulationStrategies.length}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-blue-600">
                          {employeeGoals.length}
                        </span>
                        <span className="text-sm text-gray-500">
                          goal{employeeGoals.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {availableEmployees.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No employees found</h3>
              <p className="text-gray-600">
                {searchQuery.trim()
                  ? `No employees match "${searchQuery}"`
                  : 'All employees are already on your shift list'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">
              {pinnedEmployees.length > 0
                ? `${pinnedEmployees.length} employee${pinnedEmployees.length !== 1 ? 's' : ''} on your list today`
                : 'Search and add employees to your shift list'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {pinnedEmployees.length > 0 && (
              <button
                onClick={clearAll}
                className="text-sm text-gray-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
              >
                Clear All
              </button>
            )}
            <button
              onClick={handleOpenSearch}
              className="flex items-center gap-2 px-2 sm:px-4 py-2 rounded-xl text-sm font-medium transition-all bg-blue-600 text-white hover:bg-blue-700"
              title="Add Employees"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Add Employees</span>
            </button>
          </div>
        </div>
      </div>

      {pinnedEmployees.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pinnedEmployees.map(emp => {
            const stats = getEmployeeStats(emp.id);
            return (
              <div
                key={emp.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md hover:border-blue-300 transition-all group relative"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    unpinEmployee(emp.id);
                  }}
                  className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  title="Remove from shift list"
                >
                  <PinOff className="h-4 w-4" />
                </button>

                <button
                  onClick={() => setSelectedEmployeeId(emp.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-center space-x-4 mb-4">
                    <EmployeeAvatar
                      name={`${emp.first_name} ${emp.last_name}`}
                      imageUrl={emp.profileImageUrl}
                      size="lg"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {emp.first_name} {emp.last_name}
                      </h3>
                      <p className="text-sm text-gray-500">{emp.role}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-blue-50 rounded-lg p-2 text-center">
                      <div className="flex items-center justify-center mb-1">
                        <Target className="h-3.5 w-3.5 text-blue-600" />
                      </div>
                      <div className="text-lg font-bold text-blue-600">{stats.activeGoals}</div>
                      <div className="text-xs text-gray-500">Active</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-2 text-center">
                      <div className="flex items-center justify-center mb-1">
                        <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                      </div>
                      <div className="text-lg font-bold text-green-600">{stats.masteredGoals}</div>
                      <div className="text-xs text-gray-500">Mastered</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-2 text-center">
                      <div className="flex items-center justify-center mb-1">
                        <Clock className="h-3.5 w-3.5 text-purple-600" />
                      </div>
                      <div className="text-lg font-bold text-purple-600">{stats.successRate}%</div>
                      <div className="text-xs text-gray-500">Success</div>
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <ClipboardList className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No Employees Selected</h2>
          <p className="text-gray-500 max-w-md mx-auto mb-6">
            Click "Add Employees" above to search and pin the employees you'll be working with today.
          </p>
          <button
            onClick={handleOpenSearch}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            <Search className="h-5 w-5" />
            Add Employees to Your Shift
          </button>
        </div>
      )}
    </div>
  );
}
