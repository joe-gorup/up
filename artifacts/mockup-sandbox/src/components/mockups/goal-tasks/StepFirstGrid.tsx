import { CheckCircle2, XCircle, AlertCircle, MinusCircle, ChevronRight, SlidersHorizontal } from "lucide-react";

type Outcome = "correct" | "incorrect" | "verbal_prompt" | "na" | "none";

const ALL_STEPS = [
  { id: "s1", goal: "Cash Register", goalId: "g1", goalColor: "blue", step: 1, description: "Press correct category button for item type", lastOutcome: "correct" as Outcome, streak: 3 },
  { id: "s2", goal: "Cash Register", goalId: "g1", goalColor: "blue", step: 2, description: "Enter correct price or select preset item", lastOutcome: "correct" as Outcome, streak: 2 },
  { id: "s3", goal: "Cash Register", goalId: "g1", goalColor: "blue", step: 3, description: "Count back change to the customer accurately", lastOutcome: "verbal_prompt" as Outcome, streak: 0 },
  { id: "s4", goal: "Cash Register", goalId: "g1", goalColor: "blue", step: 4, description: "Say 'thank you' and offer a receipt", lastOutcome: "correct" as Outcome, streak: 1 },
  { id: "s5", goal: "Portion Control", goalId: "g2", goalColor: "emerald", step: 1, description: "Select correct scoop size for container type", lastOutcome: "correct" as Outcome, streak: 5 },
  { id: "s6", goal: "Portion Control", goalId: "g2", goalColor: "emerald", step: 2, description: "Fill scoop completely without overflowing", lastOutcome: "correct" as Outcome, streak: 5 },
  { id: "s7", goal: "Portion Control", goalId: "g2", goalColor: "emerald", step: 3, description: "Level scoop edge before placing in container", lastOutcome: "correct" as Outcome, streak: 5 },
  { id: "s8", goal: "Customer Greeting", goalId: "g3", goalColor: "violet", step: 1, description: "Make eye contact and smile when customer approaches", lastOutcome: "verbal_prompt" as Outcome, streak: 0 },
  { id: "s9", goal: "Customer Greeting", goalId: "g3", goalColor: "violet", step: 2, description: "Say 'Welcome to Golden Scoop!'", lastOutcome: "incorrect" as Outcome, streak: 0 },
  { id: "s10", goal: "Customer Greeting", goalId: "g3", goalColor: "violet", step: 3, description: "Listen and repeat order back to customer", lastOutcome: "verbal_prompt" as Outcome, streak: 0 },
  { id: "s11", goal: "Customer Greeting", goalId: "g3", goalColor: "violet", step: 4, description: "Ask about toppings or cone preference", lastOutcome: "na" as Outcome, streak: 0 },
];

const goalBadge: Record<string, string> = {
  blue: "bg-blue-50 text-blue-700 border border-blue-200",
  emerald: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  violet: "bg-violet-50 text-violet-700 border border-violet-200",
};

const goalDot: Record<string, string> = {
  blue: "bg-blue-500",
  emerald: "bg-emerald-500",
  violet: "bg-violet-500",
};

const outcomeConfig: Record<Outcome, { label: string; icon: React.ReactNode; row: string }> = {
  correct: {
    label: "Correct",
    icon: <CheckCircle2 size={14} className="text-emerald-500" />,
    row: "bg-emerald-50/40",
  },
  incorrect: {
    label: "Incorrect",
    icon: <XCircle size={14} className="text-red-400" />,
    row: "bg-red-50/40",
  },
  verbal_prompt: {
    label: "Verbal",
    icon: <AlertCircle size={14} className="text-amber-400" />,
    row: "bg-amber-50/40",
  },
  na: {
    label: "N/A",
    icon: <MinusCircle size={14} className="text-slate-300" />,
    row: "",
  },
  none: {
    label: "—",
    icon: <MinusCircle size={14} className="text-slate-200" />,
    row: "",
  },
};

