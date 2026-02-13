import React, { useState, useEffect } from 'react';
import { User, Users, Calendar, Target, Settings, ChevronLeft, ChevronRight, Menu, X } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { ToastProvider } from './components/ToastProvider';
import LoginForm from './components/LoginForm';
import Dashboard from './components/Dashboard';
import EmployeeManagement from './components/EmployeeManagement';
import GoalDocumentation from './components/GoalDocumentation';
import GoalTemplates from './components/GoalTemplates';
import EmployeeDashboard from './components/EmployeeDashboard';
import BulkUpload from './components/BulkUpload';
import AssignmentsManagement from './components/AssignmentsManagement';
import MyScoopers from './components/MyScoopers';
import MyLovedOnes from './components/MyLovedOnes';
import AccountSetup from './components/AccountSetup';
import OnboardingVerify from './components/OnboardingVerify';
import Sidebar from './components/Sidebar';
import SessionWarning from './components/SessionWarning';

function AppContent() {
  const { user, isAuthenticated, showSessionWarning, timeUntilExpiry, extendSession, logout } = useAuth();
  const [activeSection, setActiveSection] = useState('');
  const [setupToken, setSetupToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('setup');
    if (token) {
      setSetupToken(token);
    }
  }, []);

  // Set default active section based on user role
  useEffect(() => {
    // Check if there's a saved section from before a page reload
    const savedSection = localStorage.getItem('currentSection');
    const savedUser = localStorage.getItem('currentUser');
    const currentUserId = user?.id || '';
    if (savedSection && savedUser === currentUserId) {
      setActiveSection(savedSection);
    } else if (user?.role === 'employee' || user?.role === 'Super Scooper') {
      setActiveSection('employee-dashboard');
    } else if (user?.role === 'Job Coach') {
      setActiveSection('my-scoopers');
    } else if (user?.role === 'Guardian') {
      setActiveSection('my-scooper');
    } else {
      setActiveSection('active-shift');
    }
  }, [user?.role]);

  // Save current section to localStorage whenever it changes
  useEffect(() => {
    if (activeSection && user?.id) {
      localStorage.setItem('currentSection', activeSection);
      localStorage.setItem('currentUser', user.id);
    }
  }, [activeSection, user?.id]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  const getPageTitle = () => {
    switch (activeSection) {
      case 'active-shift':
        return { title: 'Goal Documentation', description: 'Conduct comprehensive goal assessments with step-by-step evaluation, performance summaries, and integrated draft/submit workflow' };
      case 'dashboard':
        return { title: 'Dashboard', description: 'Overview of employee progress and goal documentation activity' };
      case 'employees':
        return { title: 'Employee Management', description: 'Manage employee profiles, goals, and support information' };
      case 'goal-templates':
        return { title: 'Goal Templates', description: 'Create and manage reusable goal templates for employee development' };
      case 'bulk-upload':
        return { title: 'Bulk Data Upload', description: 'Import assessment data, mastered goals, and goal templates from CSV files' };
      case 'assignments':
        return { title: 'Assignments & Relationships', description: 'Manage coach assignments and guardian relationships' };
      case 'employee-dashboard':
        return { title: 'My Dashboard', description: 'Track your development goals and progress' };
      case 'my-profile':
        return { title: 'My Profile', description: 'View and manage your personal information' };
      case 'my-scoopers':
        return { title: 'My Scoopers', description: 'View your assigned super scoopers and their progress' };
      case 'my-scooper':
        return { title: 'My Loved Ones', description: 'View your family member\'s profile and progress' };
      default:
        return user?.role === 'employee' 
          ? { title: 'My Dashboard', description: 'Track your development goals and progress' }
          : { title: 'Goal Documentation', description: 'Conduct comprehensive goal assessments with step-by-step evaluation, performance summaries, and integrated draft/submit workflow' };
    }
  };

  const pageInfo = getPageTitle();

  if (setupToken) {
    return (
      <AccountSetup
        token={setupToken}
        onComplete={() => {
          setSetupToken(null);
          window.history.replaceState({}, '', window.location.pathname);
        }}
      />
    );
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  // Compliance gate: Redirect Super Scoopers, Guardians, and Job Coaches who haven't completed ROI
  const requiresOnboarding = (user?.role === 'Super Scooper' || user?.role === 'Guardian' || user?.role === 'Job Coach') && !user?.roiStatus;
  if (requiresOnboarding) {
    return <OnboardingVerify />;
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'active-shift':
        return <GoalDocumentation onNavigateToEmployee={() => setActiveSection('employees')} />;
      case 'dashboard':
        return <Dashboard />;
      case 'employees':
        return <EmployeeManagement />;
      case 'goal-templates':
        return user?.role === 'Administrator' ? <GoalTemplates /> : <Dashboard />;
      case 'bulk-upload':
        return user?.role === 'Administrator' ? <BulkUpload /> : <Dashboard />;
      case 'assignments':
        return user?.role === 'Administrator' ? <AssignmentsManagement /> : <Dashboard />;
      case 'employee-dashboard':
        return <EmployeeDashboard />;
      case 'my-profile':
        return <EmployeeDashboard />;
      case 'my-scoopers':
        return <MyScoopers />;
      case 'my-scooper':
        return <MyLovedOnes />;
      default:
        const role = user?.role?.toLowerCase();
        if (role === 'employee' || role === 'super scooper') return <EmployeeDashboard />;
        if (role === 'job coach') return <Dashboard />;
        if (role === 'guardian') return <MyLovedOnes />;
        return <GoalDocumentation />;
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex">
      <Sidebar 
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />
      
      <div className={`flex flex-col h-full flex-1 transition-all duration-300 ${
        !sidebarCollapsed ? 'md:ml-64 ml-0' : 'ml-0'
      }`}>
        <header className="bg-white shadow-sm border-b px-3 sm:px-6 py-3 sm:py-4 relative z-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
              <button
                onClick={() => setSidebarCollapsed(false)}
                className={`p-2 rounded-md hover:bg-gray-100 transition-all duration-200 flex-shrink-0 ${
                  !sidebarCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
                }`}
              >
                <Menu className="h-5 w-5 text-gray-600" />
              </button>
              
              <div className="text-left min-w-0">
                <h1 className="text-base sm:text-xl font-semibold text-gray-900 truncate">{pageInfo.title}</h1>
                <p className="text-xs sm:text-sm text-gray-600 truncate hidden sm:block">{pageInfo.description}</p>
              </div>
            </div>
            
            <div></div>
          </div>
        </header>
        
        <main className="flex-1 overflow-auto">
          {renderContent()}
        </main>
      </div>

      <SessionWarning
        show={showSessionWarning}
        timeRemaining={timeUntilExpiry}
        onExtend={extendSession}
        onLogout={logout}
      />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </DataProvider>
    </AuthProvider>
  );
}

export default App;