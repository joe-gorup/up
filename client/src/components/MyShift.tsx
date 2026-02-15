import { useState } from 'react';
import { Users, Target, CheckCircle, Clock, Search, ChevronRight, Pin, PinOff, X, ClipboardList } from 'lucide-react';
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

  const assessableEmployees = employees.filter(emp =>
    emp.isActive && ['Super Scooper', 'Assistant Manager'].includes(emp.role)
  );

  const pinnedEmployees = assessableEmployees.filter(emp => pinnedIds.includes(emp.id));

  const searchResults = searchQuery.trim()
    ? assessableEmployees
        .filter(emp => {
          const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
          return fullName.includes(searchQuery.toLowerCase()) && !pinnedIds.includes(emp.id);
        })
        .sort((a, b) => (a.first_name || '').localeCompare(b.first_name || ''))
    : [];

  const savePinned = (ids: string[]) => {
    setPinnedIds(ids);
    sessionStorage.setItem(`myshift-pinned-${user?.id}`, JSON.stringify(ids));
  };

  const pinEmployee = (id: string) => {
    const updated = [...pinnedIds, id];
    savePinned(updated);
    setSearchQuery('');
  };

  const unpinEmployee = (id: string) => {
    const updated = pinnedIds.filter(pid => pid !== id);
    savePinned(updated);
  };

  const clearAll = () => {
    savePinned([]);
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

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">My Shift</h2>
            <p className="text-sm text-gray-500 mt-1">
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
              onClick={() => setShowSearch(!showSearch)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                showSearch
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {showSearch ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
              {showSearch ? 'Done' : 'Add Employees'}
            </button>
          </div>
        </div>

        {showSearch && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                autoFocus
              />
            </div>

            {searchQuery.trim() && searchResults.length > 0 && (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {searchResults.map(emp => (
                  <button
                    key={emp.id}
                    onClick={() => pinEmployee(emp.id)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-blue-50 transition-colors text-left group"
                  >
                    <div className="flex items-center space-x-3">
                      <EmployeeAvatar
                        name={`${emp.first_name} ${emp.last_name}`}
                        imageUrl={emp.profileImageUrl}
                        size="sm"
                      />
                      <div>
                        <span className="font-medium text-gray-900">{emp.first_name} {emp.last_name}</span>
                        <span className="text-xs text-gray-500 ml-2">{emp.role}</span>
                      </div>
                    </div>
                    <Pin className="h-4 w-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                  </button>
                ))}
              </div>
            )}

            {searchQuery.trim() && searchResults.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-3">
                {assessableEmployees.filter(e => !pinnedIds.includes(e.id)).length === 0
                  ? 'All employees are already on your list'
                  : 'No employees match your search'}
              </p>
            )}

            {!searchQuery.trim() && (
              <p className="text-sm text-gray-500 text-center py-2">
                Type a name to search ({assessableEmployees.filter(e => !pinnedIds.includes(e.id)).length} employees available)
              </p>
            )}
          </div>
        )}
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
                    <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
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
            onClick={() => setShowSearch(true)}
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
