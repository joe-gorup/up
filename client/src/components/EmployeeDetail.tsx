import { useState, useEffect } from 'react';
import { ArrowLeft, Edit, Plus, Target, CheckCircle, Clock, AlertTriangle, Phone, Heart, Brain, Shield, Zap, Archive, X, Save, ChevronDown, ChevronRight, ChevronUp, Star, Lightbulb, Users, UserCheck, Link, Copy, Check, Mail, SquarePen, Award, Trash2, FileText, ClipboardCheck, Building2, Eye } from 'lucide-react';
import { useData, PromotionCertification } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../lib/auth';
import GoalAssignment from './GoalAssignment';
import CoachCheckin from './CoachCheckin';
import EmployeeProgress from './EmployeeProgress';
import EmployeeAvatar from './EmployeeAvatar';
import Modal from './ui/Modal';
import { PhoneInput, INPUT_BASE_CLASSES } from './ui/FormInput';

interface EmployeeDetailProps {
  employeeId: string;
  onClose: () => void;
  onEdit: (employeeId: string) => void;
  hideGoalCards?: boolean;
}

export default function EmployeeDetail({ employeeId, onClose, onEdit, hideGoalCards = false }: EmployeeDetailProps) {
  const { employees, developmentGoals, stepProgress, goalTemplates, updateGoal, archiveGoal, updateEmployee, certifications, addCertification, deleteCertification, guardianNotes, loadGuardianNotesForScooper, createAssessmentSession, endAssessmentSession, activeAssessmentSession } = useData();
  const { user } = useAuth();
  const [showGoalAssignment, setShowGoalAssignment] = useState(false);
  const [assessmentMode, setAssessmentMode] = useState(false);
  const [showSupportExpanded, setShowSupportExpanded] = useState(false);
  const [assessmentLocation, setAssessmentLocation] = useState('9540 Nall Avenue');
  const [profileAssessmentSessionId, setProfileAssessmentSessionId] = useState<string | null>(null);
  const [startingAssessment, setStartingAssessment] = useState(false);
  const [editingGoal, setEditingGoal] = useState<string | null>(null);
  const [expandedGoals, setExpandedGoals] = useState<Record<string, boolean>>({});
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    targetEndDate: ''
  });
  const [employeeContacts, setEmployeeContacts] = useState<any[]>([]);
  const [editingContacts, setEditingContacts] = useState(false);
  const [contactsEditForm, setContactsEditForm] = useState<Array<{
    id?: string; first_name: string; last_name: string; relationship_type: string;
    phone: string; email: string; is_emergency_contact: boolean; has_app_access?: boolean; _isNew?: boolean;
  }>>([]);
  const [contactSaving, setContactSaving] = useState(false);
  const [contactError, setContactError] = useState('');
  const [grantingAccess, setGrantingAccess] = useState<string | null>(null);
  const [inviteLinkMap, setInviteLinkMap] = useState<Record<string, string>>({});
  const [copiedContactId, setCopiedContactId] = useState<string | null>(null);
  const [assignedCoaches, setAssignedCoaches] = useState<any[]>([]);
  const [coachNotes, setCoachNotes] = useState<Array<{ id: string; employee_id: string; coach_id: string; title: string; content: string; created_at: string; updated_at: string; coach_name?: string }>>([]);
  const [loadingCoachNotes, setLoadingCoachNotes] = useState(false);
  const [activeGoalsExpanded, setActiveGoalsExpanded] = useState(true);

  // Inline editing states
  const [editingSafety, setEditingSafety] = useState(false);
  const [editingServiceProvider, setEditingServiceProvider] = useState(false);
  const [editingSupportInterests, setEditingSupportInterests] = useState(false);
  const [editingSupportChallenges, setEditingSupportChallenges] = useState(false);
  const [editingSupportStrategies, setEditingSupportStrategies] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  
  // Form data for inline editing
  const [safetyForm, setSafetyForm] = useState<string[]>(['']);
  const [supportForm, setSupportForm] = useState({
    interestsMotivators: [''],
    challenges: [''],
    regulationStrategies: ['']
  });
  const [serviceProviderForm, setServiceProviderForm] = useState<Array<{ name: string; type: string }>>([]);

  // Certification states
  const [showCertForm, setShowCertForm] = useState(false);
  const [editingCerts, setEditingCerts] = useState(false);
  const [certType, setCertType] = useState<'mentor' | 'shift_lead'>('mentor');
  const [certDate, setCertDate] = useState(new Date().toISOString().split('T')[0]);
  const [certNotes, setCertNotes] = useState('');
  const [savingCert, setSavingCert] = useState(false);
  const [checklistAnswers, setChecklistAnswers] = useState<Record<number, boolean>>({});

  // Invitation and relationship states (from remote)
  const [invitationEmail, setInvitationEmail] = useState(employees.find(e => e.id === employeeId)?.email || '');
  const [invitationLink, setInvitationLink] = useState('');
  const [invitationLoading, setInvitationLoading] = useState(false);
  const [invitationCopied, setInvitationCopied] = useState(false);
  const [invitationError, setInvitationError] = useState('');
  const [coachMentees, setCoachMentees] = useState<any[]>([]);
  const [selectedMenteeId, setSelectedMenteeId] = useState('');
  const [menteeError, setMenteeError] = useState('');
  const [showCheckins, setShowCheckins] = useState(false);
  const [pastAssessments, setPastAssessments] = useState<Array<{
    id: string; manager_id: string; date: string; location: string;
    status: string; created_at: string; updated_at: string;
    managerFirstName: string | null; managerLastName: string | null;
  }>>([]);
  const [loadingPastAssessments, setLoadingPastAssessments] = useState(false);
  const [pastAssessmentsExpanded, setPastAssessmentsExpanded] = useState(false);
  const [menteesExpanded, setMenteesExpanded] = useState(true);
  const [guardianNotesExpanded, setGuardianNotesExpanded] = useState(true);
  const [coachNotesExpanded, setCoachNotesExpanded] = useState(true);
  const [maintenanceGoalsExpanded, setMaintenanceGoalsExpanded] = useState(true);
  const [archivedGoalsExpanded, setArchivedGoalsExpanded] = useState(false);
  const [pastAssessmentsVisible, setPastAssessmentsVisible] = useState(3);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [sessionDetails, setSessionDetails] = useState<Record<string, { goals: Array<{ goalId: string; goalTitle: string; steps: Array<{ stepId: string; stepOrder: number; stepDescription: string; outcome: string; notes: string | null; completionTimeSeconds: number | null; timerManuallyEntered: boolean | null }>}>; summary: string | null; totalSteps: number }>>({});
  const [loadingSessionDetail, setLoadingSessionDetail] = useState(false);

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
      const isManager = ['Administrator', 'Shift Lead', 'Assistant Manager'].includes(user?.role || '');
      if (!isManager) return;
      try {
        const employee = employees.find(e => e.id === employeeId);

        if (employee?.role === 'Job Coach') {
          const menteeRes = await apiRequest(`/api/coach-assignments/coach/${employeeId}`);
          if (menteeRes.ok) {
            const data = await menteeRes.json();
            setCoachMentees(data);
          }
        } else {
          const [guardianRes, coachRes, contactsRes] = await Promise.all([
            apiRequest(`/api/guardian-relationships/scooper/${employeeId}`),
            apiRequest(`/api/coach-assignments/scooper/${employeeId}`),
            apiRequest(`/api/employees/${employeeId}/contacts`)
          ]);
          if (contactsRes.ok) {
            setEmployeeContacts(await contactsRes.json());
          }
          if (coachRes.ok) {
            const data = await coachRes.json();
            setAssignedCoaches(data);
          }
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

  // Load guardian notes for this employee
  useEffect(() => {
    const canViewNotes = ['Administrator', 'Shift Lead', 'Assistant Manager', 'Job Coach'].includes(user?.role || '');
    if (canViewNotes && employee?.role === 'Super Scooper') {
      loadGuardianNotesForScooper(employeeId);
    }
  }, [employeeId, user?.role, employee?.role]);

  // Load coach notes for this employee
  useEffect(() => {
    const canViewCoachNotes = ['Administrator', 'Shift Lead', 'Assistant Manager', 'Job Coach'].includes(user?.role || '');
    if (canViewCoachNotes && employee?.role === 'Super Scooper') {
      setLoadingCoachNotes(true);
      apiRequest(`/api/coach-notes/${employeeId}`)
        .then(res => res.ok ? res.json() : [])
        .then(notes => setCoachNotes(notes))
        .catch(() => setCoachNotes([]))
        .finally(() => setLoadingCoachNotes(false));
    }
  }, [employeeId, user?.role, employee?.role]);

  useEffect(() => {
    async function fetchPastAssessments() {
      setLoadingPastAssessments(true);
      try {
        const res = await apiRequest(`/api/employees/${employeeId}/assessment-history`);
        if (res.ok) {
          const sessions = await res.json();
          setPastAssessments(sessions);
          for (const session of sessions) {
            try {
              const detailRes = await apiRequest(`/api/assessment-sessions/${session.id}/details?employeeId=${employeeId}`);
              if (detailRes.ok) {
                const data = await detailRes.json();
                setSessionDetails(prev => ({ ...prev, [session.id]: data }));
              }
            } catch (err) {}
          }
        }
      } catch (err) {
      }
      setLoadingPastAssessments(false);
    }
    fetchPastAssessments();
  }, [employeeId]);

  async function toggleSessionDetails(sessionId: string) {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
      return;
    }
    setExpandedSessionId(sessionId);
    if (sessionDetails[sessionId]) return;
    setLoadingSessionDetail(true);
    try {
      const res = await apiRequest(`/api/assessment-sessions/${sessionId}/details?employeeId=${employeeId}`);
      if (res.ok) {
        const data = await res.json();
        setSessionDetails(prev => ({ ...prev, [sessionId]: data }));
      }
    } catch (err) {}
    setLoadingSessionDetail(false);
  }

  function formatTime(seconds: number | null): string {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  }

  function getOutcomeColor(outcome: string) {
    switch (outcome) {
      case 'correct': return 'bg-green-100 text-green-800 border-green-200';
      case 'incorrect': return 'bg-red-100 text-red-800 border-red-200';
      case 'prompted': case 'verbal_prompt': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'not_piped': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'gestural_prompt': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'modeling': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'physical_prompt': return 'bg-pink-100 text-pink-800 border-pink-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  function getOutcomeLabel(outcome: string) {
    switch (outcome) {
      case 'correct': return 'Correct';
      case 'incorrect': return 'Incorrect';
      case 'prompted': return 'Prompted';
      case 'verbal_prompt': return 'Verbal Prompt';
      case 'gestural_prompt': return 'Gestural Prompt';
      case 'modeling': return 'Modeling';
      case 'physical_prompt': return 'Physical Prompt';
      case 'not_piped': return 'Not Piped';
      default: return outcome;
    }
  }

  // Initialize form data when employee changes
  useEffect(() => {
    if (employee) {
      setSafetyForm(employee.allergies.length > 0 ? [...employee.allergies] : ['']);
      setSupportForm({
        interestsMotivators: employee.interestsMotivators.length > 0 ? [...employee.interestsMotivators] : [''],
        challenges: employee.challenges.length > 0 ? [...employee.challenges] : [''],
        regulationStrategies: employee.regulationStrategies.length > 0 ? [...employee.regulationStrategies] : ['']
      });
      setServiceProviderForm(
        employee.serviceProviders?.length > 0 
          ? employee.serviceProviders.map((p: any) => ({ name: p.name || '', type: p.type || '' }))
          : []
      );
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


  const handleSaveSupportCategory = async (category: 'interestsMotivators' | 'challenges' | 'regulationStrategies') => {
    setSavingProfile(true);
    try {
      await updateEmployee(employeeId, {
        [category]: supportForm[category].filter(i => i.trim() !== '')
      });
      if (category === 'interestsMotivators') setEditingSupportInterests(false);
      if (category === 'challenges') setEditingSupportChallenges(false);
      if (category === 'regulationStrategies') setEditingSupportStrategies(false);
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


  const handleCancelSupportCategory = (category: 'interestsMotivators' | 'challenges' | 'regulationStrategies') => {
    if (employee) {
      const data = employee[category];
      setSupportForm(prev => ({
        ...prev,
        [category]: data.length > 0 ? [...data] : ['']
      }));
    }
    if (category === 'interestsMotivators') setEditingSupportInterests(false);
    if (category === 'challenges') setEditingSupportChallenges(false);
    if (category === 'regulationStrategies') setEditingSupportStrategies(false);
  };

  const startEditingServiceProvider = () => {
    const providers = employee?.serviceProviders && employee.serviceProviders.length > 0
      ? employee.serviceProviders.map((p: any) => ({ name: p.name || '', type: p.type || '' }))
      : [{ name: '', type: '' }];
    setServiceProviderForm(providers);
    setEditingServiceProvider(true);
  };

  const handleSaveServiceProvider = async () => {
    setSavingProfile(true);
    try {
      const filtered = serviceProviderForm.filter(p => p.name.trim() !== '');
      await updateEmployee(employeeId, {
        hasServiceProvider: filtered.length > 0,
        serviceProviders: filtered
      });
      setEditingServiceProvider(false);
    } catch (error) {
      console.error('Error saving service provider:', error);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCancelServiceProvider = () => {
    setServiceProviderForm([]);
    setEditingServiceProvider(false);
  };

  const canAssess = ['Administrator', 'Shift Lead', 'Assistant Manager'].includes(user?.role || '');
  const isAssessable = ['Super Scooper', 'Assistant Manager'].includes(employees.find(e => e.id === employeeId)?.role || '');

  const handleStartAssessment = async () => {
    setStartingAssessment(true);
    try {
      const result = await createAssessmentSession([employeeId], assessmentLocation);
      if (result.success) {
        setProfileAssessmentSessionId(result.sessionId || null);
        setAssessmentMode(true);
        setActiveGoalsExpanded(false);
      } else {
        alert(result.error || 'Could not start assessment. The employee may be locked by another session.');
      }
    } catch (error) {
      console.error('Error starting assessment:', error);
      alert('Failed to start assessment session');
    } finally {
      setStartingAssessment(false);
    }
  };

  const handleEndAssessment = async () => {
    await endAssessmentSession();
    setAssessmentMode(false);
    setProfileAssessmentSessionId(null);
    setActiveGoalsExpanded(true);
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

  const startEditingContacts = () => {
    const existing = employeeContacts.map(c => ({
      id: c.id, first_name: c.first_name, last_name: c.last_name,
      relationship_type: c.relationship_type, phone: c.phone || '', email: c.email || '',
      is_emergency_contact: c.is_emergency_contact, has_app_access: c.has_app_access,
    }));
    setContactsEditForm(existing.length > 0 ? existing : [{
      id: undefined, first_name: '', last_name: '', relationship_type: 'guardian',
      phone: '', email: '', is_emergency_contact: false, has_app_access: false,
    }]);
    setContactError('');
    setEditingContacts(true);
  };

  const handleCancelContacts = () => {
    setEditingContacts(false);
    setContactsEditForm([]);
    setContactError('');
  };

  const handleSaveContacts = async () => {
    for (const c of contactsEditForm) {
      if (!c.first_name.trim() || !c.last_name.trim()) {
        setContactError('First and last name are required for all contacts');
        return;
      }
      if (c.is_emergency_contact && !c.phone.trim()) {
        setContactError('Phone is required for emergency contacts');
        return;
      }
    }
    setContactSaving(true);
    setContactError('');
    try {
      const deletedIds = employeeContacts.filter(ec => !contactsEditForm.some(f => f.id === ec.id)).map(ec => ec.id);
      for (const id of deletedIds) {
        const delRes = await apiRequest(`/api/contacts/${id}`, { method: 'DELETE' });
        if (!delRes.ok) { setContactError('Failed to remove a contact'); return; }
      }

      const updatedContacts: any[] = [];
      for (const c of contactsEditForm) {
        if (c._isNew) {
          const res = await apiRequest(`/api/employees/${employeeId}/contacts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ first_name: c.first_name, last_name: c.last_name, relationship_type: c.relationship_type, phone: c.phone, email: c.email, is_emergency_contact: c.is_emergency_contact }),
          });
          if (!res.ok) { const data = await res.json(); setContactError(data.error || 'Failed to add contact'); return; }
          updatedContacts.push(await res.json());
        } else {
          const original = employeeContacts.find(ec => ec.id === c.id);
          const changed = original && (original.first_name !== c.first_name || original.last_name !== c.last_name ||
            original.relationship_type !== c.relationship_type || (original.phone || '') !== c.phone ||
            (original.email || '') !== c.email || original.is_emergency_contact !== c.is_emergency_contact);
          if (changed) {
            const res = await apiRequest(`/api/contacts/${c.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ first_name: c.first_name, last_name: c.last_name, relationship_type: c.relationship_type, phone: c.phone, email: c.email, is_emergency_contact: c.is_emergency_contact }),
            });
            if (!res.ok) { const data = await res.json(); setContactError(data.error || 'Failed to update contact'); return; }
            updatedContacts.push(await res.json());
          } else {
            updatedContacts.push(original);
          }
        }
      }
      setEmployeeContacts(updatedContacts);
      setEditingContacts(false);
      setContactsEditForm([]);
    } catch (err) {
      setContactError('Failed to save contacts');
    } finally {
      setContactSaving(false);
    }
  };

  const addContactToForm = () => {
    setContactsEditForm(prev => [...prev, {
      first_name: '', last_name: '', relationship_type: 'Parent/Guardian',
      phone: '', email: '', is_emergency_contact: false, _isNew: true,
    }]);
  };

  const removeContactFromForm = (index: number) => {
    setContactsEditForm(prev => prev.filter((_, i) => i !== index));
  };

  const updateContactFormField = (index: number, field: string, value: any) => {
    setContactsEditForm(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const handleGrantAccess = async (contactId: string) => {
    setGrantingAccess(contactId);
    try {
      const res = await apiRequest(`/api/contacts/${contactId}/grant-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to grant access');
        return;
      }
      const { contact: updatedContact, setupUrl } = await res.json();
      setEmployeeContacts(prev => prev.map(c => c.id === contactId ? updatedContact : c));
      setInviteLinkMap(prev => ({ ...prev, [contactId]: setupUrl }));
    } catch (err) {
      alert('Failed to grant access');
    } finally {
      setGrantingAccess(null);
    }
  };

  const handleCopyInviteLink = (contactId: string) => {
    const link = inviteLinkMap[contactId];
    if (link) {
      navigator.clipboard.writeText(link);
      setCopiedContactId(contactId);
      setTimeout(() => setCopiedContactId(null), 2000);
    }
  };

  const handleAssignMentee = async () => {
    if (!selectedMenteeId) return;
    setMenteeError('');
    try {
      const res = await apiRequest('/api/coach-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coach_id: employeeId,
          scooper_id: selectedMenteeId,
          assigned_by: user?.id,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setMenteeError(data.error || 'Failed to assign mentee');
        return;
      }
      setSelectedMenteeId('');
      const menteeRes = await apiRequest(`/api/coach-assignments/coach/${employeeId}`);
      if (menteeRes.ok) {
        const data = await menteeRes.json();
        setCoachMentees(data);
      }
    } catch (err) {
      setMenteeError('Failed to assign mentee');
    }
  };

  const handleRemoveMentee = async (assignmentId: string) => {
    if (!window.confirm('Are you sure you want to remove this mentee assignment?')) return;
    try {
      await apiRequest(`/api/coach-assignments/${assignmentId}`, { method: 'DELETE' });
      setCoachMentees(prev => prev.filter(a => a.id !== assignmentId));
    } catch (err) {
      console.error('Failed to remove mentee:', err);
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

  if (showCheckins && employee.role === 'Super Scooper') {
    return (
      <CoachCheckin
        employeeId={employeeId}
        employeeName={`${employee.first_name} ${employee.last_name}`}
        onClose={() => setShowCheckins(false)}
      />
    );
  }

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto">
      {/* Demographic Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="p-3 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-gray-100 transition-colors flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <EmployeeAvatar 
                name={`${employee.first_name} ${employee.last_name}`}
                imageUrl={employee.profileImageUrl}
                size="lg"
              />
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{`${employee.first_name} ${employee.last_name}`}</h1>
                <p className="text-gray-600 text-sm">{employee.role}</p>
                {employee.allergies.length > 0 && (
                  <div className="flex items-center flex-wrap gap-2 mt-1.5">
                    <span className="flex items-center text-red-600 text-sm font-medium">
                      <AlertTriangle className="h-4 w-4 mr-1" />
                      Allergies:
                    </span>
                    {employee.allergies.map((allergy, i) => (
                      <span key={i} className="bg-red-50 text-red-700 px-3 py-0.5 rounded-full text-sm">{allergy}</span>
                    ))}
                  </div>
                )}
                <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
                  {employeeContacts.filter(c => c.is_emergency_contact).length > 0 && (
                    <div className="flex items-center space-x-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full text-xs" title={`${employeeContacts.filter(c => c.is_emergency_contact).length} emergency contact(s)`}>
                      <Phone className="h-3 w-3" />
                      <span>{employeeContacts.filter(c => c.is_emergency_contact).length}</span>
                    </div>
                  )}
                  {employee.interestsMotivators.length > 0 && (
                    <div className="flex items-center space-x-1 text-green-600 bg-green-50 px-2 py-0.5 rounded-full text-xs" title={`Interests: ${employee.interestsMotivators.join(', ')}`}>
                      <Heart className="h-3 w-3" />
                      <span>{employee.interestsMotivators.length}</span>
                    </div>
                  )}
                  {employee.challenges.length > 0 && (
                    <div className="flex items-center space-x-1 text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full text-xs" title={`Challenges: ${employee.challenges.join(', ')}`}>
                      <Zap className="h-3 w-3" />
                      <span>{employee.challenges.length}</span>
                    </div>
                  )}
                  {employee.regulationStrategies.length > 0 && (
                    <div className="flex items-center space-x-1 text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full text-xs" title={`Strategies: ${employee.regulationStrategies.join(', ')}`}>
                      <Brain className="h-3 w-3" />
                      <span>{employee.regulationStrategies.length}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {user?.role === 'Administrator' && (
                <button
                  onClick={() => onEdit(employeeId)}
                  className="flex items-center space-x-2 bg-gray-600 text-white px-2 sm:px-4 py-2 rounded-xl hover:bg-gray-700 transition-colors text-sm"
                  title="Edit employee"
                >
                  <Edit className="h-4 w-4" />
                  <span className="hidden sm:inline">Edit</span>
                </button>
              )}
              {employee.role === 'Super Scooper' && user?.role === 'Job Coach' && (
                <button
                  onClick={() => setShowCheckins(true)}
                  className="flex items-center space-x-2 bg-amber-500 text-white px-2 sm:px-4 py-2 rounded-xl hover:bg-amber-600 transition-colors text-sm"
                  title="Check-In Notes"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  <span className="hidden sm:inline">Check-In</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowSupportExpanded(!showSupportExpanded)}
          className="w-full flex items-center justify-center gap-2 py-2 border-t border-gray-100 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors rounded-b-xl"
        >
          <span className="font-medium">{showSupportExpanded ? 'Hide Details' : 'View Details'}</span>
          {showSupportExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showSupportExpanded && (
          <div className="border-t border-gray-200 p-3 sm:p-5">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Heart className="h-4 w-4 text-pink-500" />
                <h3 className="text-sm font-semibold text-gray-900">Support Information</h3>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-600 flex items-center">
                      <Heart className="h-3.5 w-3.5 text-green-600 mr-1.5" /> Interests & Motivators
                    </h4>
                    {canEdit && !editingSupportInterests && (
                      <button
                        onClick={() => setEditingSupportInterests(true)}
                        className="p-1.5 text-green-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Edit interests & motivators"
                      >
                        <SquarePen className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {editingSupportInterests ? (
                    <div>
                      <div className="space-y-1.5">
                        {supportForm.interestsMotivators.map((item, index) => (
                          <div key={index} className="flex space-x-1.5">
                            <input type="text" value={item} onChange={(e) => updateSupportArrayItem('interestsMotivators', index, e.target.value)} className={`flex-1 text-sm ${INPUT_BASE_CLASSES}`} placeholder="Interest or motivator" />
                            {supportForm.interestsMotivators.length > 1 && (
                              <button type="button" onClick={() => removeSupportArrayItem('interestsMotivators', index)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={() => addSupportArrayItem('interestsMotivators')} className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-xs font-medium mt-2 pt-1">
                        <Plus className="h-3.5 w-3.5" /><span>Add</span>
                      </button>
                      <div className="flex justify-end space-x-2 pt-3 mt-2 border-t border-gray-100">
                        <button onClick={() => handleCancelSupportCategory('interestsMotivators')} className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-full text-xs font-medium transition-colors">Cancel</button>
                        <button onClick={() => handleSaveSupportCategory('interestsMotivators')} disabled={savingProfile} className="flex items-center space-x-1 px-3 py-1.5 bg-green-600 text-white rounded-full hover:bg-green-700 text-xs font-medium disabled:opacity-50 transition-colors">
                          <Save className="h-3 w-3" />
                          <span>{savingProfile ? 'Saving...' : 'Save'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    employee.interestsMotivators.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {employee.interestsMotivators.map((item, i) => (
                          <span key={i} className="bg-green-100 text-green-800 px-2.5 py-1 rounded-full text-sm">{item}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm italic">None recorded</p>
                    )
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-600 flex items-center">
                      <Zap className="h-3.5 w-3.5 text-orange-500 mr-1.5" /> Challenges
                    </h4>
                    {canEdit && !editingSupportChallenges && (
                      <button
                        onClick={() => setEditingSupportChallenges(true)}
                        className="p-1.5 text-orange-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                        title="Edit challenges"
                      >
                        <SquarePen className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {editingSupportChallenges ? (
                    <div>
                      <div className="space-y-1.5">
                        {supportForm.challenges.map((challenge, index) => (
                          <div key={index} className="flex space-x-1.5">
                            <input type="text" value={challenge} onChange={(e) => updateSupportArrayItem('challenges', index, e.target.value)} className={`flex-1 text-sm ${INPUT_BASE_CLASSES}`} placeholder="Challenge" />
                            {supportForm.challenges.length > 1 && (
                              <button type="button" onClick={() => removeSupportArrayItem('challenges', index)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={() => addSupportArrayItem('challenges')} className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-xs font-medium mt-2 pt-1">
                        <Plus className="h-3.5 w-3.5" /><span>Add</span>
                      </button>
                      <div className="flex justify-end space-x-2 pt-3 mt-2 border-t border-gray-100">
                        <button onClick={() => handleCancelSupportCategory('challenges')} className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-full text-xs font-medium transition-colors">Cancel</button>
                        <button onClick={() => handleSaveSupportCategory('challenges')} disabled={savingProfile} className="flex items-center space-x-1 px-3 py-1.5 bg-orange-600 text-white rounded-full hover:bg-orange-700 text-xs font-medium disabled:opacity-50 transition-colors">
                          <Save className="h-3 w-3" />
                          <span>{savingProfile ? 'Saving...' : 'Save'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    employee.challenges.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {employee.challenges.map((item, i) => (
                          <span key={i} className="bg-yellow-100 text-yellow-800 px-2.5 py-1 rounded-full text-sm">{item}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm italic">None recorded</p>
                    )
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-600 flex items-center">
                      <Brain className="h-3.5 w-3.5 text-purple-600 mr-1.5" /> Regulation Strategies
                    </h4>
                    {canEdit && !editingSupportStrategies && (
                      <button
                        onClick={() => setEditingSupportStrategies(true)}
                        className="p-1.5 text-purple-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Edit regulation strategies"
                      >
                        <SquarePen className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {editingSupportStrategies ? (
                    <div>
                      <div className="space-y-1.5">
                        {supportForm.regulationStrategies.map((strategy, index) => (
                          <div key={index} className="flex space-x-1.5">
                            <input type="text" value={strategy} onChange={(e) => updateSupportArrayItem('regulationStrategies', index, e.target.value)} className={`flex-1 text-sm ${INPUT_BASE_CLASSES}`} placeholder="Strategy" />
                            {supportForm.regulationStrategies.length > 1 && (
                              <button type="button" onClick={() => removeSupportArrayItem('regulationStrategies', index)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={() => addSupportArrayItem('regulationStrategies')} className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-xs font-medium mt-2 pt-1">
                        <Plus className="h-3.5 w-3.5" /><span>Add</span>
                      </button>
                      <div className="flex justify-end space-x-2 pt-3 mt-2 border-t border-gray-100">
                        <button onClick={() => handleCancelSupportCategory('regulationStrategies')} className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-full text-xs font-medium transition-colors">Cancel</button>
                        <button onClick={() => handleSaveSupportCategory('regulationStrategies')} disabled={savingProfile} className="flex items-center space-x-1 px-3 py-1.5 bg-purple-600 text-white rounded-full hover:bg-purple-700 text-xs font-medium disabled:opacity-50 transition-colors">
                          <Save className="h-3 w-3" />
                          <span>{savingProfile ? 'Saving...' : 'Save'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    employee.regulationStrategies.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {employee.regulationStrategies.map((item, i) => (
                          <span key={i} className="bg-purple-100 text-purple-800 px-2.5 py-1 rounded-full text-sm">{item}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm italic">None recorded</p>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Contacts, Service Provider & Job Coaches Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 pt-5 border-t border-gray-200">
                {/* Contacts - unified */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-purple-500" />
                      <h3 className="text-sm font-semibold text-gray-900">Contacts</h3>
                    </div>
                    {canEdit && !editingContacts && (
                      <button
                        onClick={startEditingContacts}
                        className="p-1.5 text-purple-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Edit contacts"
                      >
                        <SquarePen className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {editingContacts ? (
                    <div className="space-y-3">
                      {contactError && (
                        <div className="text-xs text-red-600 bg-red-50 p-2 rounded-lg">{contactError}</div>
                      )}
                      {contactsEditForm.map((contact, index) => (
                        <div key={contact.id || `new-${index}`} className="p-3 border border-gray-200 rounded-xl bg-gray-50 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-500">{contact._isNew ? 'New Contact' : `${contact.first_name} ${contact.last_name}`}</span>
                            <button type="button" onClick={() => removeContactFromForm(index)} className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Remove contact">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input type="text" value={contact.first_name} onChange={e => updateContactFormField(index, 'first_name', e.target.value)} className={`w-full text-sm ${INPUT_BASE_CLASSES}`} placeholder="First name *" />
                            <input type="text" value={contact.last_name} onChange={e => updateContactFormField(index, 'last_name', e.target.value)} className={`w-full text-sm ${INPUT_BASE_CLASSES}`} placeholder="Last name *" />
                            <input type="email" value={contact.email} onChange={e => updateContactFormField(index, 'email', e.target.value)} className={`w-full text-sm ${INPUT_BASE_CLASSES}`} placeholder="Email" />
                            <input type="tel" value={contact.phone} onChange={e => updateContactFormField(index, 'phone', e.target.value)} className={`w-full text-sm ${INPUT_BASE_CLASSES}`} placeholder={contact.is_emergency_contact ? 'Phone *' : 'Phone'} />
                            <select value={contact.relationship_type} onChange={e => updateContactFormField(index, 'relationship_type', e.target.value)} className={`w-full text-sm ${INPUT_BASE_CLASSES}`}>
                              <option value="Parent/Guardian">Parent/Guardian</option>
                              <option value="Parent">Parent</option>
                              <option value="Legal Guardian">Legal Guardian</option>
                              <option value="Case Manager">Case Manager</option>
                              <option value="Family Member">Family Member</option>
                              <option value="Employer">Employer</option>
                              <option value="Other">Other</option>
                            </select>
                            <label className="flex items-center space-x-2 cursor-pointer self-center">
                              <input type="checkbox" checked={contact.is_emergency_contact} onChange={e => updateContactFormField(index, 'is_emergency_contact', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                              <span className="text-xs font-medium text-gray-700">Emergency</span>
                            </label>
                          </div>
                        </div>
                      ))}
                      <button type="button" onClick={addContactToForm} className="flex items-center space-x-1 text-purple-600 hover:text-purple-700 text-xs font-medium mt-2 pt-1">
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add</span>
                      </button>
                      <div className="flex justify-end space-x-2 pt-2">
                        <button onClick={handleCancelContacts} className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-full text-xs font-medium transition-colors">Cancel</button>
                        <button onClick={handleSaveContacts} disabled={contactSaving} className="flex items-center space-x-1 px-3 py-1.5 bg-purple-600 text-white rounded-full hover:bg-purple-700 text-xs font-medium disabled:opacity-50 transition-colors">
                          <Save className="h-3 w-3" />
                          <span>{contactSaving ? 'Saving...' : 'Save'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {employeeContacts.length > 0 ? (
                        <div className="space-y-3">
                          {employeeContacts.map(contact => (
                            <div key={contact.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-xl bg-gray-50">
                              <div className="flex items-center space-x-3 flex-1 min-w-0">
                                <Users className="h-5 w-5 text-purple-500 shrink-0" />
                                <div className="min-w-0">
                                  <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
                                    <p className="font-medium text-gray-900">{contact.first_name} {contact.last_name}</p>
                                    {contact.is_emergency_contact && (
                                      <span className="inline-flex items-center bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full text-[10px] font-medium">
                                        <Phone className="h-2.5 w-2.5 mr-0.5" />
                                        Emergency
                                      </span>
                                    )}
                                    {contact.has_app_access && (
                                      <span className="inline-flex items-center bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full text-[10px] font-medium">
                                        <Check className="h-2.5 w-2.5 mr-0.5" />
                                        App Access
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                    <p className="text-sm text-gray-500">{contact.relationship_type}</p>
                                    {contact.phone && <p className="text-sm text-blue-600">{contact.phone}</p>}
                                    {contact.email && <p className="text-sm text-gray-500">{contact.email}</p>}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-1 ml-2 shrink-0">
                                {user?.role === 'Administrator' && !contact.has_app_access && ['Parent/Guardian', 'Parent'].includes(contact.relationship_type) && contact.email && (
                                  <button
                                    onClick={() => handleGrantAccess(contact.id)}
                                    disabled={grantingAccess === contact.id}
                                    className="p-1 text-purple-500 hover:bg-purple-50 rounded-lg transition-colors"
                                    title="Grant app access"
                                  >
                                    {grantingAccess === contact.id ? (
                                      <Clock className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Link className="h-4 w-4" />
                                    )}
                                  </button>
                                )}
                                {inviteLinkMap[contact.id] && (
                                  <button
                                    onClick={() => handleCopyInviteLink(contact.id)}
                                    className="p-1 text-green-500 hover:bg-green-50 rounded-lg transition-colors"
                                    title="Copy invite link"
                                  >
                                    {copiedContactId === contact.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 italic">No contacts added yet.</p>
                      )}
                    </>
                  )}

                </div>

                {/* Service Provider - Super Scoopers only */}
                {employee.role === 'Super Scooper' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-4 w-4 text-indigo-500" />
                      <h3 className="text-sm font-semibold text-gray-900">Service Provider</h3>
                    </div>
                    {canEdit && !editingServiceProvider && (
                      <button
                        onClick={startEditingServiceProvider}
                        className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Edit service provider"
                      >
                        <SquarePen className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {editingServiceProvider ? (
                    <div className="space-y-3">
                      {serviceProviderForm.map((provider, index) => (
                        <div key={index} className="flex space-x-2">
                          <input type="text" value={provider.name} onChange={(e) => { const updated = [...serviceProviderForm]; updated[index] = { ...updated[index], name: e.target.value }; setServiceProviderForm(updated); }} className={`flex-1 text-sm ${INPUT_BASE_CLASSES}`} placeholder="Agency or person name" />
                          <button type="button" onClick={() => setServiceProviderForm(prev => prev.filter((_, i) => i !== index))} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={() => setServiceProviderForm(prev => [...prev, { name: '', type: '' }])} className="flex items-center space-x-1 text-indigo-600 hover:text-indigo-700 text-xs font-medium mt-2 pt-1">
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add</span>
                      </button>
                      <div className="flex justify-end space-x-2 pt-2">
                        <button onClick={handleCancelServiceProvider} className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-full text-xs font-medium transition-colors">Cancel</button>
                        <button onClick={handleSaveServiceProvider} disabled={savingProfile} className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 text-xs font-medium disabled:opacity-50 transition-colors">
                          <Save className="h-3 w-3" />
                          <span>{savingProfile ? 'Saving...' : 'Save'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {employee.hasServiceProvider && employee.serviceProviders?.length > 0 ? (
                        <div className="space-y-1.5">
                          {employee.serviceProviders.map((provider, index) => (
                            <div key={index} className="p-3 border border-gray-200 rounded-xl bg-gray-50">
                              <div className="flex items-center space-x-2">
                                <Building2 className="h-4 w-4 text-indigo-400 shrink-0" />
                                <span className="text-sm font-medium text-gray-900">{provider.name}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-sm italic">No service provider</p>
                      )}
                    </div>
                  )}
                </div>
                )}

                {/* Job Coaches */}
                {employee.role === 'Super Scooper' && (
                <div>
                  <div className="flex items-center space-x-2 mb-3">
                    <UserCheck className="h-4 w-4 text-green-500" />
                    <h3 className="text-sm font-semibold text-gray-900">Job Coach{assignedCoaches.length > 1 ? 'es' : ''}</h3>
                  </div>
                  {assignedCoaches.length > 0 ? (
                    <div className="space-y-2">
                      {assignedCoaches.map((assignment: any) => (
                        <div key={assignment.id} className="text-sm bg-green-50 text-green-800 px-3 py-2 rounded-lg font-medium">
                          {getPersonName(assignment.coach_id)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">No job coaches assigned</p>
                  )}
                </div>
                )}
              </div>

            {/* Health & Safety Row + Promotion Certifications */}
            <div className="mt-6 pt-5 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <h3 className="text-sm font-semibold text-gray-900">Allergies & Dietary</h3>
                  </div>
                  {canEdit && !editingSafety && (
                    <button
                      onClick={() => setEditingSafety(true)}
                      className="p-1.5 text-amber-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                      title="Edit allergies"
                    >
                      <SquarePen className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {editingSafety ? (
                  <div className="space-y-2">
                    {safetyForm.map((allergy, index) => (
                      <div key={index} className="flex space-x-2">
                        <input type="text" value={allergy} onChange={(e) => updateArrayItem(setSafetyForm, index, e.target.value)} className={`flex-1 text-sm ${INPUT_BASE_CLASSES}`} placeholder="Allergy or restriction" />
                        {safetyForm.length > 1 && (
                          <button type="button" onClick={() => removeArrayItem(setSafetyForm, index)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-2">
                      <button type="button" onClick={() => addArrayItem(setSafetyForm)} className="flex items-center space-x-1 text-amber-600 hover:text-amber-700 text-xs font-medium">
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add</span>
                      </button>
                      <div className="flex space-x-2">
                        <button onClick={handleCancelSafety} className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-full text-xs font-medium transition-colors">Cancel</button>
                        <button onClick={handleSaveSafety} disabled={savingProfile} className="flex items-center space-x-1 px-3 py-1.5 bg-amber-600 text-white rounded-full hover:bg-amber-700 text-xs font-medium disabled:opacity-50 transition-colors">
                          <Save className="h-3 w-3" />
                          <span>{savingProfile ? 'Saving...' : 'Save'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    {employee.allergies.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {employee.allergies.map((allergy, index) => (
                          <span key={index} className="bg-red-100 text-red-800 px-2.5 py-1 rounded-full text-sm">{allergy}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm italic">No allergies recorded</p>
                    )}
                  </div>
                )}
              </div>

              {canEdit && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Award className="h-4 w-4 text-amber-600" />
                    <h3 className="text-sm font-semibold text-gray-900">Promotion Certifications</h3>
                  </div>
                  {!editingCerts && (
                    <button
                      onClick={() => setEditingCerts(true)}
                      className="p-1.5 text-amber-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                      title="Edit certifications"
                    >
                      <SquarePen className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {employeeCerts.length > 0 ? (
                  <div className="space-y-2 mb-3">
                    {employeeCerts.map((cert) => (
                      <div key={cert.id} className="flex items-center justify-between p-2.5 border border-gray-200 rounded-xl bg-gray-50">
                        <div className="flex items-center space-x-2">
                          {cert.certificationType === 'mentor' ? (
                            <Star className="h-4 w-4 text-amber-500" />
                          ) : (
                            <Shield className="h-4 w-4 text-blue-500" />
                          )}
                          <div>
                            <p className="font-medium text-gray-900 text-xs">
                              {cert.certificationType === 'mentor' ? 'Mentor' : 'Shift Lead'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(cert.dateCompleted).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`text-xs font-medium ${cert.passed ? 'text-green-600' : 'text-red-600'}`}>
                            {cert.score}%
                            {cert.passed ? (
                              <CheckCircle className="inline h-3.5 w-3.5 ml-0.5" />
                            ) : (
                              <X className="inline h-3.5 w-3.5 ml-0.5" />
                            )}
                          </span>
                          {editingCerts && (
                            <button
                              type="button"
                              onClick={() => deleteCertification(cert.id)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic mb-3">No certifications recorded yet.</p>
                )}

                {editingCerts && (
                  <div className="flex justify-between items-center pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setChecklistAnswers({});
                        setCertNotes('');
                        setCertDate(new Date().toISOString().split('T')[0]);
                        setCertType('mentor');
                        setShowCertForm(true);
                      }}
                      className="flex items-center gap-1.5 text-amber-600 hover:text-amber-700 text-xs font-medium"
                      title="Add Certification"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add</span>
                    </button>
                    <div className="flex space-x-2">
                      <button onClick={() => setEditingCerts(false)} className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-full text-xs font-medium transition-colors">Cancel</button>
                      <button onClick={() => setEditingCerts(false)} className="flex items-center space-x-1 px-3 py-1.5 bg-amber-600 text-white rounded-full hover:bg-amber-700 text-xs font-medium transition-colors">
                        <Save className="h-3 w-3" />
                        <span>Save</span>
                      </button>
                    </div>
                  </div>
                )}

              <Modal
                isOpen={showCertForm}
                onClose={() => { setShowCertForm(false); setChecklistAnswers({}); setCertNotes(''); }}
                title="Record Certification"
                titleIcon={<Award className="h-5 w-5 text-amber-600" />}
                size="lg"
              >
                <div className="space-y-4">
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
                      onClick={() => { setCertType('shift_lead'); setChecklistAnswers({}); }}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${certType === 'shift_lead' ? 'bg-blue-100 text-blue-800 border border-blue-300' : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'}`}
                    >
                      Shift Lead
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date Completed</label>
                    <input
                      type="date"
                      value={certDate}
                      onChange={(e) => setCertDate(e.target.value)}
                      className={`w-full sm:w-auto text-sm ${INPUT_BASE_CLASSES}`}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Checklist</label>
                    <div className="max-h-72 overflow-y-auto border border-gray-200 rounded-xl">
                      {certType === 'mentor' ? (
                        mentorChecklistItems.map((item, idx) => (
                          <label
                            key={idx}
                            className={`flex items-start space-x-3 px-3 py-2.5 cursor-pointer hover:bg-gray-100 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
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
                              <div className="px-3 py-1.5 bg-gray-200 font-medium text-sm text-gray-700 sticky top-0">
                                {category.name}
                              </div>
                              {category.items.map((item, itemIdx) => {
                                const currentIdx = globalIdx++;
                                return (
                                  <label
                                    key={currentIdx}
                                    className={`flex items-start space-x-3 px-3 py-2.5 cursor-pointer hover:bg-gray-100 transition-colors ${currentIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
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
                      className={`w-full text-sm ${INPUT_BASE_CLASSES}`}
                      rows={3}
                      placeholder="Optional notes about this certification..."
                    />
                  </div>

                  <div className="flex space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={handleSaveCertification}
                      disabled={savingCert}
                      className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      {savingCert ? 'Saving...' : 'Save Certification'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowCertForm(false); setChecklistAnswers({}); setCertNotes(''); }}
                      className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </Modal>
              </div>
              )}
            </div>

          </div>
        )}
      </div>

      {!hideGoalCards && (
      <>
      {/* Full-width Assessment in Progress card - shown above the grid during assessment mode for Super Scoopers */}
      {employee.role === 'Super Scooper' && canAssess && isAssessable && activeGoals.length > 0 && assessmentMode && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6 mb-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <ClipboardCheck className="h-5 w-5 text-green-600" />
                <h2 className="text-lg font-semibold text-gray-900">Assessment in Progress</h2>
              </div>
              <button
                onClick={handleEndAssessment}
                className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-xl hover:bg-red-100 transition-colors text-sm font-medium"
                title="End Assessment"
              >
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">End Assessment</span>
              </button>
            </div>
            <div className="text-sm text-gray-500 mb-4 flex items-center gap-2">
              <span>Location: {assessmentLocation}</span>
            </div>
            <EmployeeProgress
              employee={employee}
              assessmentSessionId={profileAssessmentSessionId || activeAssessmentSession?.id}
            />
          </div>
        </div>
      )}

      <div className={`grid grid-cols-1 ${employee.role === 'Super Scooper' ? (assessmentMode ? 'lg:grid-cols-2' : 'lg:grid-cols-3') : 'md:grid-cols-2 lg:grid-cols-3'} gap-6`}>
        {/* Left Column for Super Scoopers: Assessment card (when not in assessment mode) + Guardian/Coach Notes */}
        <div className={employee.role === 'Super Scooper' ? 'lg:col-span-1 space-y-6' : 'contents'}>

          {/* Assigned Mentees Section - for Job Coaches, visible to managers */}
          {employee.role === 'Job Coach' && ['Administrator', 'Shift Lead', 'Assistant Manager'].includes(user?.role || '') && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setMenteesExpanded(!menteesExpanded)}
                  className="flex items-center space-x-2 py-1 text-left hover:bg-gray-50 rounded-lg px-1 transition-colors"
                >
                  {menteesExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                  <Users className="h-5 w-5 text-green-500" />
                  <h2 className="text-lg font-semibold text-gray-900">Assigned Mentees</h2>
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                    {coachMentees.length}
                  </span>
                </button>
              </div>

              {menteesExpanded && user?.role === 'Administrator' && (
                <div className="mb-4">
                  {menteeError && (
                    <div className="text-sm text-red-600 bg-red-50 p-2 rounded-lg mb-3">{menteeError}</div>
                  )}
                  <div className="flex items-center gap-3">
                    <select
                      value={selectedMenteeId}
                      onChange={e => setSelectedMenteeId(e.target.value)}
                      className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="">Select an employee to assign...</option>
                      {employees
                        .filter(e =>
                          e.isActive &&
                          e.role === 'Super Scooper' &&
                          !coachMentees.some(m => m.scooper_id === e.id)
                        )
                        .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`))
                        .map(e => (
                          <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                        ))
                      }
                    </select>
                    <button
                      onClick={handleAssignMentee}
                      disabled={!selectedMenteeId}
                      className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
                    >
                      Assign
                    </button>
                  </div>
                </div>
              )}

              {menteesExpanded && (coachMentees.length > 0 ? (
                <div className="space-y-3 mt-4">
                  {coachMentees.map((assignment: any) => (
                    <div key={assignment.id} className="flex items-center justify-between bg-green-50 px-4 py-3 rounded-xl">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{getPersonName(assignment.scooper_id)}</p>
                        <p className="text-xs text-gray-500">
                          {employees.find(e => e.id === assignment.scooper_id)?.email || ''}
                        </p>
                      </div>
                      {user?.role === 'Administrator' && (
                        <button
                          onClick={() => handleRemoveMentee(assignment.id)}
                          className="text-red-400 hover:text-red-600 p-1"
                          title="Remove assignment"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic mt-4">No mentees assigned yet.</p>
              ))}
            </div>
          )}

          {/* Goal Assessment Section - in left column for Super Scoopers (only when NOT in assessment mode) */}
          {employee.role === 'Super Scooper' && canAssess && isAssessable && activeGoals.length > 0 && !assessmentMode && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <ClipboardCheck className="h-5 w-5 text-blue-600" />
                    <h2 className="text-lg font-semibold text-gray-900">Goal Assessment</h2>
                  </div>

                  {activeAssessmentSession && activeAssessmentSession.employeeIds.includes(employeeId) ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                        <ClipboardCheck className="h-4 w-4 text-amber-600 flex-shrink-0" />
                        <div className="text-sm">
                          <span className="font-medium text-amber-800">Assessment in progress</span>
                          <span className="text-amber-600 ml-1">at {activeAssessmentSession.location}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setProfileAssessmentSessionId(activeAssessmentSession.id);
                          setAssessmentLocation(activeAssessmentSession.location || '9540 Nall Avenue');
                          setAssessmentMode(true);
                          setActiveGoalsExpanded(false);
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 transition-colors"
                      >
                        <ClipboardCheck className="h-5 w-5" />
                        <span className="hidden sm:inline">Resume Assessment</span>
                        <span className="sm:hidden">Resume</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                        <select
                          value={assessmentLocation}
                          onChange={(e) => setAssessmentLocation(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        >
                          <option value="9540 Nall Avenue">9540 Nall Avenue</option>
                          <option value="4701 Indian Creek Parkway">4701 Indian Creek Parkway</option>
                          <option value="Remote">Remote</option>
                        </select>
                      </div>
                      <button
                        onClick={handleStartAssessment}
                        disabled={startingAssessment}
                        className="w-full flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        <ClipboardCheck className="h-5 w-5" />
                        <span className="hidden sm:inline">{startingAssessment ? 'Starting...' : 'Start Assessment'}</span>
                        <span className="sm:hidden">{startingAssessment ? '...' : 'Start'}</span>
                      </button>
                    </div>
                  )}
                </div>
            </div>
          )}

          {/* Past Assessments card - always separate in left column for Super Scoopers (not in assessment mode) */}
          {employee.role === 'Super Scooper' && !assessmentMode && pastAssessments.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
              <button
                onClick={() => { setPastAssessmentsExpanded(!pastAssessmentsExpanded); setPastAssessmentsVisible(3); }}
                className="flex items-center space-x-2 py-1 text-left hover:bg-gray-50 rounded-lg px-1 transition-colors"
              >
                {pastAssessmentsExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                <FileText className="h-5 w-5 text-indigo-500" />
                <h2 className="text-lg font-semibold text-gray-900">Past Assessments</h2>
                <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full text-xs font-medium">
                  {pastAssessments.length}
                </span>
              </button>
              {pastAssessmentsExpanded && (
                <div className="mt-3 space-y-2">
                  {pastAssessments.slice(0, pastAssessmentsVisible).map((session) => {
                    const sessionDate = new Date(session.date + 'T00:00:00');
                    const sessionTime = session.created_at ? new Date(session.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
                    const details = sessionDetails[session.id];
                    const isExpanded = expandedSessionId === session.id;
                    return (
                    <div key={session.id} className={`border rounded-xl p-3 transition-colors ${isExpanded ? 'border-indigo-200 bg-indigo-50/30' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap text-sm text-gray-700 min-w-0">
                          <span className="font-medium">{sessionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          {sessionTime && <span className="text-gray-400 text-xs">{sessionTime}</span>}
                          <span className="text-gray-500 text-xs truncate">
                            {session.managerFirstName && session.managerLastName
                              ? `${session.managerFirstName} ${session.managerLastName}`
                              : ''}
                          </span>
                        </div>
                        <button
                          onClick={() => toggleSessionDetails(session.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex-shrink-0 ${isExpanded ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {isExpanded ? 'Hide' : 'View'}
                        </button>
                      </div>
                      {isExpanded && loadingSessionDetail && !details && (
                        <div className="mt-3 pt-3 border-t border-indigo-100 flex items-center justify-center py-4">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500" />
                        </div>
                      )}
                      {details && isExpanded ? (
                        <div className="mt-3 pt-3 border-t border-indigo-100">
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {details.goals.map((goal) => (
                              <span key={goal.goalId} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-blue-200 text-blue-700 bg-blue-50">
                                {goal.goalTitle}
                              </span>
                            ))}
                          </div>
                          {details.summary && <p className="text-sm text-gray-600 mb-3 bg-white rounded-lg p-2 border border-gray-100">{details.summary}</p>}
                          {details.goals.length > 0 && (
                            <div className="space-y-3">
                              {details.goals.map((goal) => (
                                <div key={goal.goalId} className="bg-white rounded-lg p-3 border border-gray-100">
                                  <h4 className="text-xs font-semibold text-gray-800 flex items-center gap-1.5 mb-2">
                                    <Target className="h-3.5 w-3.5 text-blue-500" />
                                    {goal.goalTitle}
                                  </h4>
                                  <div className="space-y-1.5">
                                    {goal.steps.map((step, idx) => (
                                      <div key={step.stepId || idx} className="flex items-start gap-1.5 pl-1">
                                        <span className="text-xs text-gray-400 font-mono mt-0.5 w-3 flex-shrink-0">{step.stepOrder}.</span>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-xs text-gray-700">{step.stepDescription}</span>
                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium border ${getOutcomeColor(step.outcome)}`}>
                                              {getOutcomeLabel(step.outcome)}
                                            </span>
                                          </div>
                                          {step.notes && <p className="text-xs text-gray-500 mt-0.5 italic">"{step.notes}"</p>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {details.goals.length === 0 && !details.summary && (
                            <p className="text-xs text-gray-400 italic">No details recorded.</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                    );
                  })}
                  {pastAssessmentsVisible < pastAssessments.length && (
                    <button
                      onClick={() => setPastAssessmentsVisible(prev => prev + 3)}
                      className="w-full text-center py-2 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      Load more ({pastAssessments.length - pastAssessmentsVisible} remaining)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Guardian Notes Card - in left column for Super Scoopers */}
          {['Administrator', 'Shift Lead', 'Assistant Manager', 'Job Coach'].includes(user?.role || '') &&
           employee.role === 'Super Scooper' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
              <button
                onClick={() => setGuardianNotesExpanded(!guardianNotesExpanded)}
                className="flex items-center space-x-2 py-1 text-left hover:bg-gray-50 rounded-lg px-1 transition-colors"
              >
                {guardianNotesExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                <Heart className="h-5 w-5 text-rose-500" />
                <h2 className="text-lg font-semibold text-gray-900">Guardian Notes</h2>
                <span className="bg-rose-100 text-rose-800 px-2 py-1 rounded-full text-xs font-medium">
                  {guardianNotes.filter(n => n.scooperId === employeeId).length}
                </span>
              </button>
              {guardianNotesExpanded && (guardianNotes.filter(n => n.scooperId === employeeId).length > 0 ? (
                <div className="space-y-3 mt-4">
                  {guardianNotes.filter(n => n.scooperId === employeeId).map(note => {
                    const guardian = employees.find(e => e.id === note.guardianId);
                    return (
                      <div key={note.id} className="p-4 bg-rose-50 border border-rose-100 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-rose-900 text-sm">
                            {guardian ? `${guardian.first_name} ${guardian.last_name}` : 'Guardian'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(note.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                        <p className="text-gray-700 text-sm whitespace-pre-wrap">{note.note}</p>
                        <div className="mt-2 flex items-center space-x-1">
                          <Users className="h-3 w-3 text-rose-400" />
                          <span className="text-xs text-rose-600">Guardian</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Heart className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No guardian notes yet</p>
                </div>
              ))}
            </div>
          )}

          {/* Job Coach Notes Card - in left column for Super Scoopers */}
          {['Administrator', 'Shift Lead', 'Assistant Manager', 'Job Coach'].includes(user?.role || '') &&
           employee.role === 'Super Scooper' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
              <button
                onClick={() => setCoachNotesExpanded(!coachNotesExpanded)}
                className="flex items-center space-x-2 py-1 text-left hover:bg-gray-50 rounded-lg px-1 transition-colors"
              >
                {coachNotesExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                <FileText className="h-5 w-5 text-indigo-500" />
                <h2 className="text-lg font-semibold text-gray-900">Job Coach Notes</h2>
                <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full text-xs font-medium">
                  {coachNotes.length}
                </span>
              </button>
              {coachNotesExpanded && (loadingCoachNotes ? (
                <div className="flex items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
                </div>
              ) : coachNotes.length > 0 ? (
                <div className="space-y-3 mt-4">
                  {coachNotes.map(note => (
                      <div key={note.id} className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-indigo-900 text-sm">{note.title}</h3>
                          <span className="text-xs text-gray-500">
                            {new Date(note.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                        <p className="text-gray-700 text-sm whitespace-pre-wrap">{note.content}</p>
                        <div className="mt-2 flex items-center space-x-1">
                          <UserCheck className="h-3 w-3 text-indigo-400" />
                          <span className="text-xs text-indigo-600">
                            {note.coach_name || 'Job Coach'}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <FileText className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No coach notes yet</p>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Right Column - Goals */}
        {employee.role !== 'Job Coach' && (
        <div className={employee.role === 'Super Scooper' ? `${assessmentMode ? 'lg:col-span-1' : 'lg:col-span-2'} space-y-6` : 'contents'}>

          {/* Past Assessments - shown in right column during assessment mode for Super Scoopers */}
          {employee.role === 'Super Scooper' && assessmentMode && pastAssessments.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
              <button
                onClick={() => { setPastAssessmentsExpanded(!pastAssessmentsExpanded); setPastAssessmentsVisible(3); }}
                className="flex items-center space-x-2 py-1 text-left hover:bg-gray-50 rounded-lg px-1 transition-colors"
              >
                {pastAssessmentsExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                <FileText className="h-5 w-5 text-indigo-500" />
                <h2 className="text-lg font-semibold text-gray-900">Past Assessments</h2>
                <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full text-xs font-medium">
                  {pastAssessments.length}
                </span>
              </button>
              {pastAssessmentsExpanded && (
                <div className="mt-3 space-y-2">
                  {pastAssessments.slice(0, pastAssessmentsVisible).map((session) => {
                    const sessionDate = new Date(session.date + 'T00:00:00');
                    const sessionTime = session.created_at ? new Date(session.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
                    const details = sessionDetails[session.id];
                    const isExpanded = expandedSessionId === session.id;
                    return (
                    <div key={session.id} className={`border rounded-xl p-3 transition-colors ${isExpanded ? 'border-indigo-200 bg-indigo-50/30' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap text-sm text-gray-700 min-w-0">
                          <span className="font-medium">{sessionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          {sessionTime && <span className="text-gray-400 text-xs">{sessionTime}</span>}
                          <span className="text-gray-500 text-xs truncate">
                            {session.managerFirstName && session.managerLastName
                              ? `${session.managerFirstName} ${session.managerLastName}`
                              : ''}
                          </span>
                        </div>
                        <button
                          onClick={() => toggleSessionDetails(session.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex-shrink-0 ${isExpanded ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {isExpanded ? 'Hide' : 'View'}
                        </button>
                      </div>
                      {isExpanded && loadingSessionDetail && !details && (
                        <div className="mt-3 pt-3 border-t border-indigo-100 flex items-center justify-center py-4">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500" />
                        </div>
                      )}
                      {details && isExpanded ? (
                        <div className="mt-3 pt-3 border-t border-indigo-100">
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {details.goals.map((goal) => (
                              <span key={goal.goalId} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-blue-200 text-blue-700 bg-blue-50">
                                {goal.goalTitle}
                              </span>
                            ))}
                          </div>
                          {details.summary && <p className="text-sm text-gray-600 mb-3 bg-white rounded-lg p-2 border border-gray-100">{details.summary}</p>}
                          {details.goals.length > 0 && (
                            <div className="space-y-3">
                              {details.goals.map((goal) => (
                                <div key={goal.goalId} className="bg-white rounded-lg p-3 border border-gray-100">
                                  <h4 className="text-xs font-semibold text-gray-800 flex items-center gap-1.5 mb-2">
                                    <Target className="h-3.5 w-3.5 text-blue-500" />
                                    {goal.goalTitle}
                                  </h4>
                                  <div className="space-y-1.5">
                                    {goal.steps.map((step, idx) => (
                                      <div key={step.stepId || idx} className="flex items-start gap-1.5 pl-1">
                                        <span className="text-xs text-gray-400 font-mono mt-0.5 w-3 flex-shrink-0">{step.stepOrder}.</span>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-xs text-gray-700">{step.stepDescription}</span>
                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium border ${getOutcomeColor(step.outcome)}`}>
                                              {getOutcomeLabel(step.outcome)}
                                            </span>
                                          </div>
                                          {step.notes && <p className="text-xs text-gray-500 mt-0.5 italic">"{step.notes}"</p>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {details.goals.length === 0 && !details.summary && (
                            <p className="text-xs text-gray-400 italic">No details recorded.</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                    );
                  })}
                  {pastAssessmentsVisible < pastAssessments.length && (
                    <button
                      onClick={() => setPastAssessmentsVisible(prev => prev + 3)}
                      className="w-full text-center py-2 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      Load more ({pastAssessments.length - pastAssessmentsVisible} remaining)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Goal Assessment Section - for non-Super Scoopers in right column */}
          {employee.role !== 'Super Scooper' && canAssess && isAssessable && activeGoals.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
              {assessmentMode ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <ClipboardCheck className="h-5 w-5 text-green-600" />
                      <h2 className="text-lg font-semibold text-gray-900">Assessment in Progress</h2>
                    </div>
                    <button
                      onClick={handleEndAssessment}
                      className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-xl hover:bg-red-100 transition-colors text-sm font-medium"
                      title="End Assessment"
                    >
                      <X className="h-4 w-4" />
                      <span className="hidden sm:inline">End Assessment</span>
                    </button>
                  </div>
                  <div className="text-sm text-gray-500 mb-4 flex items-center gap-2">
                    <span>Location: {assessmentLocation}</span>
                  </div>
                  <EmployeeProgress
                    employee={employee}
                    assessmentSessionId={profileAssessmentSessionId || activeAssessmentSession?.id}
                  />
                </div>
              ) : (
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <ClipboardCheck className="h-5 w-5 text-blue-600" />
                    <h2 className="text-lg font-semibold text-gray-900">Goal Assessment</h2>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                      <select
                        value={assessmentLocation}
                        onChange={(e) => setAssessmentLocation(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      >
                        <option value="9540 Nall Avenue">9540 Nall Avenue</option>
                        <option value="4701 Indian Creek Parkway">4701 Indian Creek Parkway</option>
                        <option value="Remote">Remote</option>
                      </select>
                    </div>
                    <button
                      onClick={handleStartAssessment}
                      disabled={startingAssessment}
                      className="w-full flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      <ClipboardCheck className="h-5 w-5" />
                      <span className="hidden sm:inline">{startingAssessment ? 'Starting...' : 'Start Assessment'}</span>
                      <span className="sm:hidden">{startingAssessment ? '...' : 'Start'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Past Assessments card - for non-Super Scoopers */}
          {employee.role !== 'Super Scooper' && pastAssessments.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
              <button
                onClick={() => { setPastAssessmentsExpanded(!pastAssessmentsExpanded); setPastAssessmentsVisible(3); }}
                className="flex items-center space-x-2 py-1 text-left hover:bg-gray-50 rounded-lg px-1 transition-colors"
              >
                {pastAssessmentsExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                <FileText className="h-5 w-5 text-indigo-500" />
                <h2 className="text-lg font-semibold text-gray-900">Past Assessments</h2>
                <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full text-xs font-medium">
                  {pastAssessments.length}
                </span>
              </button>
              {pastAssessmentsExpanded && (
                <div className="mt-3 space-y-2">
                  {pastAssessments.slice(0, pastAssessmentsVisible).map((session) => {
                    const sessionDate = new Date(session.date + 'T00:00:00');
                    const sessionTime = session.created_at ? new Date(session.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
                    const details = sessionDetails[session.id];
                    const isExpanded = expandedSessionId === session.id;
                    return (
                    <div key={session.id} className={`border rounded-xl p-3 transition-colors ${isExpanded ? 'border-indigo-200 bg-indigo-50/30' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap text-sm text-gray-700 min-w-0">
                          <span className="font-medium">{sessionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          {sessionTime && <span className="text-gray-400 text-xs">{sessionTime}</span>}
                          <span className="text-gray-500 text-xs truncate">
                            {session.managerFirstName && session.managerLastName
                              ? `${session.managerFirstName} ${session.managerLastName}`
                              : ''}
                          </span>
                        </div>
                        <button
                          onClick={() => toggleSessionDetails(session.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex-shrink-0 ${isExpanded ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {isExpanded ? 'Hide' : 'View'}
                        </button>
                      </div>
                      {isExpanded && loadingSessionDetail && !details && (
                        <div className="mt-3 pt-3 border-t border-indigo-100 flex items-center justify-center py-4">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500" />
                        </div>
                      )}
                      {details && isExpanded ? (
                        <div className="mt-3 pt-3 border-t border-indigo-100">
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {details.goals.map((goal) => (
                              <span key={goal.goalId} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-blue-200 text-blue-700 bg-blue-50">
                                {goal.goalTitle}
                              </span>
                            ))}
                          </div>
                          {details.summary && <p className="text-sm text-gray-600 mb-3 bg-white rounded-lg p-2 border border-gray-100">{details.summary}</p>}
                          {details.goals.length > 0 && (
                            <div className="space-y-3">
                              {details.goals.map((goal) => (
                                <div key={goal.goalId} className="bg-white rounded-lg p-3 border border-gray-100">
                                  <h4 className="text-xs font-semibold text-gray-800 flex items-center gap-1.5 mb-2">
                                    <Target className="h-3.5 w-3.5 text-blue-500" />
                                    {goal.goalTitle}
                                  </h4>
                                  <div className="space-y-1.5">
                                    {goal.steps.map((step, idx) => (
                                      <div key={step.stepId || idx} className="flex items-start gap-1.5 pl-1">
                                        <span className="text-xs text-gray-400 font-mono mt-0.5 w-3 flex-shrink-0">{step.stepOrder}.</span>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-xs text-gray-700">{step.stepDescription}</span>
                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium border ${getOutcomeColor(step.outcome)}`}>
                                              {getOutcomeLabel(step.outcome)}
                                            </span>
                                          </div>
                                          {step.notes && <p className="text-xs text-gray-500 mt-0.5 italic">"{step.notes}"</p>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {details.goals.length === 0 && !details.summary && (
                            <p className="text-xs text-gray-400 italic">No details recorded.</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                    );
                  })}
                  {pastAssessmentsVisible < pastAssessments.length && (
                    <button
                      onClick={() => setPastAssessmentsVisible(prev => prev + 3)}
                      className="w-full text-center py-2 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      Load more ({pastAssessments.length - pastAssessmentsVisible} remaining)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Active Goals */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setActiveGoalsExpanded(!activeGoalsExpanded)}
                className="flex items-center space-x-2 py-1 text-left hover:bg-gray-50 rounded-lg px-1 transition-colors"
              >
                {activeGoalsExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                <Target className="h-5 w-5 text-blue-500" />
                <h2 className="text-lg font-semibold text-gray-900">Active Goals</h2>
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                  {activeGoals.length}/2
                </span>
              </button>
              {canEdit && activeGoals.length < 2 && (
                <button
                  onClick={() => setShowGoalAssignment(true)}
                  className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors text-sm font-medium"
                  title="Add Goal"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Add Goal</span>
                </button>
              )}
            </div>

            {activeGoalsExpanded && activeGoals.length > 0 ? (
              <div className="space-y-6 mt-4">
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
            ) : activeGoalsExpanded ? (
              <div className="text-center py-8 mt-4">
                <Target className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Goals</h3>
                <p className="text-gray-600">No development goals have been assigned yet</p>
              </div>
            ) : null}
          </div>

          {/* Maintenance Goals */}
          {maintenanceGoals.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
              <button
                onClick={() => setMaintenanceGoalsExpanded(!maintenanceGoalsExpanded)}
                className="flex items-center space-x-2 py-1 text-left hover:bg-gray-50 rounded-lg px-1 transition-colors"
              >
                {maintenanceGoalsExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                <CheckCircle className="h-5 w-5 text-green-500" />
                <h2 className="text-lg font-semibold text-gray-900">Maintenance Goals</h2>
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                  {maintenanceGoals.length}
                </span>
              </button>

              {maintenanceGoalsExpanded && (
              <div className="space-y-4 mt-4">
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
              )}
            </div>
          )}

          {/* Archived Goals */}
          {archivedGoals.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
              <button
                onClick={() => setArchivedGoalsExpanded(!archivedGoalsExpanded)}
                className="flex items-center space-x-2 py-1 text-left hover:bg-gray-50 rounded-lg px-1 transition-colors"
              >
                {archivedGoalsExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                <Clock className="h-5 w-5 text-gray-400" />
                <h2 className="text-lg font-semibold text-gray-900">Archived Goals</h2>
                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs font-medium">
                  {archivedGoals.length}
                </span>
              </button>

              {archivedGoalsExpanded && (
              <div className="space-y-4 mt-4">
                {archivedGoals.map(goal => (
                  <div key={goal.id} className="border border-gray-200 rounded-xl p-4">
                    <h3 className="font-semibold text-gray-900">{goal.title}</h3>
                    <p className="text-sm text-gray-600">
                      {goal.startDate} - {goal.targetEndDate}
                    </p>
                  </div>
                ))}
              </div>
              )}
            </div>
          )}

        </div>
        )}
      </>
      )}
      </div>
    </div>
  );
}