import { useState, useEffect, useRef } from "react";
import { Play, Pause, MoreHorizontal, Pencil, RotateCcw } from "lucide-react";

function format(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

export function HoldToReset() {
  const [seconds, setSeconds] = useState(47);
  const [running, setRunning] = useState(false);
  const [manual, setManual] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdRef = useRef<number | null>(null);
  const startedAt = useRef<number>(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const HOLD_MS = 1500;

  function beginHold() {
    startedAt.current = Date.now();
    holdRef.current = window.setInterval(() => {
      const pct = Math.min(1, (Date.now() - startedAt.current) / HOLD_MS);
      setHoldProgress(pct);
      if (pct >= 1) {
        endHold(true);
      }
    }, 30);
  }
  function endHold(commit: boolean) {
    if (holdRef.current) {
      clearInterval(holdRef.current);
      holdRef.current = null;
    }
    if (commit) {
      setSeconds(0);
      setRunning(false);
      setManual(false);
    }
    setHoldProgress(0);
  }

  const radius = 26;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Step 3 timer
          </div>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="h-10 w-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500"
              aria-label="More options"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-11 z-10 w-56 rounded-xl border border-slate-200 bg-white shadow-lg py-1">
                <button
                  onClick={() => {
                    setManual(true);
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Pencil className="h-4 w-4 text-slate-500" />
                  Enter time manually
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-baseline gap-3 mb-6">
          <div className="text-6xl font-mono font-semibold tabular-nums text-slate-900">
            {format(seconds)}
          </div>
          {manual && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-1 rounded">
              Manual
            </span>
          )}
        </div>

        <button
          onClick={() => setRunning((r) => !r)}
          className={`w-full h-20 rounded-2xl text-xl font-semibold flex items-center justify-center gap-3 transition-colors shadow-sm ${
            running
              ? "bg-rose-600 hover:bg-rose-700 text-white"
              : "bg-emerald-600 hover:bg-emerald-700 text-white"
          }`}
        >
          {running ? (
            <>
              <Pause className="h-7 w-7 fill-current" />
              Stop
            </>
          ) : (
            <>
              <Play className="h-7 w-7 fill-current" />
              Start
            </>
          )}
        </button>

        <div className="mt-6 flex flex-col items-center">
          <button
            onMouseDown={beginHold}
            onMouseUp={() => endHold(false)}
            onMouseLeave={() => endHold(false)}
            onTouchStart={beginHold}
            onTouchEnd={() => endHold(false)}
            className="relative h-16 w-16 rounded-full border border-slate-300 bg-white text-slate-500 hover:text-slate-700 flex items-center justify-center select-none"
            aria-label="Hold to reset"
          >
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 64 64">
              <circle
                cx="32"
                cy="32"
                r={radius}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="3"
              />
              <circle
                cx="32"
                cy="32"
                r={radius}
                fill="none"
                stroke="#dc2626"
                strokeWidth="3"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - holdProgress)}
                strokeLinecap="round"
                style={{ transition: holdProgress === 0 ? "stroke-dashoffset 200ms" : "none" }}
              />
            </svg>
            <RotateCcw className="h-5 w-5" />
          </button>
          <div className="mt-2 text-xs text-slate-500">
            Hold to reset
          </div>
        </div>
      </div>
    </div>
  );
}
