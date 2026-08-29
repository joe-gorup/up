import { CheckCircle2, XCircle, MinusCircle, AlertCircle, Star, Trophy, ChevronRight } from "lucide-react";

const SAMPLE_DATA = {
  employee: "Marcus Thompson",
  goals: [
    {
      id: "g1",
      title: "Cash Register Operation",
      description: "Accurately process customer transactions independently",
      consecutiveCorrect: 2,
      masteryTarget: 3,
      status: "active" as const,
      recentOutcomes: ["correct", "correct", "verbal_prompt", "incorrect", "correct"] as const,
      steps: [
        { id: "s1", order: 1, description: "Press the correct category button for item type", lastOutcome: "correct" as const },
        { id: "s2", order: 2, description: "Enter the correct price or select preset item", lastOutcome: "correct" as const },
        { id: "s3", order: 3, description: "Count back change to the customer accurately", lastOutcome: "verbal_prompt" as const },
        { id: "s4", order: 4, description: "Say 'thank you' and offer a receipt", lastOutcome: "correct" as const },
      ],
    },
    {
      id: "g2",
      title: "Scoop Portion Control",
      description: "Consistently serve correct portion sizes for each container",
      consecutiveCorrect: 3,
      masteryTarget: 3,
      status: "maintenance" as const,
      recentOutcomes: ["correct", "correct", "correct", "correct", "verbal_prompt"] as const,
      steps: [
        { id: "s5", order: 1, description: "Select correct scoop size for container type", lastOutcome: "correct" as const },
        { id: "s6", order: 2, description: "Fill scoop completely without overflowing", lastOutcome: "correct" as const },
        { id: "s7", order: 3, description: "Level scoop edge before placing in container", lastOutcome: "correct" as const },
      ],
    },
    {
      id: "g3",
      title: "Customer Greeting Protocol",
      description: "Greet each customer warmly using Golden Scoop standards",
      consecutiveCorrect: 0,
      masteryTarget: 3,
      status: "active" as const,
      recentOutcomes: ["incorrect", "verbal_prompt", "verbal_prompt"] as const,
      steps: [
        { id: "s8", order: 1, description: "Make eye contact and smile when customer approaches", lastOutcome: "verbal_prompt" as const },
        { id: "s9", order: 2, description: "Say 'Welcome to Golden Scoop! What can I get for you?'", lastOutcome: "incorrect" as const },
        { id: "s10", order: 3, description: "Listen without interrupting and repeat order back", lastOutcome: "verbal_prompt" as const },
        { id: "s11", order: 4, description: "Ask about any toppings or cones", lastOutcome: "na" as const },
      ],
    },
  ],
};

type Outcome = "correct" | "incorrect" | "verbal_prompt" | "na";

function OutcomeIcon({ outcome, size = 16 }: { outcome: Outcome; size?: number }) {
  const props = { size, strokeWidth: 2 };
  if (outcome === "correct") return <CheckCircle2 {...props} className="text-emerald-500" />;
  if (outcome === "incorrect") return <XCircle {...props} className="text-red-400" />;
  if (outcome === "verbal_prompt") return <AlertCircle {...props} className="text-amber-400" />;
  return <MinusCircle {...props} className="text-slate-300" />;
}

function OutcomeDot({ outcome }: { outcome: Outcome }) {
  const colors: Record<Outcome, string> = {
    correct: "bg-emerald-400",
    incorrect: "bg-red-400",
    verbal_prompt: "bg-amber-400",
    na: "bg-slate-200",
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[outcome]}`} />;
}

function GoalCard({ goal }: { goal: typeof SAMPLE_DATA.goals[0] }) {
  const pct = Math.round((goal.consecutiveCorrect / goal.masteryTarget) * 100);
  const isMastered = goal.status === "maintenance";

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isMastered ? "border-emerald-200" : "border-slate-200"}`}>
      <div className={`px-4 py-3 flex items-start justify-between gap-3 ${isMastered ? "bg-emerald-50" : "bg-white"}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-800 leading-snug">{goal.title}</span>
            {isMastered && <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full"><Trophy size={10} />Mastered</span>}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 leading-snug">{goal.description}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-xs font-bold text-slate-700">{goal.consecutiveCorrect}/{goal.masteryTarget}</span>
          <div className="flex gap-0.5">
            {goal.recentOutcomes.map((o, i) => <OutcomeDot key={i} outcome={o} />)}
          </div>
        </div>
      </div>

      {!isMastered && (
        <div className="px-4 pb-2">
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-[10px] text-slate-400">Mastery progress</span>
            <span className="text-[10px] text-slate-500 font-medium">{pct}%</span>
          </div>
        </div>
      )}

      <div className="border-t border-slate-100 divide-y divide-slate-50">
        {goal.steps.map((step) => (
          <div key={step.id} className="flex items-center gap-3 px-4 py-2.5">
            <OutcomeIcon outcome={step.lastOutcome} size={15} />
            <span className="text-[11px] text-slate-400 font-medium w-4 shrink-0">{step.order}.</span>
            <span className="text-xs text-slate-700 leading-snug flex-1">{step.description}</span>
            <span className={`text-[10px] font-medium shrink-0 ${
              step.lastOutcome === "correct" ? "text-emerald-600" :
              step.lastOutcome === "incorrect" ? "text-red-500" :
              step.lastOutcome === "verbal_prompt" ? "text-amber-600" : "text-slate-400"
            }`}>
              {step.lastOutcome === "correct" ? "Correct" :
               step.lastOutcome === "incorrect" ? "Incorrect" :
               step.lastOutcome === "verbal_prompt" ? "Verbal" : "N/A"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AlwaysVisibleChecklist() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans">
      <div className="max-w-md mx-auto space-y-3">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="text-base font-bold text-slate-800">{SAMPLE_DATA.employee}</h2>
            <p className="text-xs text-slate-500">Development Goals · {SAMPLE_DATA.goals.length} active</p>
          </div>
          <button className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">
            Start Session <ChevronRight size={12} />
          </button>
        </div>

        {SAMPLE_DATA.goals.map((goal) => (
          <GoalCard key={goal.id} goal={goal} />
        ))}
      </div>
    </div>
  );
}
