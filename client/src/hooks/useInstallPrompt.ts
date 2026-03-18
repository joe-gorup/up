import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Capture the event at module-load time so we never miss it, regardless of
// when the consuming component mounts relative to the browser firing it.
let _capturedPrompt: BeforeInstallPromptEvent | null = null;
const _listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _capturedPrompt = e as BeforeInstallPromptEvent;
    _listeners.forEach((fn) => fn());
  });
}

interface InstallPromptResult {
  isIOS: boolean;
  isAndroid: boolean;
  isMobile: boolean;
  isStandalone: boolean;
  promptInstall: (() => Promise<void>) | null;
}

export function useInstallPrompt(): InstallPromptResult {
  const [, forceUpdate] = useState(0);

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);
  const isMobile = isIOS || isAndroid;

  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true);

  useEffect(() => {
    // If the event fires after mount, re-render the component so promptInstall becomes available.
    const notify = () => forceUpdate((n) => n + 1);
    _listeners.add(notify);
    return () => {
      _listeners.delete(notify);
    };
  }, []);

  const promptInstall = _capturedPrompt
    ? async () => {
        if (!_capturedPrompt) return;
        await _capturedPrompt.prompt();
        await _capturedPrompt.userChoice;
        _capturedPrompt = null;
        forceUpdate((n) => n + 1);
      }
    : null;

  return { isIOS, isAndroid, isMobile, isStandalone, promptInstall };
}
