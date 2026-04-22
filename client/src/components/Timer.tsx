import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, AlertTriangle, Check, X } from 'lucide-react';

interface TimerProps {
  onTimeChange: (timeInSeconds: number, manuallyEntered: boolean) => void;
  initialTime?: number;
  isManuallyEntered?: boolean;
  disabled?: boolean;
  className?: string;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function Timer({
  onTimeChange,
  initialTime = 0,
  isManuallyEntered = false,
  disabled = false,
  className = '',
}: TimerProps) {
  const [timeSeconds, setTimeSeconds] = useState(initialTime);
  const [isRunning, setIsRunning] = useState(false);
  const [manualEntry, setManualEntry] = useState(isManuallyEntered);
  const [confirmReset, setConfirmReset] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [editMinutes, setEditMinutes] = useState('0');
  const [editSeconds, setEditSeconds] = useState('0');

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRunning && !disabled) {
      intervalRef.current = setInterval(() => {
        setTimeSeconds((prev) => {
          const next = prev + 1;
          onTimeChange(next, false);
          return next;
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, disabled, onTimeChange]);

  const handleToggle = () => {
    if (disabled) return;
    if (!isRunning) {
      setManualEntry(false);
      setIsRunning(true);
    } else {
      setIsRunning(false);
    }
  };

  const handleResetConfirmed = () => {
    setIsRunning(false);
    setTimeSeconds(0);
    setManualEntry(false);
    setConfirmReset(false);
    onTimeChange(0, false);
  };

  const openManualEditor = () => {
    if (disabled) return;
    setEditMinutes(Math.floor(timeSeconds / 60).toString());
    setEditSeconds((timeSeconds % 60).toString());
    setConfirmReset(false);
    setShowManual(true);
  };

  const saveManualEntry = () => {
    const mins = parseInt(editMinutes, 10) || 0;
    const secs = parseInt(editSeconds, 10) || 0;
    const total = mins * 60 + Math.min(secs, 59);
    setTimeSeconds(total);
    setManualEntry(true);
    setIsRunning(false);
    setShowManual(false);
    onTimeChange(total, true);
  };

  if (disabled) {
    return (
      <div className={`rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3 ${className}`}>
        <div className="text-sm text-gray-500">Timer disabled</div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl bg-white border border-stone-200 shadow-sm overflow-hidden ${className}`}
      data-testid="timer-card"
    >
      <div className="px-4 pt-3 pb-1">
        {isRunning && (
          <div className="flex justify-end">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Running
            </span>
          </div>
        )}
        <div className="mt-1 flex items-baseline justify-center gap-2">
          <div
            className="text-4xl sm:text-5xl font-mono font-semibold tabular-nums text-stone-900 leading-none"
            data-testid="text-timer-display"
          >
            {formatTime(timeSeconds)}
          </div>
          {manualEntry && (
            <span className="text-[9px] font-semibold uppercase tracking-wider text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
              Manual
            </span>
          )}
        </div>
      </div>

      <div className="px-4 pt-3 pb-4">
        <div className="grid grid-cols-10 gap-2">
          <button
            type="button"
            onClick={handleToggle}
            data-testid={isRunning ? 'button-stop-timer' : 'button-start-timer'}
            className={`col-span-6 h-8 sm:h-10 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 text-white shadow-sm transition-colors ${
              isRunning
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {isRunning ? (
              <Pause className="h-3 w-3 sm:h-4 sm:w-4 fill-current" />
            ) : (
              <Play className="h-3 w-3 sm:h-4 sm:w-4 fill-current" />
            )}
            {isRunning ? 'Stop' : 'Start'}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowManual(false);
              setConfirmReset(true);
            }}
            disabled={timeSeconds === 0}
            data-testid="button-reset-timer"
            className="col-span-4 h-8 sm:h-10 rounded-xl border border-stone-300 bg-white text-stone-700 text-xs font-medium flex items-center justify-center gap-1 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset</span>
          </button>
        </div>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={openManualEditor}
            data-testid="button-edit-time"
            className="text-sm text-stone-500 underline underline-offset-4 hover:text-stone-700"
          >
            Enter time manually
          </button>
        </div>
      </div>

      {confirmReset && (
        <div className="border-t border-stone-200 bg-rose-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-rose-900">Reset to 00:00?</div>
              <div className="mt-1 text-xs text-rose-800/80">
                The current time of {formatTime(timeSeconds)} will be cleared.
              </div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="flex-1 h-6 rounded-lg border border-stone-300 bg-white text-stone-700 text-xs font-medium"
              data-testid="button-cancel-reset"
            >
              Keep time
            </button>
            <button
              type="button"
              onClick={handleResetConfirmed}
              className="flex-1 h-6 rounded-lg bg-rose-600 text-white text-xs font-semibold"
              data-testid="button-confirm-reset"
            >
              Yes, reset
            </button>
          </div>
        </div>
      )}

      {showManual && (
        <div className="border-t border-stone-200 bg-stone-50 px-4 py-3">
          <div className="text-sm font-semibold text-stone-800">Enter time manually</div>
          <div className="mt-3 flex items-center justify-center gap-2">
            <input
              value={editMinutes}
              onChange={(e) => setEditMinutes(e.target.value)}
              inputMode="numeric"
              aria-label="Minutes"
              data-testid="input-edit-minutes"
              className="w-12 h-6 text-center text-base font-mono border border-stone-300 rounded bg-white"
            />
            <span className="text-base font-mono text-stone-400">:</span>
            <input
              value={editSeconds}
              onChange={(e) => setEditSeconds(e.target.value)}
              inputMode="numeric"
              aria-label="Seconds"
              data-testid="input-edit-seconds"
              className="w-12 h-6 text-center text-base font-mono border border-stone-300 rounded bg-white"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setShowManual(false)}
              data-testid="button-cancel-edit"
              className="flex-1 h-6 rounded-lg border border-stone-300 bg-white text-stone-700 text-xs font-medium flex items-center justify-center gap-1"
            >
              <X className="h-3 w-3" /> Cancel
            </button>
            <button
              type="button"
              onClick={saveManualEntry}
              data-testid="button-save-edit"
              className="flex-1 h-6 rounded-lg bg-stone-900 text-white text-xs font-semibold flex items-center justify-center gap-1"
            >
              <Check className="h-3 w-3" /> Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
