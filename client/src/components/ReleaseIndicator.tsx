import { Megaphone, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useReleaseIndicator } from '../hooks/useReleaseIndicator';
import { useLocation } from 'wouter';

export default function ReleaseIndicator() {
  const { user } = useAuth();
  const { visible, dismiss } = useReleaseIndicator(user?.id);
  const [, setLocation] = useLocation();

  if (!visible) return null;

  const handleOpen = () => {
    sessionStorage.setItem('gs-focus-release', '1');
    setLocation('/help');
  };

  return (
    <div className="fixed bottom-5 right-4 z-50 flex items-center gap-2 bg-white border border-green-200 shadow-lg rounded-2xl px-4 py-2.5 animate-in slide-in-from-bottom-4 duration-300">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
      </span>
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 text-sm font-semibold text-green-700 hover:text-green-800 transition-colors"
      >
        <Megaphone className="h-4 w-4" />
        What's New
      </button>
      <button
        onClick={dismiss}
        className="ml-1 p-0.5 text-gray-400 hover:text-gray-600 transition-colors rounded-full"
        title="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
