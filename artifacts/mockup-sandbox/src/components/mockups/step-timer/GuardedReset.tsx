import { useState, useEffect } from "react";
import { Play, Pause, RotateCcw, AlertTriangle } from "lucide-react";

function format(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

export function GuardedReset() {
  const [seconds, setSeconds] = useState(123);
  const [running, setRunning] = useState(true);
  const [manual, setManual] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [editM, setEditM] = useState("0");
  const [editS, setEditS] = useState("0");

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  function doReset() {
    setSeconds(0);
    setRunning(false);
    setManual(false);
    setConfirmReset(false);
  }

  function saveManual() {
    const total = (parseInt(editM) || 0) * 60 + (parseInt(editS) || 0);
    setSeconds(total);
    setManual(true);
    setRunning(false);
    setShowManual(false);
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Step 3 timer
            </div>
            {running && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Running
              </span>
            )}
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <div className="text-7xl font-mono font-semibold tabular-nums text-stone-900 leading-none">
              {format(seconds)}
            </div>
            {manual && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-1 rounded">
                Manual
              </span>
            )}
          </div>
        </div>

        <div className="px-6 pt-5 pb-6">
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setRunning((r) => !r)}
              className={`col-span-2 h-20 rounded-2xl text-lg font-semibold flex items-center justify-center gap-3 text-white shadow-sm transition-colors ${
                running ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {running ? <Pause className="h-7 w-7 fill-current" /> : <Play className="h-7 w-7 fill-current" />}
              {running ? "Stop" : "Start"}
            </button>
            <button
              onClick={() => setConfirmReset(true)}
              disabled={seconds === 0}
              className="h-20 rounded-2xl border border-stone-300 bg-white text-stone-700 font-medium flex flex-col items-center justify-center gap-1 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCcw className="h-5 w-5" />
              <span className="text-xs">Reset</span>
            </button>
          </div>

          <div className="mt-5 text-center">
            <button
              onClick={() => {
                setEditM(Math.floor(seconds / 60).toString());
                setEditS((seconds % 60).toString());
                setShowManual(true);
              }}
              className="text-sm text-stone-500 underline underline-offset-4 hover:text-stone-700"
            >
              Enter time manually
            </button>
          </div>
        </div>

        {confirmReset && (
          <div className="border-t border-stone-200 bg-rose-50 px-6 py-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-rose-900">
                  Reset to 00:00?
                </div>
                <div className="mt-1 text-xs text-rose-800/80">
                  The current time of {format(seconds)} will be cleared.
                </div>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setConfirmReset(false)}
                className="flex-1 h-12 rounded-xl border border-stone-300 bg-white text-stone-700 font-medium"
              >
                Keep time
              </button>
              <button
                onClick={doReset}
                className="flex-1 h-12 rounded-xl bg-rose-600 text-white font-semibold"
              >
                Yes, reset
              </button>
            </div>
          </div>
        )}

        {showManual && (
          <div className="border-t border-stone-200 bg-stone-50 px-6 py-5">
            <div className="text-sm font-semibold text-stone-800">
              Enter time manually
            </div>
            <div className="mt-3 flex items-center justify-center gap-2">
              <input
                value={editM}
                onChange={(e) => setEditM(e.target.value)}
                inputMode="numeric"
                aria-label="Minutes"
                className="w-20 h-14 text-center text-2xl font-mono border border-stone-300 rounded-lg bg-white"
              />
              <span className="text-2xl font-mono text-stone-400">:</span>
              <input
                value={editS}
                onChange={(e) => setEditS(e.target.value)}
                inputMode="numeric"
                aria-label="Seconds"
                className="w-20 h-14 text-center text-2xl font-mono border border-stone-300 rounded-lg bg-white"
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowManual(false)}
                className="flex-1 h-12 rounded-xl border border-stone-300 bg-white text-stone-700 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={saveManual}
                className="flex-1 h-12 rounded-xl bg-stone-900 text-white font-semibold"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
