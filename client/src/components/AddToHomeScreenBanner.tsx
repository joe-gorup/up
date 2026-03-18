import { useState } from 'react';
import { X, Share, Plus, Smartphone } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

const DISMISS_KEY = 'guardian-install-dismissed';

export default function AddToHomeScreenBanner() {
  const { user } = useAuth();
  const { isIOS, isAndroid, isMobile, isStandalone, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem(DISMISS_KEY) === 'true';
  });

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true');
    setDismissed(true);
  };

  const handleInstall = async () => {
    if (promptInstall) {
      await promptInstall();
    }
    handleDismiss();
  };

  if (
    user?.role !== 'Guardian' ||
    !isMobile ||
    isStandalone ||
    dismissed
  ) {
    return null;
  }

  if (isIOS) {
    return (
      <div className="mx-3 mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 rounded-full bg-rose-100 p-2">
            <Smartphone className="h-5 w-5 text-rose-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-rose-900 mb-1">
              Add to your Home Screen
            </p>
            <p className="text-xs text-rose-700 mb-3 leading-relaxed">
              Get quick access to Golden Scoop — no browser needed.
            </p>
            <ol className="space-y-1.5">
              <li className="flex items-center gap-2 text-xs text-rose-800">
                <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-rose-200 text-rose-700 font-bold text-[10px]">1</span>
                <span>
                  Tap the{' '}
                  <span className="inline-flex items-center gap-0.5 font-medium">
                    Share <Share className="h-3 w-3 inline" />
                  </span>{' '}
                  button in Safari
                </span>
              </li>
              <li className="flex items-center gap-2 text-xs text-rose-800">
                <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-rose-200 text-rose-700 font-bold text-[10px]">2</span>
                <span>
                  Scroll down and tap{' '}
                  <span className="inline-flex items-center gap-0.5 font-medium">
                    Add to Home Screen <Plus className="h-3 w-3 inline" />
                  </span>
                </span>
              </li>
              <li className="flex items-center gap-2 text-xs text-rose-800">
                <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-rose-200 text-rose-700 font-bold text-[10px]">3</span>
                <span>Tap <span className="font-medium">Add</span> to confirm</span>
              </li>
            </ol>
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss"
            className="flex-shrink-0 rounded-full p-1 text-rose-400 hover:bg-rose-100 hover:text-rose-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  if (isAndroid) {
    return (
      <div className="mx-3 mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 rounded-full bg-rose-100 p-2">
            <Smartphone className="h-5 w-5 text-rose-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-rose-900 mb-1">
              Add to your Home Screen
            </p>
            <p className="text-xs text-rose-700 mb-3 leading-relaxed">
              Get quick one-tap access to Golden Scoop from your home screen.
            </p>
            <div className="flex gap-2">
              {promptInstall ? (
                <button
                  onClick={handleInstall}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 active:bg-rose-800 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add to Home Screen
                </button>
              ) : (
                <p className="text-xs text-rose-700 italic">
                  Tap the menu (⋮) in your browser, then "Add to Home screen".
                </p>
              )}
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 text-xs text-rose-500 hover:text-rose-700 transition-colors"
              >
                Not now
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss"
            className="flex-shrink-0 rounded-full p-1 text-rose-400 hover:bg-rose-100 hover:text-rose-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
