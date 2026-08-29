import { ChevronDown, ChevronUp, ChevronRight, Trophy, TrendingUp, TrendingDown } from "lucide-react";
import { useState } from "react";

type Outcome = "correct" | "incorrect" | "verbal_prompt" | "na";

const SAMPLE_DATA = {
  employee: "Marcus Thompson",
  goals: [
    {
      id: "g1",
      title: "Cash Register Operation",
      color: "blue",
      steps: [
        {
          id: "s1", order: 1,
          description: "Press the correct category button for item type",
          history: ["correct", "correct", "correct", "correct", "verbal_prompt"] as Outcome[],
          trend: "up",
        },
        {
          id: "s2", order: 2,
          description: "Enter the correct price or select preset item",
          history: ["correct", "correct", "verbal_prompt", "correct", "correct"] as Outcome[],
          trend: "up",
        },
        {
          id: "s3", order: 3,
          description: "Count back change to the customer accurately",
          history: ["incorrect", "verbal_prompt", "verbal_prompt", "incorrect", "verbal_prompt"] as Outcome[],
          trend: "neutral",
        },
        {
          id: "s4", order: 4,
          description: "Say 'thank you' and offer a receipt",
          history: ["correct", "correct", "correct"] as Outcome[],
          trend: "up",
        },
      ],
    },
    {
      id: "g2",
      title: "Scoop Portion Control",
      color: "emerald",
      steps: [
        {
          id: "s5", order: 1,
          description: "Select correct scoop size for container type",
          history: ["correct", "correct", "correct", "correct", "correct"] as Outcome[],
          trend: "up",
        },
        {
          id: "s6", order: 2,
          description: "Fill scoop completely without overflowing",
          history: ["verbal_prompt", "correct", "correct", "correct", "correct"] as Outcome[],
          trend: "up",
        },
        {
          id: "s7", order: 3,
          description: "Level scoop edge before placing in container",
          history: ["correct", "correct", "correct", "correct", "correct"] as Outcome[],
          trend: "up",
        },
      ],
    },
    {
      id: "g3",
      title: "Customer Greeting Protocol",
      color: "violet",
      steps: [
        {
          id: "s8", order: 1,
          description: "Make eye contact and smile when customer approaches",
          history: ["incorrect", "verbal_prompt", "verbal_prompt"] as Outcome[],
          trend: "up",
        },
        {
          id: "s9", order: 2,
          description: "Say 'Welcome to Golden Scoop! What can I get for you?'",
          history: ["incorrect", "incorrect", "incorrect"] as Outcome[],
          trend: "down",
        },
        {
          id: "s10", order: 3,
          description: "Listen without interrupting and repeat order back",
          history: ["verbal_prompt", "verbal_prompt", "verbal_prompt"] as Outcome[],
          trend: "neutral",
        },
        {
          id: "s11", order: 4,
          description: "Ask about any toppings or cones",
          history: ["na", "na"] as Outcome[],
          trend: "neutral",
        },
      ],
    },
  ],
};

const outcomeStyles: Record<Outcome, { dot: string; label: string; bg: string; text: string }> = {
  correct: { dot: "bg-emerald-400", label: "✓", bg: "bg-emerald-100", text: "text-emerald-700" },
  incorrect: { dot: "bg-red-400", label: "✗", bg: "bg-red-100", text: "text-red-600" },
  verbal_prompt: { dot: "bg-amber-400", label: "~", bg: "bg-amber-100", text: "text-amber-700" },
  na: { dot: "bg-slate-200", label: "—", bg: "bg-slate-100", text: "text-slate-400" },
};

const colorAccent: Record<string, { border: string; header: string; badge: string }> = {
  blue: { border: "border-blue-200", header: "bg-blue-50", badge: "text-blue-700 bg-blue-100" },
  emerald: { border: "border-emerald-200", header: "bg-emerald-50", badge: "text-emerald-700 bg-emerald-100" },
  violet: { border: "border-violet-200", header: "bg-violet-50", badge: "text-violet-700 bg-violet-100" },
};

