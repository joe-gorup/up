import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  userType: 'user' | 'employee';
}

interface SessionData {
  user: User;
  token: string;
  loginTime: number;
  lastActivity: number;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshSession: () => void;
  showSessionWarning: boolean;
  timeUntilExpiry: number;
  extendSession: () => void;
}

// Session configuration - industry standards for shift management
const SESSION_CONFIG = {
  IDLE_TIMEOUT: 30 * 60 * 1000, // 30 minutes in milliseconds
  ABSOLUTE_TIMEOUT: 8 * 60 * 60 * 1000, // 8 hours in milliseconds
  RENEWAL_INTERVAL: 60 * 60 * 1000, // 1 hour in milliseconds
  WARNING_TIME: 5 * 60 * 1000, // 5 minutes warning before timeout
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const [timeUntilExpiry, setTimeUntilExpiry] = useState(0);

  // Session management functions
  const saveSession = (userData: User, token: string) => {
    const sessionData: SessionData = {
      user: userData,
      token,
      loginTime: Date.now(),
      lastActivity: Date.now(),
    };
    localStorage.setItem('golden-scoop-session', JSON.stringify(sessionData));
  };

  const getSession = (): SessionData | null => {
    try {
      const sessionStr = localStorage.getItem('golden-scoop-session');
      if (!sessionStr) return null;
      return JSON.parse(sessionStr);
    } catch (error) {
      console.error('Error parsing session data:', error);
      return null;
    }
  };

  const clearSession = () => {
    localStorage.removeItem('golden-scoop-session');
  };

  const updateActivity = useCallback(() => {
    const session = getSession();
    if (session) {
      session.lastActivity = Date.now();
      localStorage.setItem('golden-scoop-session', JSON.stringify(session));
    }
  }, []);

  const validateSession = useCallback((): boolean => {
    const session = getSession();
    if (!session) return false;

    const now = Date.now();
    const timeSinceLogin = now - session.loginTime;
    const timeSinceActivity = now - session.lastActivity;

    // Check absolute timeout (8 hours)
    if (timeSinceLogin > SESSION_CONFIG.ABSOLUTE_TIMEOUT) {
      console.log('Session expired: absolute timeout reached');
      return false;
    }

    // Check idle timeout (30 minutes)
    if (timeSinceActivity > SESSION_CONFIG.IDLE_TIMEOUT) {
      console.log('Session expired: idle timeout reached');
      return false;
    }

    return true;
  }, []);

  const refreshSession = useCallback(() => {
    if (validateSession()) {
      updateActivity();
    } else {
      logout();
    }
  }, [validateSession, updateActivity]);

  const extendSession = useCallback(() => {
    updateActivity();
    setShowSessionWarning(false);
  }, [updateActivity]);

  const checkForSessionWarning = useCallback(() => {
    const session = getSession();
    if (!session) return;

    const now = Date.now();
    const timeSinceActivity = now - session.lastActivity;
    const timeUntilIdleExpiry = SESSION_CONFIG.IDLE_TIMEOUT - timeSinceActivity;
    
    // Show warning if less than 5 minutes until idle timeout
    if (timeUntilIdleExpiry <= SESSION_CONFIG.WARNING_TIME && timeUntilIdleExpiry > 0) {
      setShowSessionWarning(true);
      setTimeUntilExpiry(Math.floor(timeUntilIdleExpiry / 1000));
    } else {
      setShowSessionWarning(false);
    }
  }, []);

  // Initialize session on app startup
  useEffect(() => {
    const initializeSession = async () => {
      const session = getSession();
      
      if (session && validateSession()) {
        setUser(session.user);
        setIsAuthenticated(true);
        updateActivity();
      } else {
        clearSession();
      }
      
      setLoading(false);
    };

    initializeSession();
  }, [validateSession, updateActivity]);

  // Track user activity and refresh session periodically
  useEffect(() => {
    if (!isAuthenticated) return;

    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      updateActivity();
    };

    // Add activity listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Set up session validation interval (every 5 minutes)
    const validationInterval = setInterval(() => {
      refreshSession();
      checkForSessionWarning();
    }, 5 * 60 * 1000);

    // Check for session warnings more frequently (every 30 seconds)
    const warningInterval = setInterval(() => {
      checkForSessionWarning();
    }, 30 * 1000);

    return () => {
      // Cleanup listeners and intervals
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      clearInterval(validationInterval);
      clearInterval(warningInterval);
    };
  }, [isAuthenticated, updateActivity, refreshSession, checkForSessionWarning]);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      // Unified login endpoint now uses employees table for all authentication
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.user && data.token) {
          const userData: User = {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name || `${data.user.first_name || ''} ${data.user.last_name || ''}`.trim(),
            role: data.user.role,
            isActive: data.user.is_active,
            userType: 'employee'
          };
          
          setUser(userData);
          setIsAuthenticated(true);
          saveSession(userData, data.token);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      setUser(null);
      setIsAuthenticated(false);
      clearSession();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      login, 
      logout, 
      refreshSession,
      showSessionWarning,
      timeUntilExpiry,
      extendSession
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}