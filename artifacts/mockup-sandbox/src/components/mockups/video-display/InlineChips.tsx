import React from "react";
import { Play, CheckCircle2, Circle, MoreHorizontal, Video, ExternalLink } from "lucide-react";

interface VideoData {
  id: string;
  title: string;
  source: "Golden Scoop" | "Employer";
  thumbnailSeed: string;
}

const STEP_1_VIDEOS: VideoData[] = [
  {
    id: "v1",
    title: "Greeting customers — first 30 seconds matter",
    source: "Golden Scoop",
    thumbnailSeed: "video1",
  },
  {
    id: "v2",
    title: "Handling indecisive customers",
    source: "Employer",
    thumbnailSeed: "video2",
  },
];

const STEP_2_VIDEOS: VideoData[] = [
  {
    id: "v3",
    title: "How to suggest flavors without being pushy",
    source: "Golden Scoop",
    thumbnailSeed: "video3",
  },
];

const STEP_4_VIDEOS: VideoData[] = [
  {
    id: "v4",
    title: "Cone vs cup: matching the order",
    source: "Employer",
    thumbnailSeed: "video4",
  },
  {
    id: "v5",
    title: "Napkin etiquette and the friendly handoff",
    source: "Golden Scoop",
    thumbnailSeed: "video5",
  },
  {
    id: "v6",
    title: "Reading body language",
    source: "Employer",
    thumbnailSeed: "video6",
  },
];

const GOAL_VIDEOS: VideoData[] = [
  {
    id: "g1",
    title: "End-to-end customer service walkthrough",
    source: "Golden Scoop",
    thumbnailSeed: "goaltraining1",
  },
  {
    id: "g2",
    title: "Body language fundamentals",
    source: "Employer",
    thumbnailSeed: "goaltraining2",
  },
];

function VideoChip({ video, size = "sm" }: { video: VideoData; size?: "sm" | "md" }) {
  const w = size === "sm" ? "w-24" : "w-32";
  const h = size === "sm" ? "h-14" : "h-20";
  const bgBadge =
    video.source === "Golden Scoop"
      ? "bg-amber-100 text-amber-700"
      : "bg-purple-100 text-purple-700";

  return (
    <div className="group relative flex flex-col shrink-0">
      <div
        className={`${w} ${h} rounded-md bg-gray-200 overflow-hidden relative border border-gray-200 cursor-pointer hover:ring-2 ring-blue-500 ring-offset-1 transition-all`}
        style={{
          backgroundImage: `url(https://picsum.photos/seed/${video.thumbnailSeed}/240/135)`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
        <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] px-1 rounded-sm backdrop-blur-sm truncate max-w-[80%]">
          {video.title}
        </div>
        <div className="absolute inset-0 flex items-center justify-center opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all">
          <div className="bg-black/60 rounded-full p-1 backdrop-blur-sm">
            <Play className="w-3 h-3 text-white fill-white ml-[1px]" />
          </div>
        </div>
      </div>

      {/* Hover Popover */}
      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 bg-white border border-gray-200 shadow-lg rounded-lg p-3 opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-10 scale-95 group-hover:scale-100 origin-bottom">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-900 leading-tight">
            {video.title}
          </p>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded w-fit ${bgBadge}`}>
            {video.source}
          </span>
        </div>
        {/* Tooltip arrow */}
        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-b border-r border-gray-200 transform rotate-45" />
      </div>
    </div>
  );
}

function ChipStrip({ videos, size = "sm" }: { videos: VideoData[]; size?: "sm" | "md" }) {
  if (videos.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {videos.map((v) => (
        <VideoChip key={v.id} video={v} size={size} />
      ))}
    </div>
  );
}

export function InlineChips() {
  return (
    <div className="min-h-screen bg-gray-50 p-6 flex items-start justify-center">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 w-full max-w-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-lg font-semibold text-gray-900">
                Customer Service Excellence
              </h2>
              <span className="bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full border border-blue-100">
                In Progress
              </span>
            </div>
            <p className="text-sm text-gray-500">
              Assigned by Sarah Manager • Last updated 2 days ago
            </p>
          </div>
          <button className="text-gray-400 hover:text-gray-600">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>

        {/* Recent Sessions */}
        <div className="px-5 py-3 border-b border-gray-50 bg-gray-50/50 flex items-center gap-3">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Recent Sessions
          </span>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 ring-4 ring-green-50" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 ring-4 ring-green-50" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 ring-4 ring-amber-50" />
            <div className="w-2.5 h-2.5 rounded-full bg-gray-300 ring-4 ring-gray-50" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 ring-4 ring-green-50" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 ring-4 ring-green-50" />
          </div>
        </div>

        {/* Steps */}
        <div className="p-5 flex flex-col gap-6">
          {/* Step 1 */}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <CheckCircle2 className="w-5 h-5 text-gray-300" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                1. Greet every customer within 5 seconds of entering
              </p>
              <ChipStrip videos={STEP_1_VIDEOS} />
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <Circle className="w-5 h-5 text-gray-300" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                2. Recommend a flavor based on customer preference
              </p>
              <ChipStrip videos={STEP_2_VIDEOS} />
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <Circle className="w-5 h-5 text-gray-300" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                3. Confirm order back to customer before ringing up
              </p>
              {/* No videos */}
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <Circle className="w-5 h-5 text-gray-300" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                4. Hand cone/cup with napkin and a smile
              </p>
              <ChipStrip videos={STEP_4_VIDEOS} />
            </div>
          </div>
        </div>

        {/* Goal-level Videos */}
        <div className="bg-gray-50 border-t border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Video className="w-4 h-4 text-gray-500" />
            <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Goal Training Videos
            </h3>
          </div>
          <ChipStrip videos={GOAL_VIDEOS} size="md" />
        </div>
      </div>
    </div>
  );
}