function StreakBadge({ streak }: { streak: number }) {
  if (streak === 0) return <span className="text-[10px] text-slate-400">—</span>;
  if (streak >= 3) return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
      ✓✓✓
    </span>
  );
  return (
    <span className="inline-flex gap-0.5">
      {"✓".repeat(streak).split("").map((c, i) => (
        <span key={i} className="text-[11px] text-emerald-500 font-bold">{c}</span>
      ))}
      {"○".repeat(3 - streak).split("").map((c, i) => (
        <span key={i} className="text-[11px] text-slate-300">{c}</span>
      ))}
    </span>
  );
}

function GroupDivider({ goalId, goalColor, goalName }: { goalId: string; goalColor: string; goalName: string }) {
  return (
    <tr className="border-t-2 border-slate-200">
      <td colSpan={4} className="px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${goalDot[goalColor]}`} />
          <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${goalBadge[goalColor]}`}>
            {goalName}
          </span>
        </div>
      </td>
    </tr>
  );
}

export function StepFirstGrid() {
  const goalGroups = ["g1", "g2", "g3"];
  const goalNames: Record<string, string> = { g1: "Cash Register", g2: "Portion Control", g3: "Customer Greeting" };
  const goalColors: Record<string, string> = { g1: "blue", g2: "emerald", g3: "violet" };

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">Marcus Thompson</h2>
            <p className="text-xs text-slate-500">All Steps · {ALL_STEPS.length} tasks across 3 goals</p>
          </div>
          <button className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">
            Session <ChevronRight size={12} />
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50">
            <SlidersHorizontal size={12} className="text-slate-400" />
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Step · Last Outcome · Streak</span>
          </div>

          <table className="w-full text-left">
            <tbody>
              {goalGroups.map((gid) => {
                const steps = ALL_STEPS.filter(s => s.goalId === gid);
                return (
                  <>
                    <GroupDivider key={`div-${gid}`} goalId={gid} goalColor={goalColors[gid]} goalName={goalNames[gid]} />
                    {steps.map((step, i) => {
                      const oc = outcomeConfig[step.lastOutcome];
                      return (
                        <tr key={step.id} className={`border-b border-slate-50 ${oc.row}`}>
                          <td className="pl-3 pr-1 py-2.5 w-6 text-[10px] font-bold text-slate-400 align-top">{step.step}</td>
                          <td className="px-1 py-2.5 flex-1">
                            <p className="text-xs text-slate-700 leading-snug">{step.description}</p>
                          </td>
                          <td className="px-2 py-2.5 align-top">
                            <div className="flex items-center gap-1">
                              {oc.icon}
                              <span className={`text-[10px] font-medium whitespace-nowrap ${
                                step.lastOutcome === "correct" ? "text-emerald-600" :
                                step.lastOutcome === "incorrect" ? "text-red-500" :
                                step.lastOutcome === "verbal_prompt" ? "text-amber-600" : "text-slate-400"
                              }`}>{oc.label}</span>
                            </div>
                          </td>
                          <td className="pr-3 pl-1 py-2.5 align-top">
                            <StreakBadge streak={step.streak} />
                          </td>
                        </tr>
                      );
                    })}
                  </>
                );
              })}
            </tbody>
          </table>

          <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex items-center gap-4">
            <div className="flex items-center gap-1"><CheckCircle2 size={10} className="text-emerald-500" /><span className="text-[10px] text-slate-500">Correct</span></div>
            <div className="flex items-center gap-1"><AlertCircle size={10} className="text-amber-400" /><span className="text-[10px] text-slate-500">Verbal</span></div>
            <div className="flex items-center gap-1"><XCircle size={10} className="text-red-400" /><span className="text-[10px] text-slate-500">Incorrect</span></div>
            <div className="flex items-center gap-1"><MinusCircle size={10} className="text-slate-300" /><span className="text-[10px] text-slate-500">N/A</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