function OutcomePip({ outcome, large }: { outcome: Outcome; large?: boolean }) {
  const s = outcomeStyles[outcome];
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-bold text-white
        ${large ? "w-6 h-6 text-[11px]" : "w-4 h-4 text-[9px]"}
        ${s.dot}`}
      title={outcome.replace("_", " ")}
    >
      {s.label}
    </span>
  );
}

function StepCard({ step, goalColor }: {
  step: typeof SAMPLE_DATA.goals[0]["steps"][0];
  goalColor: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const lastOutcome = step.history[step.history.length - 1];
  const s = outcomeStyles[lastOutcome];
  const consecutiveCorrect = (() => {
    let count = 0;
    for (let i = step.history.length - 1; i >= 0; i--) {
      if (step.history[i] === "correct") count++;
      else break;
    }
    return count;
  })();

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${s.bg} border-${lastOutcome === 'correct' ? 'emerald' : lastOutcome === 'incorrect' ? 'red' : lastOutcome === 'verbal_prompt' ? 'amber' : 'slate'}-200`}
      style={{ borderColor: lastOutcome === 'correct' ? '#a7f3d0' : lastOutcome === 'incorrect' ? '#fca5a5' : lastOutcome === 'verbal_prompt' ? '#fcd34d' : '#e2e8f0' }}>
      <button
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-[10px] font-black text-slate-400 w-4 shrink-0">{step.order}</span>
        <OutcomePip outcome={lastOutcome} />
        <span className="flex-1 text-xs font-medium text-slate-700 leading-snug">{step.description}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {consecutiveCorrect >= 3 && <Trophy size={11} className="text-emerald-500" />}
          {step.trend === "up" && <TrendingUp size={11} className="text-emerald-500" />}
          {step.trend === "down" && <TrendingDown size={11} className="text-red-400" />}
          {expanded ? <ChevronUp size={12} className="text-slate-400" /> : <ChevronDown size={12} className="text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/60 px-3 py-2 bg-white/50">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Recent history</span>
          </div>
          <div className="flex items-center gap-2">
            {step.history.map((o, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <OutcomePip outcome={o} large />
                <span className="text-[9px] text-slate-400">-{step.history.length - i}</span>
              </div>
            ))}
            {step.history.length < 5 && Array.from({ length: 5 - step.history.length }).map((_, i) => (
              <div key={`empty-${i}`} className="flex flex-col items-center gap-0.5">
                <span className="w-6 h-6 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center text-[9px] text-slate-300">?</span>
                <span className="text-[9px] text-slate-300">—</span>
              </div>
            ))}
          </div>
          {consecutiveCorrect > 0 && (
            <p className="mt-2 text-[10px] text-slate-500">
              {consecutiveCorrect >= 3
                ? <span className="font-semibold text-emerald-600">Step mastered — {consecutiveCorrect} correct in a row!</span>
                : <><span className="font-semibold text-slate-700">{consecutiveCorrect}/3</span> correct in a row toward mastery</>}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function GoalSection({ goal }: { goal: typeof SAMPLE_DATA.goals[0] }) {
  const c = colorAccent[goal.color];
  const allMastered = goal.steps.every(s => {
    const last = s.history[s.history.length - 1];
    return last === "correct";
  });

  return (
    <div className={`rounded-2xl border shadow-sm overflow-hidden ${c.border}`}>
      <div className={`px-4 py-2.5 flex items-center gap-2 ${c.header}`}>
        <span className={`text-xs font-bold ${c.badge} px-2 py-0.5 rounded-full`}>{goal.title}</span>
        {allMastered && <Trophy size={12} className="text-emerald-500 ml-auto" />}
      </div>
      <div className="bg-white px-3 py-2 space-y-1.5">
        {goal.steps.map((step) => (
          <StepCard key={step.id} step={step} goalColor={goal.color} />
        ))}
      </div>
    </div>
  );
}

export function StepHistoryCards() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans">
      <div className="max-w-md mx-auto space-y-3">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="text-base font-bold text-slate-800">{SAMPLE_DATA.employee}</h2>
            <p className="text-xs text-slate-500">Tap any step for its full history</p>
          </div>
          <button className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">
            Session <ChevronRight size={12} />
          </button>
        </div>

        {SAMPLE_DATA.goals.map((goal) => (
          <GoalSection key={goal.id} goal={goal} />
        ))}
      </div>
    </div>
  );
}
