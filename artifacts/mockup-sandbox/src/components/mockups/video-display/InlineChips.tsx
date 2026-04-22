import { useState } from "react";
import { Video as VideoIcon, Play, ExternalLink } from "lucide-react";

type Source = "golden" | "employer";
type VideoT = { title: string; source: Source };
type Step = { num: number; text: string; video: VideoT | null };

const steps: Step[] = [
  {
    num: 1,
    text: "Greet every customer within 5 seconds of entering",
    video: { title: "Greeting customers — first 30 seconds matter", source: "golden" },
  },
  {
    num: 2,
    text: "Recommend a flavor based on customer preference",
    video: { title: "How to suggest flavors without being pushy", source: "golden" },
  },
  {
    num: 3,
    text: "Confirm order back to customer before ringing up",
    video: null,
  },
  {
    num: 4,
    text: "Hand cone/cup with napkin and a smile",
    video: { title: "Napkin etiquette and the friendly handoff", source: "employer" },
  },
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

function VideoIconButton({
  open,
  onClick,
}: {
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Training video"
      className={
        "shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md transition-colors " +
        (open
          ? "bg-blue-600 text-white"
          : "bg-blue-50 text-blue-600 hover:bg-blue-100")
      }
    >
      <VideoIcon className="w-3.5 h-3.5" />
    </button>
  );
}

function StepRow({ step }: { step: Step }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="text-sm">
      <div className="flex items-start gap-2">
        <span className="font-medium text-gray-500 shrink-0 w-4 leading-6">
          {step.num}.
        </span>
        <div className="flex-1 min-w-0 leading-6 text-gray-800">
          {step.text}
        </div>
        {step.video && (
          <VideoIconButton open={open} onClick={() => setOpen(!open)} />
        )}
      </div>
      {step.video && open && (
        <div className="mt-1.5 ml-6 border-l-2 border-blue-100 pl-3 flex items-center gap-1.5 text-xs">
          <Play className="w-2.5 h-2.5 fill-blue-700 text-blue-700 shrink-0" />
          <a
            href="#"
            className="text-blue-700 hover:underline truncate"
            title={step.video.title}
          >
            {step.video.title}
          </a>
          <SourceBadge s={step.video.source} />
        </div>
      )}
    </li>
  );
}

export function InlineChips() {
  return (
    <div className="min-h-screen bg-gray-50 p-6 flex items-start justify-center">
      <div className="w-full max-w-[500px] bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Customer Service Excellence
          </h2>
          <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
            In Progress
          </span>
        </div>

        <ol className="space-y-2.5">
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
