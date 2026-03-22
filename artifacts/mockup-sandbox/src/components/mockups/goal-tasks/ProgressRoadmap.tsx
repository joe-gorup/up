import { Trophy, Lock, Play, ChevronRight, Star } from "lucide-react";

const SAMPLE_DATA = {
  employee: "Marcus Thompson",
  goals: [
    {
      id: "g1",
      title: "Cash Register Operation",
      shortTitle: "Cash Register",
      emoji: "💳",
      consecutiveCorrect: 2,
      masteryTarget: 3,
      status: "active" as const,
      color: "blue",
      steps: [
        { id: "s1", order: 1, description: "Press the correct category button", status: "mastered" as const },
        { id: "s2", order: 2, description: "Enter price or select preset item", status: "mastered" as const },
        { id: "s3", order: 3, description: "Count back change accurately", status: "current" as const },
        { id: "s4", order: 4, description: "Say 'thank you' and offer receipt", status: "upcoming" as const },
      ],
    },
    {
      id: "g2",
      title: "Scoop Portion Control",
      shortTitle: "Portion Control",
      emoji: "🍦",
      consecutiveCorrect: 3,
      masteryTarget: 3,
      status: "maintenance" as const,
      color: "emerald",
      steps: [
        { id: "s5", order: 1, description: "Select correct scoop size", status: "mastered" as const },
        { id: "s6", order: 2, description: "Fill scoop completely", status: "mastered" as const },
        { id: "s7", order: 3, description: "Level scoop edge before placing", status: "mastered" as const },
      ],
    },
    {
      id: "g3",
      title: "Customer Greeting Protocol",
      shortTitle: "Greeting",
      emoji: "👋",
      consecutiveCorrect: 0,
      masteryTarget: 3,
      status: "active" as const,
      color: "violet",
      steps: [
        { id: "s8", order: 1, description: "Eye contact and smile", status: "current" as const },
        { id: "s9", order: 2, description: "Say welcome phrase", status: "upcoming" as const },
        { id: "s10", order: 3, description: "Listen and repeat order back", status: "upcoming" as const },
        { id: "s11", order: 4, description: "Ask about toppings or cones", status: "upcoming" as const },
      ],
    },
  ],
};

type StepStatus = "mastered" | "current" | "upcoming";
type GoalStatus = "active" | "maintenance";

const colorMap = {
  blue: {
    bg: "bg-blue-500", light: "bg-blue-100", text: "text-blue-700",
    ring: "ring-blue-400", track: "bg-blue-200", dot: "bg-blue-500",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
  },
  emerald: {
    bg: "bg-emerald-500", light: "bg-emerald-100", text: "text-emerald-700",
    ring: "ring-emerald-400", track: "bg-emerald-200", dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  violet: {
    bg: "bg-violet-500", light: "bg-violet-100", text: "text-violet-700",
    ring: "ring-violet-400", track: "bg-violet-200", dot: "bg-violet-500",
    badge: "bg-violet-50 text-violet-700 border-violet-200",
  },
};

function StepNode({ step, color, isLast }: {
  step: typeof SAMPLE_DATA.goals[0]["steps"][0];
  color: keyof typeof colorMap;
  isLast: boolean;
}) {
  const c = colorMap[color];

  const nodeEl = step.status === "mastered"
    ? <div className={`w-8 h-8 rounded-full ${c.bg} flex items-center justify-center shadow`}><Star size={13} className="text-white fill-white" /></div>
    : step.status === "current"
    ? <div className={`w-8 h-8 rounded-full bg-white border-2 ${c.ring.replace("ring-", "border-")} flex items-center justify-center shadow-md ring-2 ${c.ring} ring-offset-1`}><Play size={12} className={c.text} fill="currentColor" /></div>
    : <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center"><span className="text-[10px] font-bold text-slate-400">{step.order}</span></div>;

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        {nodeEl}
        {!isLast && <div className={`w-0.5 flex-1 my-1 min-h-[20px] ${step.status === "mastered" ? c.bg : "bg-slate-200"}`} />}
      </div>
      <div className={`pb-3 flex-1 min-w-0 ${isLast ? "" : ""}`}>
        <p className={`text-xs leading-snug font-medium ${
          step.status === "mastered" ? "text-slate-600 line-through decoration-slate-300" :
          step.status === "current" ? "text-slate-800" : "text-slate-400"
        }`}>
          {step.description}
        </p>
        {step.status === "current" && (
          <span className={`inline-block mt-0.5 text-[10px] font-semibold ${c.text} ${c.light} px-1.5 py-0.5 rounded-full`}>
            Working on this
          </span>
        )}
      </div>
    </div>
  );
}

function RoadmapCard({ goal }: { goal: typeof SAMPLE_DATA.goals[0] }) {
  const c = colorMap[goal.color as keyof typeof colorMap];
  const isMastered = goal.status === "maintenance";
  const masteredCount = goal.steps.filter(s => s.status === "mastered").length;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isMastered ? "border-emerald-200" : "border-slate-200"}`}>
      <div className={`px-4 py-3 flex items-center gap-3 ${isMastered ? "bg-emerald-50" : c.light.replace("bg-", "bg-").concat(" bg-opacity-30")}`}
        style={{ background: isMastered ? undefined : undefined }}>
        <span className="text-2xl">{goal.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-800">{goal.title}</span>
            {isMastered && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                <Trophy size={9} /> Mastered
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${c.bg}`} style={{ width: `${(masteredCount / goal.steps.length) * 100}%` }} />
            </div>
            <span className="text-[10px] font-medium text-slate-500 shrink-0">{masteredCount}/{goal.steps.length} steps</span>
          </div>
        </div>
        <div className="text-center shrink-0">
          <div className={`text-lg font-black ${c.text}`}>{goal.consecutiveCorrect}/{goal.masteryTarget}</div>
          <div className="text-[9px] text-slate-400 leading-tight">in a row</div>
        </div>
      </div>

      <div className="px-4 pt-3 pb-2">
        {goal.steps.map((step, i) => (
          <StepNode key={step.id} step={step} color={goal.color as keyof typeof colorMap} isLast={i === goal.steps.length - 1} />
        ))}
      </div>
    </div>
  );
}

export function ProgressRoadmap() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans">
      <div className="max-w-md mx-auto space-y-3">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="text-base font-bold text-slate-800">{SAMPLE_DATA.employee}</h2>
            <p className="text-xs text-slate-500">Goal Roadmap · {SAMPLE_DATA.goals.length} goals</p>
          </div>
          <button className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">
            Start Session <ChevronRight size={12} />
          </button>
        </div>

        {SAMPLE_DATA.goals.map((goal) => (
          <RoadmapCard key={goal.id} goal={goal} />
        ))}
      </div>
    </div>
  );
}
