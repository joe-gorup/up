import React, { useState, useEffect } from 'react';
import { Calendar, Play, Square, Users, Clock, ChevronLeft, ChevronRight, CheckCircle, AlertCircle, Search, AlertTriangle, Phone, Heart, Brain, Target, User } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import EmployeeProgress from './EmployeeProgress';
import EmployeeDetail from './EmployeeDetail';
import EmployeeAvatar from './EmployeeAvatar';
import EmployeeForm from './EmployeeForm';

interface GoalDocumentationProps {
  onNavigateToEmployee?: () => void;
}

export default function GoalDocumentation({ onNavigateToEmployee }: GoalDocumentationProps = {}) {
  const { employees, activeAssessmentSession, createAssessmentSession, endAssessmentSession, updateAssessmentSessionEmployees, developmentGoals, checkEmployeeLocks } = useData();
  const { user } = useAuth();
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('9540 Nall Avenue');
  const [currentEmployeeIndex, setCurrentEmployeeIndex] = useState(0);
  const [showCreateSession, setShowCreateSession] = useState(!activeAssessmentSession);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingEmployeeProfile, setViewingEmployeeProfile] = useState<string | null>(null);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [lockConflictMessage, setLockConflictMessage] = useState<string | null>(null);

  // Update showCreateSession when activeAssessmentSession changes
  useEffect(() => {
    setShowCreateSession(!activeAssessmentSession);
  }, [activeAssessmentSession]);

  // Only Super Scoopers and Assistant Managers can be documented on
  const assessableEmployees = employees.filter(emp => 
    emp.isActive && 
    ['Super Scooper', 'Assistant Manager'].includes(emp.role)
  );
  const filteredEmployees = assessableEmployees
    .filter(employee =>
      `${employee.first_name} ${employee.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      // Sort by first name first, then by last name
      const firstNameCompare = (a.first_name || '').localeCompare(b.first_name || '');
      if (firstNameCompare !== 0) return firstNameCompare;
      return (a.last_name || '').localeCompare(b.last_name || '');
    });
  const sessionEmployees = activeAssessmentSession ? 
    employees.filter(emp => activeAssessmentSession.employeeIds.includes(emp.id)) : [];
  
  // Update selectedEmployees to match valid session employees when activeAssessmentSession changes
  useEffect(() => {
    if (activeAssessmentSession && !showCreateSession) {
      const validEmployeeIds = activeAssessmentSession.employeeIds.filter(id => 
        employees.some(emp => emp.id === id)
      );
      setSelectedEmployees(validEmployeeIds);
    }
  }, [activeAssessmentSession, employees, showCreateSession]);
  const currentEmployee = sessionEmployees[currentEmployeeIndex];

  const handleCreateSession = async () => {
    console.log('handleCreateSession called with:', selectedEmployees.length, 'employees');
    
    // Clear any previous lock conflict messages
    setLockConflictMessage(null);
    
    if (selectedEmployees.length === 0) {
      console.log('No employees selected, cannot create/update assessment session');
      alert('Please select at least one employee to start goal documentation');
      return;
    }

    // Check if we're updating an existing session or creating a new one
    // If the session is abandoned or completed, create a new one instead of updating
    if (activeAssessmentSession && activeAssessmentSession.status !== 'abandoned' && activeAssessmentSession.status !== 'completed') {
      console.log('Updating existing assessment session with employees:', selectedEmployees);
      
      // Find which employees were removed (they'll be automatically unlocked)
      const removedEmployees = activeAssessmentSession.employeeIds.filter(id => !selectedEmployees.includes(id));
      const addedEmployees = selectedEmployees.filter(id => !activeAssessmentSession.employeeIds.includes(id));
      
      // Check if any of the newly added employees are locked by others
      if (addedEmployees.length > 0) {
        const lockStatus = await checkEmployeeLocks(addedEmployees);
        
        if (lockStatus.locked.length > 0) {
          // Some new employees are locked - show message
          const lockDetails = lockStatus.locked.map(lock => {
            const emp = employees.find(e => e.id === lock.employeeId);
            const empName = emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown Employee';
            return `${empName} (locked by ${lock.managerName})`;
          }).join(', ');
          
          setLockConflictMessage(
            `Cannot add the following employees as they are currently being assessed: ${lockDetails}. Please remove them from your selection.`
          );
          return;
        }
      }
      
      // Update the session with new employee list
      const result = await updateAssessmentSessionEmployees(activeAssessmentSession.id, selectedEmployees);
      
      if (result.success) {
        setShowCreateSession(false);
        setCurrentEmployeeIndex(0);
        
        // Show info about changes
        if (removedEmployees.length > 0 || addedEmployees.length > 0) {
          const changes = [];
          if (removedEmployees.length > 0) {
            changes.push(`${removedEmployees.length} employee(s) removed`);
          }
          if (addedEmployees.length > 0) {
            changes.push(`${addedEmployees.length} employee(s) added`);
          }
          setLockConflictMessage(`Session updated: ${changes.join(', ')}`);
          setTimeout(() => setLockConflictMessage(null), 3000);
        }
      } else {
        alert(result.error || 'Failed to update assessment session');
      }
      return;
    }
    
    // Creating a new session
    console.log('Creating new assessment session with employees:', selectedEmployees);
    
    // Check for locks proactively before attempting to create session
    const lockStatus = await checkEmployeeLocks(selectedEmployees);
    
    if (lockStatus.locked.length > 0) {
      // Some employees are locked - filter them out and proceed with available ones
      const lockedEmployeeIds = lockStatus.locked.map(lock => lock.employeeId);
      const availableEmployees = selectedEmployees.filter(id => !lockedEmployeeIds.includes(id));
      
      // Build a detailed message showing which employees were excluded
      const lockDetails = lockStatus.locked.map(lock => {
        const emp = employees.find(e => e.id === lock.employeeId);
        const empName = emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown Employee';
        return `${empName} (locked by ${lock.managerName})`;
      }).join(', ');
      
      if (availableEmployees.length === 0) {
        // All employees are locked - cannot proceed
        setLockConflictMessage(
          `All selected employees are currently being assessed: ${lockDetails}. Please wait until their assessments are complete.`
        );
        return;
      }
      
      // Proceed with available employees and show info message
      setLockConflictMessage(
        `Note: The following employees were excluded because they're currently being assessed: ${lockDetails}. Proceeding with ${availableEmployees.length} available employee(s).`
      );
      
      // Update selected employees to only include available ones
      setSelectedEmployees(availableEmployees);
      
      // Create session with available employees
      const result = await createAssessmentSession(availableEmployees, selectedLocation);
      
      if (result.success) {
        setShowCreateSession(false);
        setCurrentEmployeeIndex(0);
        // Clear the message after successful creation
        setTimeout(() => setLockConflictMessage(null), 5000);
      } else {
        alert(result.error || 'Failed to create assessment session');
      }
      return;
    }
    
    // No locks - proceed normally with all selected employees
    const result = await createAssessmentSession(selectedEmployees, selectedLocation);
    
    if (result.success) {
      setShowCreateSession(false);
      setCurrentEmployeeIndex(0);
    } else {
      // Handle lock conflict (fallback in case of race condition)
      if (result.lockedEmployees && result.lockedEmployees.length > 0) {
        const lockedNames = result.lockedEmployees
          .map(id => {
            const emp = employees.find(e => e.id === id);
            return emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown';
          })
          .join(', ');
        
        // Get manager names if available
        let managerInfo = '';
        if (result.lockedByManagers && result.lockedByManagers.length > 0) {
          const managerNames = result.lockedByManagers
            .map(m => `${m.first_name} ${m.last_name}`)
            .join(', ');
          managerInfo = ` They are being assessed by: ${managerNames}.`;
        }
        
        setLockConflictMessage(
          `The following employees are currently being assessed: ${lockedNames}.${managerInfo} Please try again.`
        );
      } else {
        alert(result.error || 'Failed to create assessment session');
      }
    }
  };

  const handleEndSession = () => {
    endAssessmentSession();
    setShowCreateSession(true);
    setSelectedEmployees([]);
    setCurrentEmployeeIndex(0);
  };

  const handleChangeEmployees = () => {
    // Return to employee selection without ending the session
    // This allows users to modify their employee selection
    setShowCreateSession(true);
    if (activeAssessmentSession) {
      // Filter out any employee IDs that no longer exist (safeguard against deleted employees)
      const validEmployeeIds = activeAssessmentSession.employeeIds.filter(id => 
        employees.some(emp => emp.id === id)
      );
      setSelectedEmployees(validEmployeeIds);
    }
  };

  const toggleEmployeeSelection = (employeeId: string) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const goToNextEmployee = () => {
    if (currentEmployeeIndex < sessionEmployees.length - 1) {
      setCurrentEmployeeIndex(currentEmployeeIndex + 1);
    }
  };

  const goToPreviousEmployee = () => {
    if (currentEmployeeIndex > 0) {
      setCurrentEmployeeIndex(currentEmployeeIndex - 1);
    }
  };

  const getEmployeeGoals = (employeeId: string) => {
    return developmentGoals.filter(goal => 
      goal.employeeId === employeeId && goal.status === 'active'
    );
  };

  const handleViewProfile = () => {
    if (currentEmployee) {
      setViewingEmployeeProfile(currentEmployee.id);
    }
  };

  const handleCloseProfile = () => {
    setViewingEmployeeProfile(null);
  };

  const handleEditEmployee = (employeeId: string) => {
    setEditingEmployeeId(employeeId);
  };

  const handleCloseEdit = () => {
    setEditingEmployeeId(null);
  };

  // Show employee edit form if editing
  if (editingEmployeeId) {
    return (
      <EmployeeForm 
        employeeId={editingEmployeeId} 
        onClose={handleCloseEdit}
      />
    );
  }

  // Show employee profile if viewing
  if (viewingEmployeeProfile) {
    return (
      <EmployeeDetail 
        employeeId={viewingEmployeeProfile} 
        onClose={handleCloseProfile}
        onEdit={() => {}}
      />
    );
  }
  if (showCreateSession || !activeAssessmentSession) {
    return (
      <div className="p-3 sm:p-6 max-w-6xl mx-auto">
        {/* Location Selector */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6 mb-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <label htmlFor="location" className="text-sm font-medium text-gray-700 whitespace-nowrap">
                Documentation Location:
              </label>
              <select
                id="location"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full sm:w-auto px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white outline-none"
              >
                <option value="9540 Nall Avenue">9540 Nall Avenue</option>
                <option value="10460 W 103rd St.">10460 W 103rd St.</option>
              </select>
            </div>
            
            <button
              onClick={handleCreateSession}
              disabled={selectedEmployees.length === 0}
              className={`flex items-center space-x-2 px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200 w-full sm:w-auto justify-center sm:justify-start ${
                selectedEmployees.length > 0
                  ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md cursor-pointer'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed border border-gray-300'
              }`}
              data-testid="button-start-assessment"
            >
              <Target className={`h-5 w-5 ${
                selectedEmployees.length > 0 ? 'text-white' : 'text-gray-400'
              }`} />
              <span>
                {selectedEmployees.length > 0 
                  ? `${activeAssessmentSession ? 'Update Selection' : 'Begin Documentation'} (${selectedEmployees.length} selected)`
                  : `${activeAssessmentSession ? 'Update Selection' : 'Begin Documentation'} (select employees)`
                }
              </span>
            </button>
          </div>
          
          {/* Lock Conflict Warning */}
          {lockConflictMessage && (
            <div className={`mt-4 p-4 rounded-xl flex items-start space-x-3 ${
              lockConflictMessage.startsWith('Note:') 
                ? 'bg-blue-50 border border-blue-200' 
                : 'bg-yellow-50 border border-yellow-200'
            }`}>
              <AlertTriangle className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                lockConflictMessage.startsWith('Note:') 
                  ? 'text-blue-600' 
                  : 'text-yellow-600'
              }`} />
              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  lockConflictMessage.startsWith('Note:') 
                    ? 'text-blue-800' 
                    : 'text-yellow-800'
                }`}>
                  {lockConflictMessage.startsWith('Note:') ? 'Employees Excluded' : 'Cannot Start Assessment'}
                </p>
                <p className={`text-sm mt-1 ${
                  lockConflictMessage.startsWith('Note:') 
                    ? 'text-blue-700' 
                    : 'text-yellow-700'
                }`}>{lockConflictMessage}</p>
              </div>
            </div>
          )}
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={() => setSelectedEmployees([])}
              className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              Clear All
            </button>
            <button
              onClick={() => setSelectedEmployees(filteredEmployees.map(emp => emp.id))}
              className="px-4 py-3 bg-blue-100 text-blue-700 rounded-xl hover:bg-blue-200 transition-colors text-sm font-medium"
            >
              Select All
            </button>
          </div>
        </div>

        {/* Employee Selection - Cards on mobile, Table on desktop */}
        {/* Mobile Card View */}
        <div className="sm:hidden space-y-3">
          {filteredEmployees.map((employee) => {
            const isSelected = selectedEmployees.includes(employee.id);
            const employeeGoals = getEmployeeGoals(employee.id);
            
            return (
              <button
                key={employee.id}
                onClick={() => toggleEmployeeSelection(employee.id)}
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
          
          {filteredEmployees.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No employees found</h3>
              <p className="text-gray-600">
                {searchTerm 
                  ? `No employees match "${searchTerm}"`
                  : 'No active employees available'
                }
              </p>
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-center py-4 px-4 font-medium text-gray-900 w-12">
                  <input
                    type="checkbox"
                    checked={selectedEmployees.length === filteredEmployees.length && filteredEmployees.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedEmployees(filteredEmployees.map(emp => emp.id));
                      } else {
                        setSelectedEmployees([]);
                      }
                    }}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </th>
                <th className="text-left py-4 px-4 font-medium text-gray-900">Employee</th>
                <th className="text-left py-4 px-4 font-medium text-gray-900">Role</th>
                <th className="text-left py-4 px-4 font-medium text-gray-900 hidden lg:table-cell">Support Info</th>
                <th className="text-left py-4 px-4 font-medium text-gray-900">Active Goals</th>
                <th className="text-left py-4 px-4 font-medium text-gray-900 hidden lg:table-cell">Last Assessment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredEmployees.map((employee) => {
                const isSelected = selectedEmployees.includes(employee.id);
                const employeeGoals = getEmployeeGoals(employee.id);
                
                return (
                  <tr 
                    key={employee.id} 
                    className={`hover:bg-gray-50 cursor-pointer ${
                      isSelected ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => toggleEmployeeSelection(employee.id)}
                  >
                    <td className="py-4 px-4 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleEmployeeSelection(employee.id)}
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
                    
                    <td className="py-4 px-4 text-sm text-gray-600 hidden lg:table-cell">
                      Yesterday
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredEmployees.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No employees found</h3>
              <p className="text-gray-600">
                {searchTerm 
                  ? `No employees match "${searchTerm}"`
                  : 'No active employees available'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto">
      {/* Employee Navigation */}
      {currentEmployee && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-start sm:justify-between gap-3 sm:gap-0 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
            <button
              onClick={handleChangeEmployees}
              className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-4 py-3 rounded-xl hover:bg-gray-200 transition-colors w-full sm:w-auto justify-center sm:justify-start text-sm font-medium"
              data-testid="button-change-employees"
            >
              <User className="h-5 w-5" />
              <span>Change Employees</span>
            </button>
            
            <button
              onClick={handleEndSession}
              className="flex items-center space-x-2 bg-red-100 text-red-700 px-4 py-3 rounded-xl hover:bg-red-200 transition-colors w-full sm:w-auto justify-center sm:justify-start text-sm font-medium"
              data-testid="button-end-session"
            >
              <Square className="h-5 w-5" />
              <span>End Session</span>
            </button>
          </div>
          
          {sessionEmployees.length > 1 && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
              <span className="text-sm font-medium text-gray-600">
                {currentEmployeeIndex + 1} of {sessionEmployees.length} employee{sessionEmployees.length !== 1 ? 's' : ''}
              </span>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={goToPreviousEmployee}
                  disabled={currentEmployeeIndex === 0}
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border-2 border-blue-200"
                  title="Previous employee"
                >
                  <ChevronLeft className="h-5 w-5 text-blue-600" />
                </button>
                
                <button
                  onClick={goToNextEmployee}
                  disabled={currentEmployeeIndex === sessionEmployees.length - 1}
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border-2 border-blue-200"
                  title="Next employee"
                >
                  <ChevronRight className="h-5 w-5 text-blue-600" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {currentEmployee && (
        <div className={sessionEmployees.length > 1 ? "mt-6" : ""}>
          <EmployeeProgress 
            employee={currentEmployee}
            assessmentSessionId={activeAssessmentSession.id}
            onViewProfile={handleViewProfile}
            onEditEmployee={handleEditEmployee}
          />
        </div>
      )}
    </div>
  );
}