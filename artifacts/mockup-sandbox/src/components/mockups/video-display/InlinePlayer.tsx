import { useState } from "react";
import { Video as VideoIcon, Play, ExternalLink, X } from "lucide-react";

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
        "text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded " +
        (s === "golden"
          ? "text-amber-700 bg-amber-100"
          : "text-purple-700 bg-purple-100")
      }
    >
      {s === "golden" ? "Golden Scoop" : "Employer"}
    </span>
  );
}

function IconBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Training video"
      className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md text-blue-600 hover:text-white hover:bg-blue-600 bg-blue-50 transition-colors"
    >
      <VideoIcon className="w-4 h-4" />
    </button>
  );
}

export function InlinePlayer() {
  const [active, setActive] = useState<Step | null>(null);

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex items-start justify-center relative">
      <div className="w-full max-w-[500px] bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Customer Service Excellence
          </h2>
          <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
            In Progress
          </span>
        </div>

        <ol className="space-y-2">
          {steps.map((s) => (
            <li key={s.num} className="text-sm">
              <div className="flex items-start gap-2">
                <span className="font-medium text-gray-500 shrink-0 w-4 leading-7">
                  {s.num}.
                </span>
                <div className="flex-1 min-w-0 leading-7 text-gray-800">
                  {s.text}
                </div>
                {s.video && <IconBtn onClick={() => setActive(s)} />}
              </div>
            </li>
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

      {active && active.video && (
        <>
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-[1px] z-10"
            onClick={() => setActive(null)}
          />
          <aside className="absolute top-0 right-0 h-full w-[300px] bg-white shadow-2xl z-20 border-l border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-100 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wide text-blue-700 font-semibold">
                  Step {active.num} training
                </div>
                <div className="text-sm font-medium text-gray-900 mt-0.5 line-clamp-2 leading-snug">
                  {active.text}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActive(null)}
                className="shrink-0 p-1 rounded hover:bg-gray-100 text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <a
                href="#"
                className="flex items-start gap-2 p-2 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50/40"
              >
                <div className="shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center mt-0.5">
                  <Play className="w-3.5 h-3.5 fill-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-900 line-clamp-2 leading-snug">
                    {active.video.title}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <SourceBadge s={active.video.source} />
                    <span className="text-[10px] text-gray-500 inline-flex items-center gap-0.5">
                      <ExternalLink className="w-2.5 h-2.5" />
                      YouTube
                    </span>
                  </div>
                </div>
              </a>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
