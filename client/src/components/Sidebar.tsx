import React from 'react';
import { LayoutDashboard, Users, Calendar, Target, Settings, LogOut, Menu, X, PanelLeft, ClipboardList, FolderOpen, Upload, Link, Heart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export default function Sidebar({ activeSection, setActiveSection, collapsed, setCollapsed }: SidebarProps) {
  const { user, logout } = useAuth();

  const menuItems = [
    // Administrator menu items
    { id: 'active-shift', label: 'Goal Documentation', icon: ClipboardList, roles: ['administrator', 'shift manager', 'assistant manager'] },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['administrator', 'shift manager', 'assistant manager', 'job coach'] },
    { id: 'employees', label: 'Employee Management', icon: Users, roles: ['administrator'] },
    { id: 'goal-templates', label: 'Goal Templates', icon: FolderOpen, roles: ['administrator'] },
    { id: 'bulk-upload', label: 'Bulk Upload', icon: Upload, roles: ['administrator'] },
    { id: 'assignments', label: 'Assignments', icon: Link, roles: ['administrator'] },
    
    // Job Coach menu items
    { id: 'my-scoopers', label: 'My Scoopers', icon: Users, roles: ['job coach'] },

    // Guardian menu items
    { id: 'my-scooper', label: 'My Loved Ones', icon: Heart, roles: ['guardian'] },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['guardian'] },

    // Super Scooper menu items
    { id: 'employee-dashboard', label: 'My Dashboard', icon: LayoutDashboard, roles: ['employee', 'super scooper'] },
    { id: 'my-profile', label: 'My Profile', icon: Users, roles: ['employee', 'super scooper'] }
  ];

  const filteredMenuItems = menuItems.filter(item => {
    const userRole = user?.role?.toLowerCase() || 'shift manager';
    return item.roles.includes(userRole);
  });

  const handleItemClick = (itemId: string) => {
    setActiveSection(itemId);
    setCollapsed(true);
  };

  if (collapsed) {
    return null;
  }

  return (
    <>
      {/* Backdrop overlay for mobile */}
      <div 
        className="fixed inset-0 bg-black/50 z-20 md:hidden"
        onClick={() => setCollapsed(true)}
      />
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 bg-gray-900 z-30 flex flex-col shadow-xl">
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Golden Scoop</h2>
              <p className="text-sm text-gray-400 capitalize">{user?.role || 'Loading...'}</p>
            </div>
            <button
              onClick={() => setCollapsed(true)}
              className="p-2 rounded-md hover:bg-gray-800 transition-colors"
            >
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {filteredMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              
              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleItemClick(item.id)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm transition-all duration-200 ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-gray-700">
          <div className="mb-3">
            <p className="text-sm font-medium text-white">{user?.name}</p>
            <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-gray-300 hover:bg-red-900/20 hover:text-red-400 rounded-md transition-all duration-200"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </>
  );
}