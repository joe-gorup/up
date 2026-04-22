import { Play, ExternalLink } from "lucide-react";

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

function VideoLink({ v }: { v: Video }) {
  return (
    <a
      href="#"
      className="group inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 hover:underline whitespace-nowrap"
    >
      <Play className="w-2.5 h-2.5 fill-blue-700 text-blue-700 shrink-0" />
      <span className="truncate max-w-[220px]">{v.title}</span>
      <span
        className={
          "text-[9px] uppercase tracking-wide font-medium px-1 rounded " +
          (v.source === "golden"
            ? "text-amber-700 bg-amber-100/70"
            : "text-purple-700 bg-purple-100/70")
        }
      >
        {v.source === "golden" ? "GS" : "Emp"}
      </span>
    </a>
  );
}

export function InlineChips() {
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
          {steps.map((s) => (
            <li key={s.num} className="text-sm">
              <div className="flex gap-2">
                <span className="font-medium text-gray-500 shrink-0 w-4">
                  {s.num}.
                </span>
                <div className="flex-1">
                  <div className="text-gray-800">{s.text}</div>
                  {s.videos.length > 0 && (
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      {s.videos.map((v, i) => (
                        <VideoLink key={i} v={v} />
                      ))}
                    </div>
                  )}
                </div>
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

        {goalVideos.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className="text-[11px] uppercase tracking-wide text-gray-500 font-medium">
                Goal training
              </span>
              {goalVideos.map((v, i) => (
                <VideoLink key={i} v={v} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
