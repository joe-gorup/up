import { useState } from 'react';
import { Heart, Target, CheckCircle, Clock, Search, ChevronRight, Users } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import EmployeeAvatar from './EmployeeAvatar';
import EmployeeDetail from './EmployeeDetail';

export default function MyLovedOnes() {
  const { employees, developmentGoals, stepProgress } = useData();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedScooperId, setSelectedScooperId] = useState<string | null>(null);

  const scoopers = employees.filter(emp =>
    emp.role === 'Super Scooper' && emp.isActive
  );

  const filteredScoopers = scoopers.filter(scooper => {
    const fullName = `${scooper.first_name} ${scooper.last_name}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  const getScooperStats = (scooperId: string) => {
    const goals = developmentGoals.filter(g => g.employeeId === scooperId);
    const activeGoals = goals.filter(g => g.status === 'active');
    const masteredGoals = goals.filter(g => g.masteryAchieved);
    const recentProgress = stepProgress
      .filter(p => p.employeeId === scooperId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
    const successRate = recentProgress.length > 0
      ? Math.round((recentProgress.filter(p => p.outcome === 'correct').length / recentProgress.length) * 100)
      : 0;
    return { activeGoals: activeGoals.length, masteredGoals: masteredGoals.length, successRate, totalGoals: goals.length };
  };

  if (selectedScooperId) {
    return (
      <EmployeeDetail
        employeeId={selectedScooperId}
        onClose={() => setSelectedScooperId(null)}
        onEdit={() => {}}
      />
    );
  }

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      {scoopers.length === 0 && (
        <p className="text-gray-600 mb-4">No family members have been linked to your account yet.</p>
      )}

      {scoopers.length > 0 && (
        <>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredScoopers.map(scooper => {
              const stats = getScooperStats(scooper.id);
              return (
                <button
                  key={scooper.id}
                  onClick={() => setSelectedScooperId(scooper.id)}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 text-left hover:shadow-md hover:border-rose-300 transition-all group"
                >
                  <div className="flex items-center space-x-4 mb-4">
                    <EmployeeAvatar
                      name={`${scooper.first_name} ${scooper.last_name}`}
                      imageUrl={scooper.profileImageUrl}
                      size="lg"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {scooper.first_name} {scooper.last_name}
                      </h3>
                      <p className="text-sm text-gray-500">Super Scooper</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-rose-500 transition-colors" />
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
              );
            })}
          </div>

          {filteredScoopers.length === 0 && searchQuery && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No family members match your search</p>
            </div>
          )}
        </>
      )}

      {scoopers.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Heart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No Family Members Linked</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            Your account hasn't been linked to any family members yet. Once an administrator connects your account, you'll be able to view their profiles and track their progress here.
          </p>
        </div>
      )}
    </div>
  );
}
