import React, { useState, useEffect } from 'react';
import { INPUT_BASE_CLASSES } from './ui/FormInput';
import { ArrowLeft, X, Upload, Key, Mail, CheckCircle, Lock, Award, Star, Trash2, ChevronDown, ChevronUp, Shield } from 'lucide-react';
import { useData, Employee, PromotionCertification } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import EmployeeAvatar from './EmployeeAvatar';

interface EmployeeFormProps {
  employeeId?: string | null;
  onClose: () => void;
}

export default function EmployeeForm({ employeeId, onClose }: EmployeeFormProps) {
  const { employees, addEmployee, updateEmployee, certifications, addCertification, deleteCertification } = useData();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPasswordFields, setShowPasswordFields] = useState(false);

  const employeeCerts = employeeId ? certifications.filter(c => c.employeeId === employeeId) : [];
  const hasMentorCert = employeeCerts.some(c => c.certificationType === 'mentor' && c.passed);
  const hasShiftManagerCert = employeeCerts.some(c => c.certificationType === 'shift_manager' && c.passed);

  const [showCertForm, setShowCertForm] = useState(false);
  const [certType, setCertType] = useState<'mentor' | 'shift_manager'>('mentor');
  const [certDate, setCertDate] = useState(new Date().toISOString().split('T')[0]);
  const [certNotes, setCertNotes] = useState('');
  const [savingCert, setSavingCert] = useState(false);
  const [checklistAnswers, setChecklistAnswers] = useState<Record<number, boolean>>({});

  const mentorChecklistItems = [
    "Does the employee consistently arrive on time for their scheduled shifts?",
    "Does the employee follow call-out and time off request procedures correctly?",
    "Can be relied on to independently communicate with guests?",
    "Does the employee use correct portions when making product?",
    "Does the employee arrive to work in clean hygiene and adheres to the dress code?",
    "Explain to me what cross-contamination is and how is it avoided?",
    "Does the employee use appropriate language and conversations at work?",
    "Does the employee ask for clarity when they are unsure of a task?",
    "Can the employee independently follow the instructions as written on a recipe?",
    "Does the employee have a positive attitude at work?",
    "Do they show patience when teaching others that learn slowly?",
    "Do they correct mistakes calmly and respectfully?",
    "Does the employee maintain composure when under pressure?",
    "Does the employee take responsibility for their actions?",
    "Do they support company standards even when no one is watching?",
    "Does the person adhere to the daily shift checklists?",
    "Does the employee maintain a steady pace during slow and busy times?",
    "Does the employee lead by example with product quality and guest experience?",
    "Can the employee redirect mistakes without embarrassment or putting someone down?",
    "Can the employee explain their expectations clearly to another individual?",
    "Does the employee accept feedback constructively?",
    "Do they demonstrate willingness to improve?",
    "What are the training resources and where to find them?",
    "Can the employee explain TGS mission?",
    "Can the employee name and explain the 10 core flavors?",
    "Can the employee make a milkshake?",
    "Can the employee make a hot drink?",
    "Can the employee brew coffee?",
    "Can the employee prepare a bag of coffee beans to go?",
    "Can they operate the POS/Register independently?",
    "How long should someone wash their hands for?",
    "Can they explain the training steps to scooping?"
  ];

  const shiftManagerCategories = [
    {
      name: "Menu and Brand Knowledge",
      items: [
        "When was TGS started?",
        "What is the TGS mission?",
        "What local food partnerships does TGS have?",
        "What are the different ways someone can order TGS?",
        "Demonstrate the difference between a kids portion and a regular portion.",
        "Demonstrate how to warm up a food item.",
        "What are some quality cues for baked goods and dairy products?",
        "Explain what FIFO stands for and how to apply it on your shift.",
        "What ice cream flavors are GF?",
        "What DF options are offered?",
        "What is the employee discount and how is it different than a free treat?",
        "What is the uniform policy?",
        "How do you date product?"
      ]
    },
    {
      name: "Processes and Systems",
      items: [
        "Where to find all relevant tools and information?",
        "What is the computer password?",
        "What are the 3 daily checklists?",
        "What items do we inventory daily?",
        "How do you do an AE Dairy order?",
        "When to do a customer refund? How do you refund same day?",
        "What are the daily opening & closing cash procedures?",
        "What is the safe code?",
        "What are the steps of action when a SL discovers something not working or broken?",
        "What do you do when a product is deemed not in quality?",
        "What are some examples of theft and what are preventative measures?",
        "What is the procedure for an extreme weather event?",
        "Explain what the Ops Update is and where it is located."
      ]
    },
    {
      name: "Able to Operate, Clean and Troubleshoot Equipment",
      items: [
        "Toast POS",
        "Drive through headsets",
        "Menu Screens",
        "Batch Freezer",
        "Ice cream filler",
        "Heat Sealer",
        "Oven",
        "Toaster Oven",
        "Espresso Machine",
        "Freezers",
        "Dish Washer",
        "Computer",
        "3-compartment sink",
        "Breaker box",
        "Drains/plumbing",
        "Internet/Router",
        "Building Power"
      ]
    },
    {
      name: "People",
      items: [
        "Demonstrate how to coach a Scooper in the example verbally provided.",
        "How do you help a Scooper who is having an emotional moment?",
        "What are the steps to take when a Scooper is not responding or ignoring feedback?",
        "How do you handle an upset customer appropriately? What is the LAST method?",
        "What are some zero tolerance behavior examples and what actions does a SL need to take?",
        "What are Scooper goals? Where do we find them?",
        "What are the 4 steps to train someone on something new?",
        "What do you do if employee falls ill during their shift?",
        "What is the procedure if there is an injury to an employee?",
        "What is the procedure if there is an injury to a customer?",
        "Do they demonstrate the ability to delegate tasks appropriately?",
        "Does the employee make sound decisions without waiting for direction in routine scenarios?",
        "Does the employee maintain a team focus?"
      ]
    }
  ];

  const getChecklistItems = () => certType === 'mentor' ? mentorChecklistItems : shiftManagerCategories.flatMap(c => c.items);
  const getPassingScore = () => certType === 'mentor' ? 84 : 90;
  const calculateScore = () => {
    const items = getChecklistItems();
    const yesCount = Object.values(checklistAnswers).filter(v => v).length;
    return Math.round((yesCount / items.length) * 100);
  };

  const handleSaveCertification = async () => {
    if (!employeeId) return;
    setSavingCert(true);
    const items = getChecklistItems();
    const score = calculateScore();
    const passingScore = getPassingScore();

    const checklistResults = items.map((item, i) => ({
      question: item,
      answer: checklistAnswers[i] || false
    }));

    await addCertification({
      employeeId,
      certificationType: certType,
      dateCompleted: certDate,
      score,
      passingScore,
      passed: score >= passingScore,
      checklistResults,
      certifiedBy: user?.id,
      notes: certNotes || undefined
    });

    setShowCertForm(false);
    setChecklistAnswers({});
    setCertNotes('');
    setSavingCert(false);
  };
  
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
      }
    } else {
      // For new employees, show password fields if they have system access
      setShowPasswordFields(true);
    }
  }, [employeeId, employees]);

  // NOTE: User accounts are now managed through the unified employees table
  // System access is granted via has_system_access flag on employee records

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

        {employeeId && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center space-x-2 mb-6">
              <Award className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-semibold text-gray-900">Promotion Certifications</h2>
            </div>

            {employeeCerts.length > 0 ? (
              <div className="space-y-3 mb-4">
                {employeeCerts.map((cert) => (
                  <div key={cert.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-xl bg-gray-50">
                    <div className="flex items-center space-x-3">
                      {cert.certificationType === 'mentor' ? (
                        <Star className="h-5 w-5 text-amber-500" />
                      ) : (
                        <Shield className="h-5 w-5 text-blue-500" />
                      )}
                      <div>
                        <p className="font-medium text-gray-900">
                          {cert.certificationType === 'mentor' ? 'Mentor Certification' : 'Shift Manager Certification'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(cert.dateCompleted).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`text-sm font-medium ${cert.passed ? 'text-green-600' : 'text-red-600'}`}>
                        {cert.score}%
                        {cert.passed ? (
                          <CheckCircle className="inline h-4 w-4 ml-1" />
                        ) : (
                          <X className="inline h-4 w-4 ml-1" />
                        )}
                      </span>
                      {user?.role === 'Administrator' && (
                        <button
                          type="button"
                          onClick={() => deleteCertification(cert.id)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-4">No certifications recorded yet.</p>
            )}

            <button
              type="button"
              onClick={() => {
                setShowCertForm(!showCertForm);
                if (!showCertForm) {
                  setChecklistAnswers({});
                  setCertNotes('');
                  setCertDate(new Date().toISOString().split('T')[0]);
                  setCertType('mentor');
                }
              }}
              className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-medium"
            >
              {showCertForm ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <span>{showCertForm ? 'Hide Form' : 'Record New Certification'}</span>
            </button>

            {showCertForm && (
              <div className="mt-4 space-y-4 border-t border-gray-200 pt-4">
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => { setCertType('mentor'); setChecklistAnswers({}); }}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${certType === 'mentor' ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'}`}
                  >
                    Mentor
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCertType('shift_manager'); setChecklistAnswers({}); }}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${certType === 'shift_manager' ? 'bg-blue-100 text-blue-800 border border-blue-300' : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'}`}
                  >
                    Shift Manager
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date Completed</label>
                  <input
                    type="date"
                    value={certDate}
                    onChange={(e) => setCertDate(e.target.value)}
                    className={`w-full sm:w-auto ${INPUT_BASE_CLASSES}`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Checklist</label>
                  <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-xl">
                    {certType === 'mentor' ? (
                      mentorChecklistItems.map((item, idx) => (
                        <label
                          key={idx}
                          className={`flex items-start space-x-3 px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                        >
                          <input
                            type="checkbox"
                            checked={checklistAnswers[idx] || false}
                            onChange={(e) => setChecklistAnswers(prev => ({ ...prev, [idx]: e.target.checked }))}
                            className="h-4 w-4 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-800">{item}</span>
                        </label>
                      ))
                    ) : (
                      (() => {
                        let globalIdx = 0;
                        return shiftManagerCategories.map((category, catIdx) => (
                          <div key={catIdx}>
                            <div className="px-4 py-2 bg-gray-200 font-medium text-sm text-gray-700 sticky top-0">
                              {category.name}
                            </div>
                            {category.items.map((item, itemIdx) => {
                              const currentIdx = globalIdx++;
                              return (
                                <label
                                  key={currentIdx}
                                  className={`flex items-start space-x-3 px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors ${currentIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checklistAnswers[currentIdx] || false}
                                    onChange={(e) => setChecklistAnswers(prev => ({ ...prev, [currentIdx]: e.target.checked }))}
                                    className="h-4 w-4 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-gray-800">{item}</span>
                                </label>
                              );
                            })}
                          </div>
                        ));
                      })()
                    )}
                  </div>
                </div>

                <div className={`text-sm font-medium ${calculateScore() >= getPassingScore() ? 'text-green-600' : 'text-red-600'}`}>
                  Score: {calculateScore()}% (Passing: {getPassingScore()}%)
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={certNotes}
                    onChange={(e) => setCertNotes(e.target.value)}
                    className={`w-full ${INPUT_BASE_CLASSES}`}
                    rows={3}
                    placeholder="Optional notes about this certification..."
                  />
                </div>

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={handleSaveCertification}
                    disabled={savingCert}
                    className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingCert ? 'Saving...' : 'Save Certification'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCertForm(false); setChecklistAnswers({}); setCertNotes(''); }}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
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