import React, { useState } from "react";
import { Play, ExternalLink, X, Video } from "lucide-react";

interface VideoData {
  id: string;
  title: string;
  source: "Golden Scoop" | "Employer";
  thumbnailSeed: string;
}

const steps = [
  {
    id: 1,
    text: "Greet every customer within 5 seconds of entering",
    videos: [
      {
        id: "v1",
        title: "Greeting customers — first 30 seconds matter",
        source: "Golden Scoop",
        thumbnailSeed: "video1",
      },
      {
        id: "v2",
        title: "Body language fundamentals",
        source: "Employer",
        thumbnailSeed: "video2",
      },
    ] as VideoData[],
  },
  {
    id: 2,
    text: "Recommend a flavor based on customer preference",
    videos: [
      {
        id: "v3",
        title: "How to suggest flavors without being pushy",
        source: "Golden Scoop",
        thumbnailSeed: "video3",
      },
    ] as VideoData[],
  },
  {
    id: 3,
    text: "Confirm order back to customer before ringing up",
    videos: [] as VideoData[],
  },
  {
    id: 4,
    text: "Hand cone/cup with napkin and a smile",
    videos: [
      {
        id: "v4",
        title: "Cone vs cup: matching the order",
        source: "Golden Scoop",
        thumbnailSeed: "video4",
      },
      {
        id: "v5",
        title: "Napkin etiquette and the friendly handoff",
        source: "Employer",
        thumbnailSeed: "video5",
      },
      {
        id: "v6",
        title: "Handling indecisive customers",
        source: "Golden Scoop",
        thumbnailSeed: "video6",
      },
    ] as VideoData[],
  },
];

const goalVideos: VideoData[] = [
  {
    id: "g1",
    title: "End-to-end customer service walkthrough",
    source: "Golden Scoop",
    thumbnailSeed: "goal1",
  },
  {
    id: "g2",
    title: "Body language fundamentals",
    source: "Employer",
    thumbnailSeed: "goal2",
  },
];

const recentSessions = ["green", "green", "amber", "green", "grey", "green"];

function PillButton({
  count,
  onClick,
  isGoalLevel = false,
}: {
  count: number;
  onClick?: () => void;
  isGoalLevel?: boolean;
}) {
  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm
        ${
          isGoalLevel
            ? "px-3 py-1.5 text-sm text-gray-700"
            : "px-2.5 py-1 text-xs text-gray-600"
        }
      `}
    >
      <Play
        className={`fill-blue-600 text-blue-600 ${
          isGoalLevel ? "h-4 w-4" : "h-3.5 w-3.5"
        }`}
      />
      <span className="font-medium">
        Watch {isGoalLevel ? "goal training " : ""}({count})
      </span>
    </button>
  );
}

function SourceBadge({ source }: { source: "Golden Scoop" | "Employer" }) {
  if (source === "Golden Scoop") {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
        Golden Scoop
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
        Employer
      </span>
  );
}

function VideoListItem({ video }: { video: VideoData }) {
  return (
    <div className="flex gap-4 p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors group">
      <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-md bg-gray-100">
        <img
          src={`https://picsum.photos/seed/${video.thumbnailSeed}/240/135`}
          alt={video.title}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm">
            <Play className="h-4 w-4 translate-x-0.5 fill-blue-600 text-blue-600" />
          </div>
        </div>
      </div>
      <div className="flex flex-col justify-center min-w-0 flex-1">
        <h4 className="text-sm font-medium text-gray-900 truncate mb-1">
          {video.title}
        </h4>
        <div className="flex items-center gap-3">
          <SourceBadge source={video.source} />
          <a
            href="#"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Open on YouTube
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

export function WatchPill() {
  return (
    <div className="min-h-screen bg-gray-50 p-6 flex items-start justify-center font-sans">
      {/* Container */}
      <div className="relative w-full max-w-2xl">
        {/* The Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Customer Service Excellence
                  </h2>
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                    In Progress
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-3">
                  <span className="text-xs text-gray-500 font-medium mr-1">
                    Recent:
                  </span>
                  {recentSessions.map((status, i) => (
                    <div
                      key={i}
                      className={`h-2 w-2 rounded-full ${
                        status === "green"
                          ? "bg-green-500"
                          : status === "amber"
                          ? "bg-amber-400"
                          : "bg-gray-300"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <PillButton count={goalVideos.length} isGoalLevel={true} />
            </div>
          </div>

          {/* Steps */}
          <div className="p-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Goal Steps
            </h3>
            <div className="space-y-4">
              {steps.map((step) => (
                <div key={step.id} className="flex items-start gap-3 group">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                    {step.id}
                  </div>
                  <div className="flex-1 flex items-start justify-between gap-4 pt-0.5">
                    <p className="text-sm text-gray-700 leading-tight">
                      {step.text}
                    </p>
                    {step.videos.length > 0 && (
                      <div className="shrink-0 transition-opacity">
                        <PillButton count={step.videos.length} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Statically rendered open modal overlay to show the hypothesis */}
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-xl bg-gray-900/40 backdrop-blur-[1px]">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 m-4">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2 text-gray-900">
                <Video className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-base">
                  Watch Step Training
                </h3>
              </div>
              <button className="rounded-full p-1.5 text-gray-400 hover:text-gray-500 hover:bg-gray-100 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-5">
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold text-gray-900">Step 1:</span>{" "}
                  Greet every customer within 5 seconds of entering
                </p>
              </div>
              
              <div className="flex flex-col gap-3">
                {steps[0].videos.map((video) => (
                  <VideoListItem key={video.id} video={video} />
                ))}
              </div>
            </div>
            
            <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
