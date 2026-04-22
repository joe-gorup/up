import { useState, useRef, useEffect } from "react";
import { Video as VideoIcon, Play, ExternalLink, X } from "lucide-react";

type Source = "golden" | "employer";
type VideoT = { title: string; source: Source };
type Step = { num: number; text: string; videos: VideoT[] };

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

const goalVideos: VideoT[] = [
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

function IconBtn({
  count,
  active,
  onClick,
  innerRef,
}: {
  count: number;
  active: boolean;
  onClick: () => void;
  innerRef?: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <button
      ref={innerRef}
      type="button"
      onClick={onClick}
      title={`${count} training video${count === 1 ? "" : "s"}`}
      className={
        "shrink-0 relative inline-flex items-center justify-center w-7 h-7 rounded-full transition-colors " +
        (active
          ? "bg-blue-600 text-white"
          : "bg-blue-50 text-blue-700 hover:bg-blue-100")
      }
    >
      <VideoIcon className="w-3.5 h-3.5" />
      <span
        className={
          "absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 rounded-full text-[9px] font-bold leading-[15px] " +
          (active
            ? "bg-white text-blue-700"
            : "bg-blue-600 text-white")
        }
      >
        {count}
      </span>
    </button>
  );
}

function VideoListPopover({ videos, label }: { videos: VideoT[]; label: string }) {
  return (
    <div className="absolute right-0 top-full mt-1 z-20 w-[260px] rounded-lg border border-gray-200 bg-white shadow-lg p-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-500 font-medium mb-1.5 px-1">
        {label}
      </div>
      <ul className="space-y-0.5">
        {videos.map((v, i) => (
          <li key={i}>
            <a
              href="#"
              className="flex items-center gap-1.5 text-xs px-1.5 py-1 rounded hover:bg-blue-50 group"
            >
              <Play className="w-2.5 h-2.5 fill-blue-700 text-blue-700 shrink-0" />
              <span className="flex-1 truncate text-blue-700 group-hover:underline">
                {v.title}
              </span>
              <SourceBadge s={v.source} />
              <ExternalLink className="w-2.5 h-2.5 text-gray-400 group-hover:text-blue-700" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StepRow({ step }: { step: Step }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  const has = step.videos.length > 0;
  return (
    <li className="text-sm">
      <div className="flex items-start gap-2">
        <span className="font-medium text-gray-500 shrink-0 w-4 leading-7">
          {step.num}.
        </span>
        <div className="flex-1 min-w-0 leading-7 text-gray-800">
          {step.text}
        </div>
        {has && (
          <div ref={wrapRef} className="relative">
            <IconBtn
              count={step.videos.length}
              active={open}
              onClick={() => setOpen(!open)}
              innerRef={ref}
            />
            {open && (
              <VideoListPopover
                videos={step.videos}
                label={`Step ${step.num} videos`}
              />
            )}
          </div>
        )}
      </div>
    </li>
  );
}

export function WatchPill() {
  const [goalOpen, setGoalOpen] = useState(false);
  const goalWrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!goalOpen) return;
    function handler(e: MouseEvent) {
      if (goalWrap.current && !goalWrap.current.contains(e.target as Node)) {
        setGoalOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [goalOpen]);

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex items-start justify-center">
      <div className="w-full max-w-[500px] bg-white rounded-xl shadow-sm border border-gray-200 p-6 relative overflow-visible">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">
              Customer Service Excellence
            </h2>
            <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
              In Progress
            </span>
          </div>
          {goalVideos.length > 0 && (
            <div ref={goalWrap} className="relative">
              <IconBtn
                count={goalVideos.length}
                active={goalOpen}
                onClick={() => setGoalOpen(!goalOpen)}
              />
              {goalOpen && (
                <VideoListPopover videos={goalVideos} label="Goal training" />
              )}
            </div>
          )}
        </div>

        <ol className="space-y-1">
          {steps.map((s) => (
            <StepRow key={s.num} step={s} />
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
      </div>
    </div>
  );
}
