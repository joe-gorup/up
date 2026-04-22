import { Video as VideoIcon } from "lucide-react";

type Step = { num: number; text: string; videoUrl: string | null };

const steps: Step[] = [
  {
    num: 1,
    text: "Greet every customer within 5 seconds of entering",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  },
  {
    num: 2,
    text: "Recommend a flavor based on customer preference",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  },
  {
    num: 3,
    text: "Confirm order back to customer before ringing up",
    videoUrl: null,
  },
  {
    num: 4,
    text: "Hand cone/cup with napkin and a smile",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  },
];

const sessionDots = ["green", "green", "amber", "green", "grey", "amber"] as const;
const dotClass = {
  green: "bg-emerald-500",
  amber: "bg-amber-400",
  grey: "bg-gray-300",
} as const;

export function InlinePlayer() {
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
            <li key={s.num} className="text-sm">
              <div className="flex items-start gap-2">
                <span className="font-medium text-gray-500 shrink-0 w-4 leading-7">
                  {s.num}.
                </span>
                <div className="flex-1 min-w-0 leading-7 text-gray-800">
                  {s.text}
                </div>
                {s.videoUrl && (
                  <a
                    href={s.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Watch training video"
                    className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors"
                  >
                    <VideoIcon className="w-4 h-4" />
                  </a>
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
    </div>
  );
}
