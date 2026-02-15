import React, { useState, useEffect } from 'react';
import { INPUT_BASE_CLASSES } from './ui/FormInput';
import { ArrowLeft, X, Upload, Key, Mail, CheckCircle, Lock, Link, Copy, Check, AlertTriangle } from 'lucide-react';
import { useData, Employee } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../lib/auth';
import EmployeeAvatar from './EmployeeAvatar';

interface EmployeeFormProps {
  employeeId?: string | null;
  onClose: () => void;
}

export default function EmployeeForm({ employeeId, onClose }: EmployeeFormProps) {
  const { employees, addEmployee, updateEmployee } = useData();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPasswordFields, setShowPasswordFields] = useState(false);

  // Invitation states for Job Coach and Guardian roles
  const [invitationEmail, setInvitationEmail] = useState('');
  const [invitationLink, setInvitationLink] = useState('');
  const [invitationLoading, setInvitationLoading] = useState(false);
  const [invitationCopied, setInvitationCopied] = useState(false);
  const [invitationError, setInvitationError] = useState('');
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    role: 'Super Scooper',
    profileImageUrl: '',
    isActive: true,
    hasSystemAccess: false,
    password: '',
    confirmPassword: ''
  });

  const getSystemAccessByRole = (role: string) => {
    return ["Administrator", "Shift Manager", "Assistant Manager", "Job Coach", "Guardian"].includes(role);
  };

  // Update hasSystemAccess when role changes
  useEffect(() => {
    const hasAccess = getSystemAccessByRole(formData.role);
    setFormData(prev => ({ ...prev, hasSystemAccess: hasAccess }));
  }, [formData.role]);

  useEffect(() => {
    if (employeeId) {
      const employee = employees.find(emp => emp.id === employeeId);
      if (employee) {
        setFormData({
          firstName: employee.first_name || '',
          lastName: employee.last_name || '',
          username: employee.email || '',
          role: employee.role,
          profileImageUrl: employee.profileImageUrl || '',
          isActive: employee.isActive,
          hasSystemAccess: getSystemAccessByRole(employee.role),
          password: '',
          confirmPassword: ''
        });
        // For existing employees, hide password fields by default
        setShowPasswordFields(false);
        // Set invitation email to employee's email
        setInvitationEmail(employee.email || '');
      }
    } else {
      // For new employees, show password fields if they have system access
      setShowPasswordFields(true);
    }
  }, [employeeId, employees]);

  // NOTE: User accounts are now managed through the unified employees table
  // System access is granted via has_system_access flag on employee records

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate password fields if system access is required
      if (formData.hasSystemAccess) {
        // For new employees, password is always required
        if (!employeeId && !formData.password) {
          alert('Password is required for roles with system access');
          setLoading(false);
          return;
        }
        // For existing employees with reset password checked, password is required
        if (employeeId && showPasswordFields && !formData.password) {
          alert('Please enter a new password or uncheck the Reset Password option');
          setLoading(false);
          return;
        }
        // Validate password format if provided
        if (formData.password) {
          if (formData.password !== formData.confirmPassword) {
            alert('Password and confirmation must match');
            setLoading(false);
            return;
          }
          if (formData.password.length < 8) {
            alert('Password must be at least 8 characters');
            setLoading(false);
            return;
          }
        }
      }

      const cleanData = {
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        // For Super Scoopers without system access, set email to empty string since they don't need login credentials
        email: formData.hasSystemAccess ? formData.username : '',
        role: formData.role,
        profileImageUrl: formData.profileImageUrl,
        isActive: formData.isActive,
        hasSystemAccess: formData.hasSystemAccess,
        ...(formData.hasSystemAccess && formData.password && { password: formData.password })
      };

      if (employeeId) {
        await updateEmployee(employeeId, cleanData);
      } else {
        await addEmployee(cleanData);
      }

      // Automatically create user account for management roles with passwords
      if (formData.hasSystemAccess && formData.password) {
        // NOTE: System access is now managed via has_system_access flag on employee record
      }
      
      onClose();
    } catch (error) {
      console.error('Error saving employee:', error);
      if (error instanceof Error && error.message.includes('already exists')) {
        alert('An employee with this username already exists. Please use a different username.');
      } else {
        alert('An error occurred while saving the employee. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="p-3 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4 sm:mb-8">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900">
              {employeeId ? 'Edit Employee' : 'Add New Employee'}
            </h1>
            <p className="text-sm sm:text-base text-gray-600 hidden sm:block">
              {employeeId ? 'Update employee information and support details' : 'Create a comprehensive employee profile'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-8">
        {/* Basic Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Basic Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                First Name *
              </label>
              <input
                type="text"
                id="firstName"
                required
                value={formData.firstName}
                onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                className={`w-full ${INPUT_BASE_CLASSES}`}
                placeholder="J"
                data-testid="input-first-name"
              />
            </div>

            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                Last Name *
              </label>
              <input
                type="text"
                id="lastName"
                required
                value={formData.lastName}
                onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                className={`w-full ${INPUT_BASE_CLASSES}`}
                placeholder="Group"
                data-testid="input-last-name"
              />
            </div>


            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                Role *
              </label>
              <select
                id="role"
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                className={`w-full ${INPUT_BASE_CLASSES}`}
                data-testid="select-role"
              >
                <option value="Super Scooper">Super Scooper</option>
                <option value="Job Coach">Job Coach</option>
                <option value="Guardian">Guardian</option>
                <option value="Shift Manager">Shift Manager</option>
                <option value="Assistant Manager">Assistant Manager</option>
                <option value="Administrator">Administrator</option>
              </select>
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                data-testid="checkbox-active"
              />
              <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                Active Employee
              </label>
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Profile Picture
              </label>
              <div className="flex items-center space-x-4">
                <EmployeeAvatar 
                  name={`${formData.firstName} ${formData.lastName}`.trim() || 'Employee'} 
                  imageUrl={formData.profileImageUrl}
                  size="lg"
                  data-testid="preview-employee-avatar"
                />
                <div className="flex items-center space-x-2">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="photo-upload"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        // For now, create a placeholder URL
                        const placeholderUrl = `https://via.placeholder.com/150x150.png?text=${encodeURIComponent(formData.firstName + ' ' + formData.lastName)}`;
                        setFormData(prev => ({ ...prev, profileImageUrl: placeholderUrl }));
                      }
                    }}
                  />
                  <label
                    htmlFor="photo-upload"
                    className="inline-flex items-center px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl cursor-pointer transition-colors font-medium"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Photo
                  </label>
                  {formData.profileImageUrl && (
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, profileImageUrl: '' }))}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                      title="Remove Photo"
                      data-testid="button-remove-image"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

        {/* System Access Settings */}
        {formData.hasSystemAccess && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
            <div className="flex items-center space-x-2 mb-6">
              <Key className="h-5 w-5 text-green-500" />
              <h2 className="text-xl font-semibold text-gray-900">System Access Settings</h2>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Mail className="h-5 w-5 text-blue-600" />
                  <h3 className="font-medium text-blue-900">Documentation Access Required</h3>
                </div>
                {/* Password Status Indicator */}
                {employeeId && (
                  <div className="flex items-center space-x-2 px-3 py-1 bg-green-100 border border-green-200 rounded-full">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700">Password Set</span>
                  </div>
                )}
              </div>
              <p className="text-blue-800 text-sm">
                This role requires system access to document on other employees. 
                {!employeeId ? ' Please set a password for login.' : ' Login credentials are configured.'}
              </p>
            </div>

            {/* Reset Password Toggle for Existing Employees */}
            {employeeId && (
              <div className="mb-6">
                <label className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPasswordFields}
                    onChange={(e) => {
                      setShowPasswordFields(e.target.checked);
                      if (!e.target.checked) {
                        // Clear password fields when unchecked
                        setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
                      }
                    }}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    data-testid="checkbox-reset-password"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Reset Password</span>
                    <p className="text-xs text-gray-600">Check this box to change the employee's current password</p>
                  </div>
                </label>
              </div>
            )}

            {/* Only show username and password fields for roles with system access */}
            {formData.hasSystemAccess && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="flex items-center space-x-2">
                      <span>Username *</span>
                      {employeeId && (
                        <Lock className="h-3 w-3 text-green-500" />
                      )}
                    </span>
                  </label>
                  <input
                    type="text"
                    id="username"
                    required={formData.hasSystemAccess}
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    className={`w-full ${INPUT_BASE_CLASSES} ${employeeId ? 'border-green-200 bg-green-50' : ''}`}
                    placeholder="jgroup-admin"
                    data-testid="input-username"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {employeeId ? 'Connected to existing login credentials' : 'Used for login access'}
                  </p>
                </div>
              
                {/* Password fields - show for new employees or when reset password is checked */}
                {(!employeeId || showPasswordFields) && (
                <>
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                      {employeeId ? 'New Password *' : 'Password *'}
                    </label>
                    <input
                      type="password"
                      id="password"
                      required={!employeeId && formData.hasSystemAccess}
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      className={`w-full ${INPUT_BASE_CLASSES}`}
                      placeholder="Enter secure password"
                      data-testid="input-password"
                    />
                    <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                      {employeeId ? 'Confirm New Password *' : 'Confirm Password *'}
                    </label>
                    <input
                      type="password"
                      id="confirmPassword"
                      required={!employeeId && formData.hasSystemAccess}
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      className={`w-full ${INPUT_BASE_CLASSES}`}
                      placeholder="Re-enter password"
                      data-testid="input-confirm-password"
                    />
                    <p className="text-xs text-gray-500 mt-1">Must match password above</p>
                  </div>
                </>
              )}
            </div>
            )}
          </div>
        )}

        {/* Account Access / Invitation - for Job Coach and Guardian roles */}
        {employeeId && ['Job Coach', 'Guardian'].includes(formData.role) && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Mail className="h-5 w-5 text-indigo-500" />
              <h2 className="text-lg font-semibold text-gray-900">Account Access</h2>
            </div>

            {formData.hasSystemAccess && formData.username ? (
              <div className="flex items-center space-x-2 text-sm text-green-700 bg-green-50 p-3 rounded-lg mb-3">
                <CheckCircle className="h-4 w-4" />
                <span>Account is set up - {formData.username}</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg mb-3">
                <AlertTriangle className="h-4 w-4" />
                <span>No account set up yet</span>
              </div>
            )}

            <p className="text-sm text-gray-600 mb-3">
              Generate an invitation link for this {formData.role.toLowerCase()} to create their login credentials.
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
                type="button"
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
                      type="button"
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
                  <p className="text-xs text-gray-400">Share this link with the {formData.role.toLowerCase()} to let them set up their account.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : (employeeId ? 'Update Employee' : 'Create Employee')}
          </button>
        </div>
      </form>
    </div>
  );
}