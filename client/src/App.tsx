import React, { useState, useEffect } from 'react';
import { User, Users, Calendar, Target, Settings, ChevronLeft, ChevronRight, Menu, X } from 'lucide-react';
import { Router, Route, Switch, useLocation, useRoute } from 'wouter';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { ToastProvider } from './components/ToastProvider';
import LoginForm from './components/LoginForm';
import Dashboard from './components/Dashboard';
import EmployeeManagement from './components/EmployeeManagement';
import GoalTemplates from './components/GoalTemplates';
import EmployeeDashboard from './components/EmployeeDashboard';
import BulkUpload from './components/BulkUpload';
import MyScoopers from './components/MyScoopers';
import MyShift from './components/MyShift';
import MyLovedOnes from './components/MyLovedOnes';
import AccountSetup from './components/AccountSetup';
import OnboardingVerify from './components/OnboardingVerify';
import Sidebar from './components/Sidebar';
import SessionWarning from './components/SessionWarning';
import PermissionsManager from './components/PermissionsManager';
import HelpGuide from './components/HelpGuide';

// Map route paths to section IDs for sidebar active state
const routeToSection: Record<string, string> = {
  '/': 'my-shift',
  '/my-shift': 'my-shift',
  '/dashboard': 'dashboard',
  '/employees': 'employees',
  '/goal-templates': 'goal-templates',
  '/bulk-upload': 'bulk-upload',
  '/permissions': 'permissions',
  '/employee-dashboard': 'employee-dashboard',
  '/my-profile': 'my-profile',
  '/my-scoopers': 'my-scoopers',
  '/help': 'help-guide',
  '/my-loved-ones': 'my-scooper',
};

const sectionToRoute: Record<string, string> = {
  'my-shift': '/my-shift',
  'dashboard': '/dashboard',
  'employees': '/employees',
  'goal-templates': '/goal-templates',
  'bulk-upload': '/bulk-upload',
  'permissions': '/permissions',
  'employee-dashboard': '/employee-dashboard',
  'my-profile': '/my-profile',
  'my-scoopers': '/my-scoopers',
  'help-guide': '/help',
  'my-scooper': '/my-loved-ones',
};

function getDefaultRoute(role?: string): string {
  const r = role?.toLowerCase();
  if (r === 'employee' || r === 'super scooper') return '/employee-dashboard';
  if (r === 'job coach') return '/my-scoopers';
  if (r === 'guardian') return '/my-loved-ones';
  return '/my-shift';
}

function AppContent() {
  const { user, isAuthenticated, showSessionWarning, timeUntilExpiry, extendSession, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [setupToken, setSetupToken] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('setup');
    if (token) {
      setSetupToken(token);
    }
  }, []);

  // Redirect to default route based on role when on root
  useEffect(() => {
    if (isAuthenticated && user?.role && (location === '/' || location === '')) {
      setLocation(getDefaultRoute(user.role));
    }
  }, [isAuthenticated, user?.role, location]);

  // Derive active section from current route
  const activeSection = routeToSection[location] || 'my-shift';

  // Navigation handler for sidebar
  const handleSetActiveSection = (section: string) => {
    const route = sectionToRoute[section];
    if (route) {
      setLocation(route);
    }
  };

  const getPageTitle = () => {
    switch (activeSection) {
      case 'my-shift':
        return { title: 'My Shift', description: 'Search and pin employees to work with today, then click into their profiles for assessments' };
      case 'dashboard':
        return { title: 'Dashboard', description: 'Overview of employee progress and goal documentation activity' };
      case 'employees':
        return { title: 'Employee Management', description: 'Manage employee profiles, goals, and support information' };
      case 'goal-templates':
        return { title: 'Goal Templates', description: 'Create and manage reusable goal templates for employee development' };
      case 'bulk-upload':
        return { title: 'Bulk Data Upload', description: 'Import assessment data, mastered goals, and goal templates from CSV files' };
      case 'permissions':
        return { title: 'Permission Settings', description: 'Configure role-based access permissions for all features' };
      case 'employee-dashboard':
        return { title: 'My Dashboard', description: 'Track your development goals and progress' };
      case 'my-profile':
        return { title: 'My Profile', description: 'View and manage your personal information' };
      case 'my-scoopers':
        return { title: 'My Scoopers', description: 'View your assigned super scoopers and their progress' };
      case 'help-guide':
        return { title: 'Help Guide', description: 'Learn how to use each feature based on your role' };
      case 'my-scooper':
        return { title: 'My Loved Ones', description: 'View your family member\'s profile and progress' };
      default:
        return user?.role === 'employee' 
          ? { title: 'My Dashboard', description: 'Track your development goals and progress' }
          : { title: 'My Shift', description: 'Search and pin employees to work with today, then click into their profiles for assessments' };
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

  // Compliance gate: Redirect Super Scoopers and Guardians who haven't completed ROI
  const requiresOnboarding = (user?.role === 'Super Scooper' || user?.role === 'Guardian') && !user?.roiStatus;
  if (requiresOnboarding) {
    return <OnboardingVerify />;
  }

  return (
    <div className="h-screen bg-gray-50 flex">
      <Sidebar 
        activeSection={activeSection}
        setActiveSection={handleSetActiveSection}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />
      
      <div className={`flex flex-col h-full flex-1 transition-all duration-300 ${
        !sidebarCollapsed ? 'md:ml-64 ml-0' : 'md:ml-16 ml-0'
      }`}>
        <header className="bg-white shadow-sm border-b px-3 sm:px-6 py-3 sm:py-4 relative z-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
              <button
                onClick={() => setSidebarCollapsed(false)}
                className={`p-2 rounded-md hover:bg-gray-100 transition-all duration-200 flex-shrink-0 md:hidden ${
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
          <Switch>
            <Route path="/my-shift" component={MyShift} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/employees" component={EmployeeManagement} />
            <Route path="/goal-templates">
              {user?.role === 'Administrator' ? <GoalTemplates /> : <Dashboard />}
            </Route>
            <Route path="/bulk-upload">
              {user?.role === 'Administrator' ? <BulkUpload /> : <Dashboard />}
            </Route>
            <Route path="/permissions">
              {user?.role === 'Administrator' ? <PermissionsManager /> : <Dashboard />}
            </Route>
            <Route path="/employee-dashboard" component={EmployeeDashboard} />
            <Route path="/my-profile" component={EmployeeDashboard} />
            <Route path="/my-scoopers" component={MyScoopers} />
            <Route path="/help" component={HelpGuide} />
            <Route path="/my-loved-ones" component={MyLovedOnes} />
            <Route>
              {/* Fallback — redirect to default based on role */}
              {(() => {
                const role = user?.role?.toLowerCase();
                if (role === 'employee' || role === 'super scooper') return <EmployeeDashboard />;
                if (role === 'job coach') return <MyScoopers />;
                if (role === 'guardian') return <MyLovedOnes />;
                return <MyShift />;
              })()}
            </Route>
          </Switch>
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
    <Router>
      <AuthProvider>
        <DataProvider>
          <ToastProvider>
            <AppContent />
          </ToastProvider>
        </DataProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
