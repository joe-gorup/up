import { useState } from "react";
import { ChevronRight, ChevronDown, Play } from "lucide-react";

type Source = "golden" | "employer";
type Video = { title: string; source: Source };
type Step = { num: number; text: string; videos: Video[] };

const steps: Step[] = [
  {
    num: 1,
    text: "Greet every customer within 5 seconds of entering",
    videos: [
      { title: "Greeting customers — first 30 seconds matter", source: "golden" },
      { title: "Body language fundamentals", source: "employer" },
    ],
  },
  {
    num: 2,
    text: "Recommend a flavor based on customer preference",
    videos: [{ title: "How to suggest flavors without being pushy", source: "golden" }],
  },
  {
    num: 3,
    text: "Confirm order back to customer before ringing up",
    videos: [],
  },
  {
    num: 4,
    text: "Hand cone/cup with napkin and a smile",
    videos: [
      { title: "Cone vs cup: matching the order", source: "golden" },
      { title: "Napkin etiquette and the friendly handoff", source: "employer" },
      { title: "Handling indecisive customers", source: "golden" },
    ],
  },
];

const goalVideos: Video[] = [
  { title: "End-to-end customer service walkthrough", source: "golden" },
  { title: "Body language fundamentals", source: "employer" },
];

const sessionDots = ["green", "green", "amber", "green", "grey", "amber"] as const;
const dotClass = {
  green: "bg-emerald-500",
  amber: "bg-amber-400",
  grey: "bg-gray-300",
} as const;

function SourceBadge({ s }: { s: Source }) {
  return (
    <span
      className={
        "text-[9px] uppercase tracking-wide font-medium px-1 rounded " +
        (s === "golden"
          ? "text-amber-700 bg-amber-100/70"
          : "text-purple-700 bg-purple-100/70")
      }
    >
      {s === "golden" ? "GS" : "Emp"}
    </span>
  );
}

function VideoLinks({ videos }: { videos: Video[] }) {
  return (
    <ul className="mt-1.5 ml-1 space-y-1">
      {videos.map((v, i) => (
        <li key={i} className="flex items-center gap-1.5 text-xs">
          <Play className="w-2.5 h-2.5 fill-blue-700 text-blue-700 shrink-0" />
          <a
            href="#"
            className="text-blue-700 hover:underline truncate"
            title={v.title}
          >
            {v.title}
          </a>
          <SourceBadge s={v.source} />
        </li>
      ))}
    </ul>
  );
}

function StepWithToggle({ step, defaultOpen }: { step: Step; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const has = step.videos.length > 0;
  return (
    <li className="text-sm">
      <div className="flex gap-2">
        <span className="font-medium text-gray-500 shrink-0 w-4">{step.num}.</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-gray-800">{step.text}</span>
            {has && (
              <button
                type="button"
                onClick={() => setOpen(!open)}
                className="inline-flex items-center gap-0.5 text-[11px] text-gray-500 hover:text-blue-700"
              >
                {open ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                {step.videos.length} video{step.videos.length === 1 ? "" : "s"}
              </button>
            )}
          </div>
          {has && open && <VideoLinks videos={step.videos} />}
        </div>
      </div>
    </li>
  );
}

export function WatchPill() {
  const [goalOpen, setGoalOpen] = useState(true);
  return (
    <div className="min-h-screen bg-gray-50 p-6 flex items-start justify-center">
      <div className="w-full max-w-[500px] bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Customer Service Excellence
            </h2>
            <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
              In Progress
            </span>
          </div>
        </div>

        <ol className="space-y-3">
          {steps.map((s, i) => (
            <StepWithToggle key={s.num} step={s} defaultOpen={i === 0} />
          ))}
        </ol>

        <div className="mt-5 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-1.5">
            {sessionDots.map((d, i) => (
              <span
                key={i}
                className={"inline-block w-2 h-2 rounded-full " + dotClass[d]}
              />
            ))}
            <span className="ml-2 text-[11px] text-gray-500">
              last 6 sessions
            </span>
          </div>
        </div>

        {goalVideos.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setGoalOpen(!goalOpen)}
              className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide font-medium text-gray-600 hover:text-blue-700"
            >
              {goalOpen ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              Goal training ({goalVideos.length})
            </button>
            {goalOpen && <VideoLinks videos={goalVideos} />}
          </div>
        )}
      </div>
    </div>
  );
}
