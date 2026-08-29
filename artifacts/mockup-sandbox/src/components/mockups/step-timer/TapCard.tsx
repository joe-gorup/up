import { useState, useEffect } from "react";
import { Play, Pause, MoreVertical, RotateCcw, Pencil, X, Check } from "lucide-react";

function format(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

export function TapCard() {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [manual, setManual] = useState(false);
  const [sheet, setSheet] = useState<null | "menu" | "reset" | "edit">(null);
  const [editM, setEditM] = useState("0");
  const [editS, setEditS] = useState("0");

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  function openEdit() {
    setEditM(Math.floor(seconds / 60).toString());
    setEditS((seconds % 60).toString());
    setSheet("edit");
  }
  function saveEdit() {
    const total = (parseInt(editM) || 0) * 60 + (parseInt(editS) || 0);
    setSeconds(total);
    setManual(true);
    setRunning(false);
    setSheet(null);
  }
  function confirmReset() {
    setSeconds(0);
    setRunning(false);
    setManual(false);
    setSheet(null);
  }

  return (
    <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-6 relative">
      <div className="w-full max-w-sm">
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2 px-1 flex items-center justify-between">
          <span>Step 3 timer</span>
          <button
            onClick={() => setSheet("menu")}
            className="h-9 w-9 rounded-full hover:bg-zinc-200 flex items-center justify-center text-zinc-500"
            aria-label="More"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>

        <button
          onClick={() => setRunning((r) => !r)}
          className={`w-full rounded-3xl border-2 px-6 py-10 text-left transition-all shadow-sm select-none ${
            running
              ? "bg-rose-50 border-rose-300"
              : "bg-white border-zinc-200 hover:border-emerald-300"
          }`}
        >
          <div className="flex items-end justify-between">
            <div>
              <div className="text-7xl font-mono font-bold tabular-nums text-zinc-900 leading-none">
                {format(seconds)}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded ${
                    running
                      ? "bg-rose-600 text-white"
                      : seconds > 0
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${running ? "bg-white animate-pulse" : "bg-current"}`} />
                  {running ? "Running" : seconds > 0 ? "Paused" : "Ready"}
                </span>
                {manual && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-1 rounded">
                    Manual
                  </span>
                )}
              </div>
            </div>
            <div
              className={`h-20 w-20 rounded-2xl flex items-center justify-center text-white shadow ${
                running ? "bg-rose-600" : "bg-emerald-600"
              }`}
            >
              {running ? (
                <Pause className="h-10 w-10 fill-current" />
              ) : (
                <Play className="h-10 w-10 fill-current" />
              )}
            </div>
          </div>
          <div className="mt-6 text-center text-xs text-zinc-500">
            Tap anywhere on this card to {running ? "stop" : "start"}
          </div>
        </button>
      </div>

      {sheet && (
        <div
          className="absolute inset-0 bg-black/40 flex items-end justify-center"
          onClick={() => setSheet(null)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-t-3xl p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            {sheet === "menu" && (
              <>
                <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-zinc-300" />
                <button
                  onClick={openEdit}
                  className="w-full flex items-center gap-3 px-4 py-4 rounded-xl hover:bg-zinc-100 text-left"
                >
                  <Pencil className="h-5 w-5 text-zinc-500" />
                  <span className="text-base text-zinc-800">Enter time manually</span>
                </button>
                <button
                  onClick={() => setSheet("reset")}
                  className="w-full flex items-center gap-3 px-4 py-4 rounded-xl hover:bg-zinc-100 text-left"
                >
                  <RotateCcw className="h-5 w-5 text-rose-600" />
                  <span className="text-base text-rose-700">Reset timer</span>
                </button>
              </>
            )}

            {sheet === "reset" && (
              <>
                <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-zinc-300" />
                <div className="px-2">
                  <div className="text-lg font-semibold text-zinc-900">Reset to 00:00?</div>
                  <div className="mt-1 text-sm text-zinc-600">
                    The current time of {format(seconds)} will be lost.
                  </div>
                </div>
                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => setSheet(null)}
                    className="flex-1 h-14 rounded-2xl border border-zinc-300 bg-white text-zinc-700 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmReset}
                    className="flex-1 h-14 rounded-2xl bg-rose-600 text-white font-semibold"
                  >
                    Reset
                  </button>
                </div>
              </>
            )}

            {sheet === "edit" && (
              <>
                <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-zinc-300" />
                <div className="px-2 mb-4">
                  <div className="text-lg font-semibold text-zinc-900">Enter time manually</div>
                  <div className="mt-1 text-sm text-zinc-600">
                    Use this only when the timer wasn't running.
                  </div>
                </div>
                <div className="flex items-center justify-center gap-3 mb-5">
                  <input
                    value={editM}
                    onChange={(e) => setEditM(e.target.value)}
                    inputMode="numeric"
                    className="w-24 h-16 text-center text-3xl font-mono border border-zinc-300 rounded-xl"
                    aria-label="Minutes"
                  />
                  <span className="text-3xl font-mono text-zinc-400">:</span>
                  <input
                    value={editS}
                    onChange={(e) => setEditS(e.target.value)}
                    inputMode="numeric"
                    className="w-24 h-16 text-center text-3xl font-mono border border-zinc-300 rounded-xl"
                    aria-label="Seconds"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSheet(null)}
                    className="flex-1 h-14 rounded-2xl border border-zinc-300 bg-white text-zinc-700 font-semibold flex items-center justify-center gap-2"
                  >
                    <X className="h-5 w-5" /> Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    className="flex-1 h-14 rounded-2xl bg-zinc-900 text-white font-semibold flex items-center justify-center gap-2"
                  >
                    <Check className="h-5 w-5" /> Save
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
