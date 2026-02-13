import React, { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { Target, Clock, CheckCircle, BarChart3, User, Star } from 'lucide-react';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const { employees, developmentGoals, stepProgress } = useData();

  // Find the current employee's data
  const currentEmployee = useMemo(() => {
    return employees.find(emp => emp.email === user?.email);
  }, [employees, user]);

  // Filter goals for the current employee
  const myGoals = useMemo(() => {
    if (!currentEmployee) return [];
    return developmentGoals.filter(goal => goal.employeeId === currentEmployee.id);
  }, [developmentGoals, currentEmployee]);

  // Calculate progress statistics
  const progressStats = useMemo(() => {
    const totalGoals = myGoals.length;
    const completedGoals = myGoals.filter(goal => goal.masteryAchieved).length;
    const activeGoals = myGoals.filter(goal => goal.status === 'active').length;
    
    // Calculate total progress across all goals
    const myProgress = stepProgress.filter(progress => 
      progress.employeeId === currentEmployee?.id && progress.status === 'submitted'
    );
    
    const correctOutcomes = myProgress.filter(p => p.outcome === 'correct').length;
    const totalOutcomes = myProgress.length;
    const successRate = totalOutcomes > 0 ? Math.round((correctOutcomes / totalOutcomes) * 100) : 0;

    return {
      totalGoals,
      completedGoals,
      activeGoals,
      successRate,
      totalAssessments: totalOutcomes
    };
  }, [myGoals, stepProgress, currentEmployee]);

  if (!currentEmployee) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">Employee profile not found. Please contact your administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6" data-testid="employee-dashboard">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-4 sm:p-6 text-white">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <div className="bg-white/20 rounded-full p-2 sm:p-3">
            <User className="h-6 w-6 sm:h-8 sm:w-8" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold" data-testid="welcome-message">
              Welcome back, {currentEmployee.first_name}!
            </h1>
            <p className="text-blue-100">
              {currentEmployee.role} • Track your development goals and progress
            </p>
          </div>
        </div>
      </div>

      {/* Progress Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6" data-testid="stat-total-goals">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Goals</p>
              <p className="text-xl sm:text-3xl font-bold text-gray-900">{progressStats.totalGoals}</p>
            </div>
            <Target className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6" data-testid="stat-completed-goals">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed Goals</p>
              <p className="text-xl sm:text-3xl font-bold text-green-600">{progressStats.completedGoals}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6" data-testid="stat-active-goals">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Goals</p>
              <p className="text-xl sm:text-3xl font-bold text-orange-600">{progressStats.activeGoals}</p>
            </div>
            <Clock className="h-8 w-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6" data-testid="stat-success-rate">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Success Rate</p>
              <p className="text-xl sm:text-3xl font-bold text-purple-600">{progressStats.successRate}%</p>
            </div>
            <BarChart3 className="h-8 w-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* My Goals Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">My Development Goals</h2>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Track your progress and see how you're developing</p>
        </div>
        
        <div className="p-4 sm:p-6">
          {myGoals.length === 0 ? (
            <div className="text-center py-8">
              <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No goals assigned yet. Check back soon!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {myGoals.map((goal) => {
                // Calculate progress for this specific goal
                const goalProgress = stepProgress.filter(p => 
                  p.developmentGoalId === goal.id && p.status === 'submitted'
                );
                const goalSteps = goal.steps || [];
                const completedSteps = goalProgress.filter(p => p.outcome === 'correct').length;
                const progressPercentage = goalSteps.length > 0 ? Math.round((completedSteps / goalSteps.length) * 100) : 0;

                return (
                  <div key={goal.id} className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors" data-testid={`goal-${goal.id}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-semibold text-gray-900">{goal.title}</h3>
                          {goal.masteryAchieved && (
                            <Star className="h-5 w-5 text-yellow-500 fill-current" />
                          )}
                        </div>
                        <p className="text-gray-600 text-sm mb-3">{goal.description}</p>
                        
                        {/* Progress Bar */}
                        <div className="mb-2">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-gray-600">Progress</span>
                            <span className="font-medium">{progressPercentage}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all duration-300 ${
                                goal.masteryAchieved ? 'bg-green-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${progressPercentage}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span>Target: {new Date(goal.targetEndDate).toLocaleDateString()}</span>
                          <span>{goalSteps.length} steps</span>
                          {goal.consecutiveAllCorrect > 0 && (
                            <span className="text-green-600 font-medium">
                              {goal.consecutiveAllCorrect} consecutive correct
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="ml-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          goal.masteryAchieved 
                            ? 'bg-green-100 text-green-800' 
                            : goal.status === 'active'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {goal.masteryAchieved ? 'Mastered' : goal.status}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Recent Activity</h2>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Your latest assessment results</p>
        </div>
        
        <div className="p-4 sm:p-6">
          {progressStats.totalAssessments === 0 ? (
            <div className="text-center py-8">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No assessments completed yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stepProgress
                .filter(p => p.employeeId === currentEmployee.id && p.status === 'submitted')
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 5)
                .map((progress) => {
                  const goal = myGoals.find(g => g.id === progress.developmentGoalId);
                  return (
                    <div key={progress.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                      <div>
                        <p className="font-medium text-gray-900">{goal?.title || 'Unknown Goal'}</p>
                        <p className="text-sm text-gray-600">{new Date(progress.date).toLocaleDateString()}</p>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        progress.outcome === 'correct' 
                          ? 'bg-green-100 text-green-800'
                          : progress.outcome === 'verbal_prompt'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {progress.outcome.replace('_', ' ')}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}