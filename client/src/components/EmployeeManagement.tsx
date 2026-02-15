import React, { useState } from 'react';
import { User, Plus, Search, Edit, Eye, AlertTriangle, Phone, Heart, Brain, Shield, UserMinus, Award, Star, FileCheck } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import EmployeeForm from './EmployeeForm';
import EmployeeDetail from './EmployeeDetail';
import EmployeeAvatar from './EmployeeAvatar';

export default function EmployeeManagement() {
  const { employees, developmentGoals, updateEmployee, certifications } = useData();
  const { user } = useAuth();
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const filteredEmployees = employees
    .filter(employee => {
      if (employee.role === 'Guardian') return false;
      const matchesSearch = `${employee.first_name} ${employee.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'active' && employee.isActive) ||
        (statusFilter === 'inactive' && !employee.isActive);
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      // Sort by first name first, then by last name
      const firstNameCompare = (a.first_name || '').localeCompare(b.first_name || '');
      if (firstNameCompare !== 0) return firstNameCompare;
      return (a.last_name || '').localeCompare(b.last_name || '');
    });

  const getEmployeeGoals = (employeeId: string) => {
    return developmentGoals.filter(goal => goal.employeeId === employeeId);
  };

  const getEmployeeStats = (employeeId: string) => {
    const goals = getEmployeeGoals(employeeId);
    return {
      activeGoals: goals.filter(g => g.status === 'active').length,
      masteredGoals: goals.filter(g => g.masteryAchieved).length,
      totalGoals: goals.length
    };
  };

  const handleAddEmployee = () => {
    setEditingEmployee(null);
    setShowForm(true);
  };

  const handleEditEmployee = (employeeId: string) => {
    setEditingEmployee(employeeId);
    setSelectedEmployee(null); // Clear the detail view
    setShowForm(true);
  };

  const handleViewEmployee = (employeeId: string) => {
    setSelectedEmployee(employeeId);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingEmployee(null);
  };

  const handleCloseDetail = () => {
    setSelectedEmployee(null);
  };

  const handleInactivateEmployee = (employeeId: string) => {
    updateEmployee(employeeId, { isActive: false });
  };

  if (selectedEmployee) {
    return (
      <EmployeeDetail 
        employeeId={selectedEmployee} 
        onClose={handleCloseDetail}
        onEdit={handleEditEmployee}
      />
    );
  }

  if (showForm) {
    return (
      <EmployeeForm 
        employeeId={editingEmployee}
        onClose={handleCloseForm}
      />
    );
  }

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto">
      {/* Search, Filters, and Actions */}
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
              data-testid="input-search-employees"
            />
          </div>
        </div>
        
        <div className="flex space-x-2">
          {(['all', 'active', 'inactive'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-3 rounded-xl font-medium transition-colors text-sm ${
                statusFilter === status
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              data-testid={`filter-${status}`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {user?.role === 'Administrator' && (
          <button
            onClick={handleAddEmployee}
            className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-3 rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium whitespace-nowrap"
            data-testid="button-add-employee"
          >
            <Plus className="h-5 w-5" />
            <span>Add Employee</span>
          </button>
        )}
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-4 px-3 sm:px-6 font-medium text-gray-900">Employee</th>
                <th className="text-left py-4 px-3 sm:px-6 font-medium text-gray-900">Role</th>
                <th className="text-left py-4 px-6 font-medium text-gray-900 hidden md:table-cell">Last Login</th>
                <th className="text-left py-4 px-6 font-medium text-gray-900 hidden md:table-cell">Created</th>
                {user?.role === 'Administrator' && (
                  <th className="text-right py-4 px-3 sm:px-6 font-medium text-gray-900">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredEmployees.map((employee) => {
                const hasSystemAccess = ["Administrator", "Shift Lead", "Assistant Manager"].includes(employee.role);
                const canDocumentOnOthers = hasSystemAccess;
                
                return (
                  <tr 
                    key={employee.id} 
                    className="hover:bg-gray-50 cursor-pointer transition-colors" 
                    onClick={() => handleViewEmployee(employee.id)}
                    data-testid={`row-employee-${employee.id}`}
                  >
                    <td className="py-4 px-3 sm:px-6">
                      <div className="flex items-center space-x-3">
                        <EmployeeAvatar 
                          name={`${employee.first_name} ${employee.last_name}`}
                          imageUrl={employee.profileImageUrl}
                          size="md"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-gray-900" data-testid={`text-employee-name-${employee.id}`}>{`${employee.first_name} ${employee.last_name}`}</p>
                            {certifications.some(c => c.employeeId === employee.id && c.certificationType === 'mentor' && c.passed) && (
                              <span title="Mentor Certified" className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100">
                                <Star className="h-3 w-3 text-amber-600" />
                              </span>
                            )}
                            {certifications.some(c => c.employeeId === employee.id && c.certificationType === 'shift_lead' && c.passed) && (
                              <span title="Shift Lead Certified" className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100">
                                <Award className="h-3 w-3 text-blue-600" />
                              </span>
                            )}
                            {employee.roi_status && (
                              <span title="ROI Signed" className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100">
                                <FileCheck className="h-3 w-3 text-green-600" />
                              </span>
                            )}
                          </div>
                          {!employee.isActive && (
                            <p className="text-xs text-gray-500">Inactive</p>
                          )}
                          <p className="text-xs text-gray-500 hidden sm:block">{employee.email}</p>
                        </div>
                      </div>
                    </td>
                    
                    <td className="py-4 px-3 sm:px-6">
                      <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                        employee.role === 'Administrator' 
                          ? 'bg-purple-100 text-purple-800' 
                          : employee.role === 'Shift Lead' || employee.role === 'Assistant Manager'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {employee.role}
                      </span>
                    </td>
                    
                    <td className="py-4 px-6 hidden md:table-cell">
                      <span className="text-sm text-gray-600">
                        {employee.last_login 
                          ? new Date(employee.last_login).toLocaleDateString() 
                          : 'Never'}
                      </span>
                    </td>
                    
                    <td className="py-4 px-6 text-sm text-gray-600 hidden md:table-cell">
                      {new Date(employee.createdAt).toLocaleDateString()}
                    </td>
                    
{user?.role === 'Administrator' && (
                      <td className="py-4 px-3 sm:px-6 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleEditEmployee(employee.id)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                            title="Edit employee"
                            data-testid={`button-edit-${employee.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          {employee.isActive && (
                            <button
                              onClick={() => handleInactivateEmployee(employee.id)}
                              className="p-2 text-orange-600 hover:bg-orange-50 rounded-xl transition-colors"
                              title="Inactivate employee"
                              data-testid={`button-inactivate-${employee.id}`}
                            >
                              <UserMinus className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredEmployees.length === 0 && (
          <div className="text-center py-12">
            <User className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No employees found</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm 
                ? `No employees match "${searchTerm}"`
                : 'No employees match the current filters'
              }
            </p>
            {user?.role === 'Administrator' && !searchTerm && (
              <button
                onClick={handleAddEmployee}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
              >
                Add First Employee
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}