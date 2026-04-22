import { useState } from "react";
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

type Drawer =
  | { kind: "step"; step: Step }
  | { kind: "goal" }
  | null;

function IconBtn({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${count} training video${count === 1 ? "" : "s"}`}
      className="shrink-0 group inline-flex items-center justify-center w-6 h-6 rounded-md text-gray-400 hover:text-blue-700 hover:bg-blue-50 transition-colors relative"
    >
      <VideoIcon className="w-4 h-4" />
      <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-blue-600 text-white text-[9px] font-bold leading-[14px] group-hover:bg-blue-700">
        {count}
      </span>
    </button>
  );
}

export function InlinePlayer() {
  const [drawer, setDrawer] = useState<Drawer>(null);

  const drawerVideos =
    drawer?.kind === "step"
      ? drawer.step.videos
      : drawer?.kind === "goal"
      ? goalVideos
      : [];
  const drawerTitle =
    drawer?.kind === "step"
      ? `Step ${drawer.step.num} training`
      : drawer?.kind === "goal"
      ? "Goal training"
      : "";
  const drawerSubtitle =
    drawer?.kind === "step" ? drawer.step.text : "Customer Service Excellence";

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex items-start justify-center relative">
      <div className="w-full max-w-[500px] bg-white rounded-xl shadow-sm border border-gray-200 p-6">
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
            <IconBtn
              count={goalVideos.length}
              onClick={() => setDrawer({ kind: "goal" })}
            />
          )}
        </div>

        <ol className="space-y-2">
          {steps.map((s) => (
            <li key={s.num} className="text-sm">
              <div className="flex items-start gap-2">
                <span className="font-medium text-gray-500 shrink-0 w-4 leading-6">
                  {s.num}.
                </span>
                <div className="flex-1 min-w-0 leading-6 text-gray-800">
                  {s.text}
                </div>
                {s.videos.length > 0 && (
                  <IconBtn
                    count={s.videos.length}
                    onClick={() => setDrawer({ kind: "step", step: s })}
                  />
                )}
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

      {drawer && (
        <>
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-[1px] z-10"
            onClick={() => setDrawer(null)}
          />
          <aside className="absolute top-0 right-0 h-full w-[300px] bg-white shadow-2xl z-20 border-l border-gray-200 flex flex-col animate-in slide-in-from-right">
            <div className="p-4 border-b border-gray-100 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wide text-blue-700 font-semibold">
                  {drawerTitle}
                </div>
                <div className="text-sm font-medium text-gray-900 mt-0.5 truncate">
                  {drawerSubtitle}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawer(null)}
                className="shrink-0 p-1 rounded hover:bg-gray-100 text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ul className="flex-1 overflow-y-auto p-3 space-y-2">
              {drawerVideos.map((v, i) => (
                <li key={i}>
                  <a
                    href="#"
                    className="flex items-start gap-2 p-2 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50/40"
                  >
                    <div className="shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center mt-0.5">
                      <Play className="w-3 h-3 fill-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-900 line-clamp-2 leading-snug">
                        {v.title}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <SourceBadge s={v.source} />
                        <span className="text-[10px] text-gray-500 inline-flex items-center gap-0.5">
                          <ExternalLink className="w-2.5 h-2.5" />
                          YouTube
                        </span>
                      </div>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </aside>
        </>
      )}
    </div>
  );
}
