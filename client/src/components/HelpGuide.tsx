import { useState } from 'react';
import { 
  HelpCircle, ChevronDown, ChevronUp, Shield, ClipboardList, LayoutDashboard, 
  Users, FolderOpen, Upload, Heart, CheckCircle, Award, UserCheck, Star, Info, Megaphone
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Section {
  title: string;
  icon: React.ElementType;
  role: string;
  content: GuideItem[];
}

interface GuideItem {
  page: string;
  icon: React.ElementType;
  description: string;
  steps: string[];
}

const GUIDE_SECTIONS: Section[] = [
  {
    title: 'Administrator',
    icon: Shield,
    role: 'Administrator',
    content: [
      {
        page: 'My Shift',
        icon: ClipboardList,
        description: 'Build a working list of employees for your current shift. Search, pin, and access employee profiles for assessments.',
        steps: [
          'Open "My Shift" from the sidebar.',
          'Use the search bar to find employees by name.',
          'Click the pin icon next to an employee to add them to your shift list.',
          'Pinned employees appear at the top for quick access throughout the day.',
          'Click on a pinned employee to open their full profile.',
          'From their profile, select a location and click "Start Assessment" to begin documenting goals.',
          'During an assessment, mark each step as correct or incorrect, then end the session when finished.',
          'Remove employees from your shift list by clicking the unpin icon.'
        ]
      },
      {
        page: 'Dashboard',
        icon: LayoutDashboard,
        description: 'View a high-level overview of your organization\'s progress including active employees, goal statistics, and recent activity.',
        steps: [
          'Open "Dashboard" from the sidebar.',
          'Review the summary cards at the top: total active employees, active goals, mastered goals, and goals near mastery.',
          'Scroll down to see recent assessment activity and progress trends.',
          'Use this page to quickly identify which employees may need attention.'
        ]
      },
      {
        page: 'Employee Management',
        icon: Users,
        description: 'Manage all employee profiles. Add, edit, and view employee records, assign roles, manage contacts, and track certifications.',
        steps: [
          'Open "Employee Management" from the sidebar.',
          'Use the search bar to find employees by name.',
          'Filter by status (Active / Inactive) or role to narrow results.',
          'Click "+ Add Employee" to create a new employee record — fill in their name, role, email, and optional details like date of birth, allergies, and emergency contacts.',
          'Click on any employee row to view their profile details (contacts, certifications, service provider info).',
          'Click the "Edit" button on a profile to update their information.',
          'Use the "Inactivate" option to deactivate an employee who is no longer active.',
          'For Super Scoopers, you can manage promotion certifications (Mentor, Shift Lead) from their profile.'
        ]
      },
      {
        page: 'Goal Templates',
        icon: FolderOpen,
        description: 'Create and manage reusable goal templates that can be assigned to employees. Templates define the steps and mastery criteria for development goals.',
        steps: [
          'Open "Goal Templates" from the sidebar.',
          'Click "+ New Template" to create a goal template.',
          'Give the template a name, description, category, and mastery criteria (number of consecutive correct trials needed).',
          'Add individual steps to the template — each step represents a discrete skill to be assessed.',
          'Use the search bar to find existing templates.',
          'Filter by status (Active / Archived) to manage your template library.',
          'Click the eye icon to preview a template, the edit icon to modify it, or the archive icon to retire it.',
          'Use the copy icon to duplicate a template as a starting point for a new one.'
        ]
      },
      {
        page: 'Bulk Upload',
        icon: Upload,
        description: 'Import large amounts of data at once using CSV files. Upload assessment records, mastered goals, or goal templates in bulk.',
        steps: [
          'Open "Bulk Upload" from the sidebar.',
          'Choose the upload type using the tabs: Assessments, Mastered Goals, or Goal Templates.',
          'Click "Download Template" to get a sample CSV file with the correct column headers.',
          'Fill in the CSV template with your data using a spreadsheet program.',
          'Drag and drop your CSV file into the upload area, or click to browse for the file.',
          'Preview the data to verify it looks correct before uploading.',
          'Click "Upload" to import the data. The system will show how many records were processed and flag any errors.'
        ]
      },
      {
        page: 'Permissions',
        icon: Shield,
        description: 'Configure what each role can view, edit, and delete across all features in the system. Administrators always have full access.',
        steps: [
          'Open "Permissions" from the sidebar.',
          'The permission grid shows features as rows and roles as columns.',
          'Each feature has three toggle buttons per role: View (eye icon), Edit (pencil icon), and Delete (trash icon).',
          'Click a toggle to enable or disable that permission. Blue means enabled, gray means disabled.',
          'Note: Edit and Delete require View to be enabled first.',
          'Use the search bar to filter features by name.',
          'Use the role dropdown to focus on permissions for a specific role.',
          'Hover over the info icon next to a feature name to see what it controls.',
          'Features marked "N/A" are not applicable to that role (e.g., "My Scoopers" only applies to Job Coaches).',
          'Click "Save Changes" to apply your updates, or "Discard" to undo unsaved changes.'
        ]
      }
    ]
  },
  {
    title: 'Shift Lead / Assistant Manager',
    icon: ClipboardList,
    role: 'Shift Lead',
    content: [
      {
        page: 'My Shift',
        icon: ClipboardList,
        description: 'Your primary workspace. Build a list of employees you\'re working with today, then access their profiles for goal assessments.',
        steps: [
          'Open "My Shift" from the sidebar — this is your default landing page.',
          'Use the search bar to find employees by name.',
          'Click the pin icon next to an employee to add them to your shift list for the day.',
          'Your pinned list is saved for the session so you can navigate away and come back.',
          'Click on a pinned employee to open their full profile.',
          'From a Super Scooper\'s profile, select a location and click "Start Assessment" to begin an assessment session.',
          'During an assessment, mark each goal step as correct or incorrect. The system tracks consecutive correct responses automatically.',
          'Click "End Assessment" when you\'re done. The progress is saved immediately.',
          'Review past assessments in the employee\'s profile to see their history.',
          'You can also view Guardian Notes and Coach Notes from the employee profile.',
          'Remove an employee from your shift by clicking the unpin icon.'
        ]
      },
      {
        page: 'Dashboard',
        icon: LayoutDashboard,
        description: 'Get a quick overview of team progress including active goals, mastered goals, and recent assessment activity.',
        steps: [
          'Open "Dashboard" from the sidebar.',
          'Review summary statistics: active employees, total active goals, mastered goals, and goals near mastery.',
          'Scroll down to see recent activity and identify employees who may need additional support.',
          'Use this as a quick check-in tool before or after your shift.'
        ]
      }
    ]
  },
  {
    title: 'Job Coach',
    icon: UserCheck,
    role: 'Job Coach',
    content: [
      {
        page: 'My Scoopers',
        icon: Users,
        description: 'View all Super Scoopers assigned to you. See their goal progress at a glance and access their profiles for detailed information.',
        steps: [
          'Open "My Scoopers" from the sidebar — this is your default landing page.',
          'Your assigned Super Scoopers are listed with their goal progress statistics (active goals, mastered goals, progress percentages).',
          'Click on any Super Scooper to open their full profile.',
          'From their profile, you can view their active goals, progress history, and mastery status.',
          'Review Guardian Notes left by family members for additional context.',
          'Use the "Check-in" button to record notes about a session or interaction with a Super Scooper.',
          'You can also upload files (documents, images) related to a Super Scooper from their profile.',
          'View past assessments to understand how they\'ve been progressing over time.'
        ]
      },
      {
        page: 'Dashboard',
        icon: LayoutDashboard,
        description: 'View an overview of your assigned Super Scoopers\' collective progress.',
        steps: [
          'Open "Dashboard" from the sidebar.',
          'See summary cards showing overall statistics for your assigned scoopers.',
          'Use this for a quick snapshot of how your team is performing.'
        ]
      }
    ]
  },
  {
    title: 'Guardian',
    icon: Heart,
    role: 'Guardian',
    content: [
      {
        page: 'My Loved Ones',
        icon: Heart,
        description: 'View your family member\'s profile, track their development progress, and leave notes for the support team.',
        steps: [
          'Open "My Loved Ones" from the sidebar — this is your default landing page.',
          'Your linked family members (Super Scoopers) are displayed with their current goal progress.',
          'Click on a family member to view their detailed profile.',
          'From their profile, you can see their active development goals, progress toward mastery, and assessment history.',
          'Click the notes icon to leave a Guardian Note — share observations, updates, or anything the team should know.',
          'Your notes are visible to Shift Leads, Administrators, and Job Coaches to help coordinate care.',
          'If you have multiple family members in the program, they will all appear on your page.'
        ]
      }
    ]
  },
  {
    title: 'Super Scooper',
    icon: Award,
    role: 'Super Scooper',
    content: [
      {
        page: 'My Dashboard',
        icon: LayoutDashboard,
        description: 'View your personal development dashboard showing your current goals, progress, and achievements.',
        steps: [
          'Open "My Dashboard" from the sidebar — this is your default landing page.',
          'See your active development goals and current progress toward mastery.',
          'Each goal shows the steps you\'re working on and how many consecutive correct responses you\'ve achieved.',
          'Mastered goals are highlighted to celebrate your achievements.',
          'Your dashboard updates automatically as assessments are completed by your team.'
        ]
      },
      {
        page: 'My Profile',
        icon: Users,
        description: 'View your personal information and profile details.',
        steps: [
          'Open "My Profile" from the sidebar.',
          'View your personal information including your name, role, and contact details.',
          'If any information needs to be updated, ask your Shift Lead or Administrator for help.'
        ]
      }
    ]
  }
];

const RELEASE_NOTES: { date: string; groups: { area: string; notes: string[] }[] }[] = [
  {
    date: 'March 6, 2026',
    groups: [
      {
        area: 'Assessments',
        notes: [
          'Goal cards now display the last 5 assessment outcomes as colored circles — green for all correct, yellow for verbal prompts, red for incorrect, and gray for N/A. Hover over any circle to see the date of that session.',
          'Past assessments now open in a detailed popup when clicked, showing all goals assessed in that session.',
          'After completing an assessment, the app now automatically exits assessment mode and returns you to the employee profile.',
          'Goal mastery streaks (consecutive correct count) now update correctly after each submitted assessment.',
          'Timer data recorded during an in-progress assessment is now saved correctly if you navigate away and return.',
        ]
      },
      {
        area: 'Employee Profiles',
        notes: [
          'Employee date of birth now saves and displays correctly.',
          'Profile photos can now be uploaded directly from the employee edit form.',
          'Fixed an error that could occur when viewing or editing employee contacts.',
          'You can now review the full details of a saved promotion certification (Mentor or Shift Lead) by clicking the eye icon next to it.',
        ]
      },
      {
        area: 'Help Guide',
        notes: [
          'Added a "How It Works" section explaining goal mastery logic and the assessment history circles.',
          'Added this Release Notes section, grouped by area of the app.',
        ]
      }
    ]
  }
];

const AREA_COLORS: Record<string, string> = {
  'Assessments': 'bg-blue-50 text-blue-700 border-blue-200',
  'Employee Profiles': 'bg-amber-50 text-amber-700 border-amber-200',
  'Help Guide': 'bg-purple-50 text-purple-700 border-purple-200',
};

function ReleaseNotesSection() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-green-200 ring-1 ring-green-100">
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 rounded-xl transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-100">
            <Megaphone className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Release Notes</h2>
            <span className="text-xs text-green-600 font-medium">What's new and improved</span>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {RELEASE_NOTES.map((release, idx) => (
            <div key={idx} className="border border-gray-100 rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{release.date}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {release.groups.map((group, gIdx) => (
                  <div key={gIdx} className="px-4 py-3">
                    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded border mb-2 ${AREA_COLORS[group.area] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      {group.area}
                    </span>
                    <ul className="space-y-2">
                      {group.notes.map((note, noteIdx) => (
                        <li key={noteIdx} className="flex items-start gap-2.5 text-sm text-gray-700">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HowItWorksSection() {
  const [expanded, setExpanded] = useState(false);

  const features = [
    {
      title: 'Goal Mastery',
      icon: Star,
      color: 'amber',
      content: (
        <div className="space-y-4 text-sm text-gray-700">
          <p>
            An employee masters a goal after <strong>3 successful assessments in a row</strong> — meaning all required steps were marked <span className="font-medium text-green-700">Correct</span> in each of those sessions.
          </p>

          <div className="space-y-2">
            <p className="font-medium text-gray-800">What counts toward mastery:</p>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span><strong>Increments the count (+1):</strong> Every required step in the session was marked Correct.</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
              <span><strong>Resets to zero:</strong> Any required step was marked Incorrect or required a Verbal Prompt.</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <span><strong>Pauses (no change):</strong> A required step was marked N/A — the count stays exactly where it is until the next session.</span>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5">
            <p className="font-medium text-amber-900 text-xs uppercase tracking-wide mb-2">Example</p>
            {[
              { session: 'Session 1', result: 'All required steps Correct', count: '1', outcome: 'green' },
              { session: 'Session 2', result: 'All required steps Correct', count: '2', outcome: 'green' },
              { session: 'Session 3', result: 'A required step marked N/A', count: '2 (no change)', outcome: 'gray' },
              { session: 'Session 4', result: 'All required steps Correct', count: '3 — Mastery achieved!', outcome: 'amber' },
            ].map((row, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="text-gray-500 w-20 flex-shrink-0">{row.session}</span>
                <span className="text-gray-700 flex-1">{row.result}</span>
                <span className={`font-semibold flex-shrink-0 ${row.outcome === 'green' ? 'text-green-700' : row.outcome === 'amber' ? 'text-amber-700' : 'text-gray-500'}`}>
                  {row.count}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2 text-gray-500 text-xs bg-gray-50 rounded-lg p-3">
            <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span>Optional steps are never counted toward mastery — only steps marked as required on the goal template matter.</span>
          </div>
        </div>
      )
    },
    {
      title: 'Recent Assessments (Goal Cards)',
      icon: ClipboardList,
      color: 'blue',
      content: (
        <div className="space-y-3 text-sm text-gray-700">
          <p>
            Each goal card on an employee's profile shows a row of <strong>5 circles</strong> representing the last 5 completed assessments for that goal — oldest on the left, most recent on the right.
          </p>
          <div className="space-y-2">
            {[
              { color: 'bg-green-500', label: 'Green', meaning: 'All required steps were Correct' },
              { color: 'bg-yellow-400', label: 'Yellow', meaning: 'At least one Verbal Prompt (no Incorrect)' },
              { color: 'bg-red-500', label: 'Red', meaning: 'At least one step was Incorrect' },
              { color: 'bg-gray-300', label: 'Gray', meaning: 'All steps were marked N/A' },
              { color: 'bg-white border-2 border-dashed border-gray-300', label: 'Empty', meaning: 'No assessment recorded yet for this slot' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full flex-shrink-0 ${item.color}`} />
                <span><strong>{item.label}:</strong> {item.meaning}</span>
              </div>
            ))}
          </div>
          <div className="flex items-start gap-2 text-gray-500 text-xs bg-gray-50 rounded-lg p-3">
            <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span>Hover over any circle to see the date of that assessment. These circles are for reference only and do not affect the mastery count.</span>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-purple-200 ring-1 ring-purple-100">
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 rounded-xl transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-100">
            <Info className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">How It Works</h2>
            <span className="text-xs text-purple-600 font-medium">Feature explanations</span>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-3">
          {features.map((feature, idx) => {
            const FeatureIcon = feature.icon;
            return (
              <div key={idx} className="border border-gray-100 rounded-lg overflow-hidden">
                <div className="flex items-center gap-2.5 px-4 py-3 bg-gray-50">
                  <FeatureIcon className="h-4 w-4 text-purple-600 flex-shrink-0" />
                  <span className="font-medium text-gray-800 text-sm">{feature.title}</span>
                </div>
                <div className="px-4 py-3">
                  {feature.content}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function HelpGuide() {
  const { user } = useAuth();
  const [expandedRole, setExpandedRole] = useState<string | null>(user?.role || null);
  const [expandedPages, setExpandedPages] = useState<Record<string, boolean>>({});

  const toggleRole = (role: string) => {
    setExpandedRole(prev => prev === role ? null : role);
  };

  const togglePage = (key: string) => {
    setExpandedPages(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const currentRole = user?.role || '';
  const sortedSections = [...GUIDE_SECTIONS].sort((a, b) => {
    if (a.role.toLowerCase() === currentRole.toLowerCase()) return -1;
    if (b.role.toLowerCase() === currentRole.toLowerCase()) return 1;
    return 0;
  });

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <HelpCircle className="h-5 w-5 text-amber-500" />
          <span className="text-sm text-amber-600 font-medium">Your role: {currentRole}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span>This guide is organized into:</span>
          <span className="inline-flex items-center gap-1 bg-green-50 border border-green-200 text-green-700 font-medium px-2 py-0.5 rounded-full">
            <Megaphone className="h-3 w-3" /> Release Notes
          </span>
          <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 font-medium px-2 py-0.5 rounded-full">
            <HelpCircle className="h-3 w-3" /> How To
          </span>
          <span className="inline-flex items-center gap-1 bg-purple-50 border border-purple-200 text-purple-700 font-medium px-2 py-0.5 rounded-full">
            <Info className="h-3 w-3" /> How It Works
          </span>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-1.5 text-green-700">
            <Megaphone className="h-4 w-4" />
            <span className="text-sm font-semibold">Release Notes</span>
          </div>
          <div className="flex-1 border-t border-green-200" />
        </div>
        <ReleaseNotesSection />
      </div>

      <div className="mb-2">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-1.5 text-amber-700">
            <HelpCircle className="h-4 w-4" />
            <span className="text-sm font-semibold">How To</span>
          </div>
          <div className="flex-1 border-t border-amber-200" />
        </div>
      </div>

      <div className="space-y-4">
        {sortedSections.map(section => {
          const SectionIcon = section.icon;
          const isExpanded = expandedRole === section.role;
          const isCurrentRole = section.role.toLowerCase() === currentRole.toLowerCase() || 
            (section.role === 'Shift Lead' && currentRole.toLowerCase() === 'assistant manager');

          return (
            <div key={section.role} className={`bg-white rounded-xl shadow-sm border ${isCurrentRole ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-200'}`}>
              <button
                onClick={() => toggleRole(section.role)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isCurrentRole ? 'bg-amber-100' : 'bg-gray-100'}`}>
                    <SectionIcon className={`h-5 w-5 ${isCurrentRole ? 'text-amber-600' : 'text-gray-600'}`} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
                    {isCurrentRole && (
                      <span className="text-xs text-amber-600 font-medium">This is your role</span>
                    )}
                  </div>
                </div>
                {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
              </button>

              {isExpanded && (
                <div className="px-5 pb-5 space-y-3">
                  {section.content.map((item, idx) => {
                    const PageIcon = item.icon;
                    const pageKey = `${section.role}-${idx}`;
                    const isPageExpanded = expandedPages[pageKey] !== false;

                    return (
                      <div key={idx} className="border border-gray-100 rounded-lg overflow-hidden">
                        <button
                          onClick={() => togglePage(pageKey)}
                          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2.5">
                            <PageIcon className="h-4 w-4 text-blue-600 flex-shrink-0" />
                            <span className="font-medium text-gray-800 text-sm">{item.page}</span>
                          </div>
                          {isPageExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                        </button>

                        {isPageExpanded && (
                          <div className="px-4 py-3">
                            <p className="text-sm text-gray-600 mb-3">{item.description}</p>
                            <div className="space-y-2">
                              {item.steps.map((step, stepIdx) => (
                                <div key={stepIdx} className="flex gap-2.5 text-sm">
                                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-medium mt-0.5">
                                    {stepIdx + 1}
                                  </span>
                                  <span className="text-gray-700 leading-relaxed">{step}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-1.5 text-purple-700">
            <Info className="h-4 w-4" />
            <span className="text-sm font-semibold">How It Works</span>
          </div>
          <div className="flex-1 border-t border-purple-200" />
        </div>
        <HowItWorksSection />
      </div>

      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <h3 className="font-semibold text-blue-900 text-sm mb-2">Common Tips</h3>
        <ul className="space-y-1.5 text-sm text-blue-800">
          <li className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <span>Use the hamburger menu icon at the top-left corner to open the sidebar navigation on any page.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <span>Click the back arrow on any profile page to return to the previous list.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <span>Your session will time out after a period of inactivity. You'll see a warning before being signed out.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <span>Assessments are locked while in progress — only one person can assess an employee at a time.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <span>If you need account help, contact your Administrator.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}