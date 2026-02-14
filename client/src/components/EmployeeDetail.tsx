import { useState, useEffect } from 'react';
import { ArrowLeft, Edit, Plus, Target, CheckCircle, Clock, AlertTriangle, Phone, Heart, Brain, Shield, Zap, Archive, X, Save, ChevronDown, ChevronRight, ChevronUp, Star, Lightbulb, Users, UserCheck, Link, Copy, Check, Mail, Pencil, Award, Trash2 } from 'lucide-react';
import { useData, PromotionCertification } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../lib/auth';
import GoalAssignment from './GoalAssignment';
import EmployeeAvatar from './EmployeeAvatar';
import { PhoneInput, INPUT_BASE_CLASSES } from './ui/FormInput';

interface EmployeeDetailProps {
  employeeId: string;
  onClose: () => void;
  onEdit: (employeeId: string) => void;
}

export default function EmployeeDetail({ employeeId, onClose, onEdit }: EmployeeDetailProps) {
  const { employees, developmentGoals, stepProgress, goalTemplates, updateGoal, archiveGoal, updateEmployee, certifications, addCertification, deleteCertification } = useData();
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

  // Inline editing states
  const [editingSafety, setEditingSafety] = useState(false);
  const [editingEmergency, setEditingEmergency] = useState(false);
  const [editingSupport, setEditingSupport] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  
  // Form data for inline editing
  const [safetyForm, setSafetyForm] = useState<string[]>(['']);
  const [emergencyForm, setEmergencyForm] = useState<Array<{ name: string; relationship: string; phone: string }>>([{ name: '', relationship: '', phone: '' }]);
  const [supportForm, setSupportForm] = useState({
    interestsMotivators: [''],
    challenges: [''],
    regulationStrategies: ['']
  });

  // Certification states
  const [showCertForm, setShowCertForm] = useState(false);
  const [certType, setCertType] = useState<'mentor' | 'shift_manager'>('mentor');
  const [certDate, setCertDate] = useState(new Date().toISOString().split('T')[0]);
  const [certNotes, setCertNotes] = useState('');
  const [savingCert, setSavingCert] = useState(false);
  const [checklistAnswers, setChecklistAnswers] = useState<Record<number, boolean>>({});

  // Certification checklist items
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

  const employeeCerts = certifications.filter(c => c.employeeId === employeeId);

  const handleSaveCertification = async () => {
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

  useEffect(() => {
    async function fetchRelationships() {
      const isManager = ['Administrator', 'Shift Manager', 'Assistant Manager'].includes(user?.role || '');
      if (!isManager) return;
      try {
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

  // Initialize form data when employee changes
  useEffect(() => {
    if (employee) {
      setSafetyForm(employee.allergies.length > 0 ? [...employee.allergies] : ['']);
      setEmergencyForm(employee.emergencyContacts.length > 0 ? [...employee.emergencyContacts] : [{ name: '', relationship: '', phone: '' }]);
      setSupportForm({
        interestsMotivators: employee.interestsMotivators.length > 0 ? [...employee.interestsMotivators] : [''],
        challenges: employee.challenges.length > 0 ? [...employee.challenges] : [''],
        regulationStrategies: employee.regulationStrategies.length > 0 ? [...employee.regulationStrategies] : ['']
      });
    }
  }, [employee?.id]);

  const canEdit = user?.role === 'Administrator';

  // Helper functions for array form fields
  const addArrayItem = (setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter(prev => [...prev, '']);
  };

  const removeArrayItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, index: number) => {
    setter(prev => prev.filter((_, i) => i !== index));
  };

  const updateArrayItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, index: number, value: string) => {
    setter(prev => prev.map((item, i) => i === index ? value : item));
  };

  const addEmergencyContact = () => {
    setEmergencyForm(prev => [...prev, { name: '', relationship: '', phone: '' }]);
  };

  const removeEmergencyContact = (index: number) => {
    setEmergencyForm(prev => prev.filter((_, i) => i !== index));
  };

  const updateEmergencyContact = (index: number, field: string, value: string) => {
    setEmergencyForm(prev => prev.map((contact, i) =>
      i === index ? { ...contact, [field]: value } : contact
    ));
  };

  const updateSupportArrayItem = (field: keyof typeof supportForm, index: number, value: string) => {
    setSupportForm(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? value : item)
    }));
  };

  const addSupportArrayItem = (field: keyof typeof supportForm) => {
    setSupportForm(prev => ({
      ...prev,
      [field]: [...prev[field], '']
    }));
  };

  const removeSupportArrayItem = (field: keyof typeof supportForm, index: number) => {
    setSupportForm(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  // Save handlers
  const handleSaveSafety = async () => {
    setSavingProfile(true);
    try {
      await updateEmployee(employeeId, {
        allergies: safetyForm.filter(a => a.trim() !== '')
      });
      setEditingSafety(false);
    } catch (error) {
      console.error('Error saving safety info:', error);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveEmergency = async () => {
    setSavingProfile(true);
    try {
      await updateEmployee(employeeId, {
        emergencyContacts: emergencyForm.filter(c => c.name.trim() !== '' || c.relationship.trim() !== '' || c.phone.trim() !== '')
      });
      setEditingEmergency(false);
    } catch (error) {
      console.error('Error saving emergency contacts:', error);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveSupport = async () => {
    setSavingProfile(true);
    try {
      await updateEmployee(employeeId, {
        interestsMotivators: supportForm.interestsMotivators.filter(i => i.trim() !== ''),
        challenges: supportForm.challenges.filter(c => c.trim() !== ''),
        regulationStrategies: supportForm.regulationStrategies.filter(r => r.trim() !== '')
      });
      setEditingSupport(false);
    } catch (error) {
      console.error('Error saving support info:', error);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCancelSafety = () => {
    setSafetyForm(employee?.allergies.length ? [...employee.allergies] : ['']);
    setEditingSafety(false);
  };

  const handleCancelEmergency = () => {
    setEmergencyForm(employee?.emergencyContacts.length ? [...employee.emergencyContacts] : [{ name: '', relationship: '', phone: '' }]);
    setEditingEmergency(false);
  };

  const handleCancelSupport = () => {
    if (employee) {
      setSupportForm({
        interestsMotivators: employee.interestsMotivators.length > 0 ? [...employee.interestsMotivators] : [''],
        challenges: employee.challenges.length > 0 ? [...employee.challenges] : [''],
        regulationStrategies: employee.regulationStrategies.length > 0 ? [...employee.regulationStrategies] : ['']
      });
    }
    setEditingSupport(false);
  };
  
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
          {user?.role === 'Administrator' && (
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
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - About Me Information */}
        <div className="lg:col-span-1 space-y-6">
          {/* Safety Information - Allergies */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <h2 className="text-lg font-semibold text-gray-900">Allergies & Dietary Restrictions</h2>
              </div>
              {canEdit && !editingSafety && (
                <button
                  onClick={() => setEditingSafety(true)}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Edit allergies"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </div>

            {editingSafety ? (
              <div className="space-y-3">
                {safetyForm.map((allergy, index) => (
                  <div key={index} className="flex space-x-2">
                    <input
                      type="text"
                      value={allergy}
                      onChange={(e) => updateArrayItem(setSafetyForm, index, e.target.value)}
                      className={`flex-1 ${INPUT_BASE_CLASSES}`}
                      placeholder="Enter allergy or dietary restriction"
                    />
                    {safetyForm.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeArrayItem(setSafetyForm, index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => addArrayItem(setSafetyForm)}
                    className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Allergy</span>
                  </button>
                  <div className="flex space-x-2">
                    <button
                      onClick={handleCancelSafety}
                      className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveSafety}
                      disabled={savingProfile}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50"
                    >
                      <Save className="h-3 w-3" />
                      <span>{savingProfile ? 'Saving...' : 'Save'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                {employee.allergies.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {employee.allergies.map((allergy, index) => (
                      <span
                        key={index}
                        className="inline-block bg-red-100 text-red-800 px-3 py-1.5 rounded-full text-sm"
                      >
                        {allergy}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm italic">No allergies recorded</p>
                )}
              </div>
            )}
          </div>

          {/* Emergency Contacts */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Phone className="h-5 w-5 text-blue-500" />
                <h2 className="text-lg font-semibold text-gray-900">Emergency Contacts</h2>
              </div>
              {canEdit && !editingEmergency && (
                <button
                  onClick={() => setEditingEmergency(true)}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Edit emergency contacts"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </div>

            {editingEmergency ? (
              <div className="space-y-4">
                {emergencyForm.map((contact, index) => (
                  <div key={index} className="p-4 border border-gray-200 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-gray-900">Contact {index + 1}</h3>
                      {emergencyForm.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEmergencyContact(index)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <input
                        type="text"
                        value={contact.name}
                        onChange={(e) => updateEmergencyContact(index, 'name', e.target.value)}
                        className={INPUT_BASE_CLASSES}
                        placeholder="Contact name"
                      />
                      <input
                        type="text"
                        value={contact.relationship}
                        onChange={(e) => updateEmergencyContact(index, 'relationship', e.target.value)}
                        className={INPUT_BASE_CLASSES}
                        placeholder="Relationship (e.g., Mother)"
                      />
                      <PhoneInput
                        value={contact.phone}
                        onChange={(e) => updateEmergencyContact(index, 'phone', e.target.value)}
                        placeholder="Phone number"
                        mask="(999) 999-9999"
                      />
                    </div>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={addEmergencyContact}
                    className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Emergency Contact</span>
                  </button>
                  <div className="flex space-x-2">
                    <button
                      onClick={handleCancelEmergency}
                      className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEmergency}
                      disabled={savingProfile}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50"
                    >
                      <Save className="h-3 w-3" />
                      <span>{savingProfile ? 'Saving...' : 'Save'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                {employee.emergencyContacts.length > 0 ? (
                  <div className="space-y-3">
                    {employee.emergencyContacts.map((contact, index) => (
                      <div key={index} className="text-sm bg-gray-50 p-3 rounded-lg">
                        <p className="font-medium text-gray-900">{contact.name}</p>
                        <p className="text-gray-600 ml-2">{contact.relationship}</p>
                        <p className="text-blue-600 ml-2">{contact.phone}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm italic">No emergency contacts recorded</p>
                )}
              </div>
            )}
          </div>

          {/* Connected People */}
          {(connectedGuardians.length > 0 || assignedCoaches.length > 0) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Users className="h-5 w-5 text-purple-500" />
                <h2 className="text-lg font-semibold text-gray-900">Connected People</h2>
              </div>

              {assignedCoaches.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-medium text-gray-900 mb-2 flex items-center">
                    <UserCheck className="h-4 w-4 text-green-500 mr-2" />
                    Job Coach{assignedCoaches.length > 1 ? 'es' : ''}
                  </h3>
                  <div className="space-y-2 ml-6">
                    {assignedCoaches.map((assignment: any) => (
                      <div key={assignment.id} className="text-sm bg-green-50 text-green-800 px-3 py-2 rounded-lg">
                        {getPersonName(assignment.coach_id)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {connectedGuardians.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2 flex items-center">
                    <Shield className="h-4 w-4 text-purple-500 mr-2" />
                    Guardian{connectedGuardians.length > 1 ? 's' : ''}
                  </h3>
                  <div className="space-y-2 ml-6">
                    {connectedGuardians.map((rel: any) => (
                      <div key={rel.id} className="text-sm bg-purple-50 text-purple-800 px-3 py-2 rounded-lg">
                        {getPersonName(rel.guardian_id)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Promotion Certifications - visible to Admins */}
          {canEdit && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
              <div className="flex items-center space-x-2 mb-4">
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
                        <button
                          type="button"
                          onClick={() => deleteCertification(cert.id)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Heart className="h-5 w-5 text-pink-500" />
                <h2 className="text-lg font-semibold text-gray-900">Support Information</h2>
              </div>
              {canEdit && !editingSupport && (
                <button
                  onClick={() => setEditingSupport(true)}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Edit support information"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </div>

            {editingSupport ? (
              <div className="space-y-6">
                {/* Interests & Motivators */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    <span className="flex items-center">
                      <Heart className="h-4 w-4 text-green-600 mr-2" />
                      Interests & Motivators
                    </span>
                    <span className="text-gray-500 text-xs ml-6">(What they enjoy and what motivates them)</span>
                  </label>
                  <div className="space-y-2">
                    {supportForm.interestsMotivators.map((item, index) => (
                      <div key={index} className="flex space-x-2">
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => updateSupportArrayItem('interestsMotivators', index, e.target.value)}
                          className={`flex-1 ${INPUT_BASE_CLASSES}`}
                          placeholder="e.g., Music, praise and recognition, colorful stickers"
                        />
                        {supportForm.interestsMotivators.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSupportArrayItem('interestsMotivators', index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end mt-2">
                    <button
                      type="button"
                      onClick={() => addSupportArrayItem('interestsMotivators')}
                      className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Interest/Motivator</span>
                    </button>
                  </div>
                </div>

                {/* Challenges */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    <span className="flex items-center">
                      <Zap className="h-4 w-4 text-orange-500 mr-2" />
                      Challenges
                    </span>
                    <span className="text-gray-500 text-xs ml-6">(Areas where they may need extra support)</span>
                  </label>
                  <div className="space-y-2">
                    {supportForm.challenges.map((challenge, index) => (
                      <div key={index} className="flex space-x-2">
                        <input
                          type="text"
                          value={challenge}
                          onChange={(e) => updateSupportArrayItem('challenges', index, e.target.value)}
                          className={`flex-1 ${INPUT_BASE_CLASSES}`}
                          placeholder="e.g., Loud noises, sudden changes in routine"
                        />
                        {supportForm.challenges.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSupportArrayItem('challenges', index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end mt-2">
                    <button
                      type="button"
                      onClick={() => addSupportArrayItem('challenges')}
                      className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Challenge</span>
                    </button>
                  </div>
                </div>

                {/* Regulation Strategies */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    <span className="flex items-center">
                      <Brain className="h-4 w-4 text-purple-600 mr-2" />
                      Support & Regulation Strategies
                    </span>
                    <span className="text-gray-500 text-xs ml-6">(Specific approaches that help them succeed)</span>
                  </label>
                  <div className="space-y-2">
                    {supportForm.regulationStrategies.map((strategy, index) => (
                      <div key={index} className="flex space-x-2">
                        <input
                          type="text"
                          value={strategy}
                          onChange={(e) => updateSupportArrayItem('regulationStrategies', index, e.target.value)}
                          className={`flex-1 ${INPUT_BASE_CLASSES}`}
                          placeholder="e.g., Offer 5-minute breaks, use visual schedules, speak in calm, quiet voice"
                        />
                        {supportForm.regulationStrategies.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSupportArrayItem('regulationStrategies', index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end mt-2">
                    <button
                      type="button"
                      onClick={() => addSupportArrayItem('regulationStrategies')}
                      className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Strategy</span>
                    </button>
                  </div>
                </div>

                {/* Save/Cancel buttons */}
                <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200">
                  <button
                    onClick={handleCancelSupport}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSupport}
                    disabled={savingProfile}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    <span>{savingProfile ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Interests & Motivators - View Mode */}
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
                    <Heart className="h-4 w-4 text-green-600 mr-2" />
                    Interests & Motivators
                  </h3>
                  {employee.interestsMotivators.length > 0 ? (
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
                  ) : (
                    <p className="text-gray-500 text-sm italic ml-6">No interests recorded</p>
                  )}
                </div>

                {/* Challenges - View Mode */}
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
                    <Zap className="h-4 w-4 text-orange-500 mr-2" />
                    Challenges
                  </h3>
                  {employee.challenges.length > 0 ? (
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
                  ) : (
                    <p className="text-gray-500 text-sm italic ml-6">No challenges recorded</p>
                  )}
                </div>

                {/* Support Strategies - View Mode */}
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
                    <Brain className="h-4 w-4 text-purple-600 mr-2" />
                    Support Strategies
                  </h3>
                  {employee.regulationStrategies.length > 0 ? (
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
                  ) : (
                    <p className="text-gray-500 text-sm italic ml-6">No strategies recorded</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Goals */}
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
      </div>
    </div>
  );
}