import React from "react";
import { Play, Video, ChevronRight, CheckCircle2, Circle, Clock } from "lucide-react";

interface VideoData {
  id: string;
  title: string;
  thumbnail: string;
  source: "Golden Scoop" | "Employer";
  duration: string;
}

const step1Videos: VideoData[] = [
  {
    id: "v1",
    title: "Greeting customers — first 30 seconds matter",
    thumbnail: "https://picsum.photos/seed/video1/240/135",
    source: "Golden Scoop",
    duration: "2:15",
  },
  {
    id: "v2",
    title: "Body language fundamentals",
    thumbnail: "https://picsum.photos/seed/video7/240/135",
    source: "Employer",
    duration: "4:30",
  },
];

const step2Videos: VideoData[] = [
  {
    id: "v3",
    title: "How to suggest flavors without being pushy",
    thumbnail: "https://picsum.photos/seed/video2/240/135",
    source: "Golden Scoop",
    duration: "3:45",
  },
];

const step4Videos: VideoData[] = [
  {
    id: "v4",
    title: "Cone vs cup: matching the order",
    thumbnail: "https://picsum.photos/seed/video4/240/135",
    source: "Golden Scoop",
    duration: "1:50",
  },
  {
    id: "v5",
    title: "Napkin etiquette and the friendly handoff",
    thumbnail: "https://picsum.photos/seed/video5/240/135",
    source: "Employer",
    duration: "2:10",
  },
  {
    id: "v6",
    title: "Handling indecisive customers",
    thumbnail: "https://picsum.photos/seed/video3/240/135",
    source: "Golden Scoop",
    duration: "3:20",
  },
];

const goalVideos: VideoData[] = [
  {
    id: "v7",
    title: "End-to-end customer service walkthrough",
    thumbnail: "https://picsum.photos/seed/video6/320/180",
    source: "Golden Scoop",
    duration: "8:45",
  },
  {
    id: "v8",
    title: "Handling difficult scenarios gracefully",
    thumbnail: "https://picsum.photos/seed/video8/320/180",
    source: "Employer",
    duration: "5:20",
  },
];

function SourceBadge({ source }: { source: "Golden Scoop" | "Employer" }) {
  if (source === "Golden Scoop") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
        Golden Scoop
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">
      Employer
    </span>
  );
}

function VideoCard({
  video,
  isPlaying = false,
  size = "sm",
}: {
  video: VideoData;
  isPlaying?: boolean;
  size?: "sm" | "md";
}) {
  const width = size === "sm" ? "w-[200px]" : "w-[280px]";
  const height = size === "sm" ? "h-[112px]" : "h-[157px]"; // 16:9 approx

  return (
    <div className={`flex flex-col gap-2 shrink-0 ${width}`}>
      <div
        className={`relative rounded-md overflow-hidden bg-gray-900 group cursor-pointer ${height}`}
      >
        {isPlaying ? (
          <>
            <img
              src={video.thumbnail}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-8 bg-red-600 rounded-lg flex items-center justify-center shadow-lg">
                <Play className="w-5 h-5 text-white fill-white" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-600/50">
              <div className="h-full bg-red-600 w-1/3"></div>
            </div>
          </>
        ) : (
          <>
            <img
              src={video.thumbnail}
              alt={video.title}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-sm backdrop-blur-sm">
                <Play className="w-4 h-4 text-gray-900 fill-gray-900 ml-0.5" />
              </div>
            </div>
            <div className="absolute bottom-1.5 right-1.5 px-1 py-0.5 bg-black/80 rounded text-[10px] font-medium text-white tracking-wide">
              {video.duration}
            </div>
          </>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <h4 className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">
          {video.title}
        </h4>
        <div className="flex items-center">
          <SourceBadge source={video.source} />
        </div>
      </div>
    </div>
  );
}

function EmptyVideoCard() {
  return (
    <div className="flex flex-col justify-center shrink-0 w-[200px] h-[112px] border-2 border-dashed border-gray-200 rounded-md bg-gray-50 items-center text-center p-4">
      <Video className="w-6 h-6 text-gray-400 mb-2" strokeWidth={1.5} />
      <span className="text-xs text-gray-500 font-medium">No videos for this step yet</span>
    </div>
  );
}

function VideoCarousel({ videos, firstIsPlaying = false, empty = false }: { videos: VideoData[]; firstIsPlaying?: boolean; empty?: boolean }) {
  return (
    <div className="flex overflow-x-auto gap-4 pb-2 pt-1 scrollbar-hide snap-x -mx-1 px-1">
      {empty ? (
        <EmptyVideoCard />
      ) : (
        videos.map((video, idx) => (
          <div key={video.id} className="snap-start">
            <VideoCard video={video} isPlaying={firstIsPlaying && idx === 0} />
          </div>
        ))
      )}
    </div>
  );
}

export function InlinePlayer() {
  return (
    <div className="min-h-screen bg-gray-50 p-6 flex items-start justify-center font-sans">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-semibold text-gray-900">Customer Service Excellence</h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                  In Progress
                </span>
              </div>
              <p className="text-sm text-gray-500">Master the perfect Golden Scoop customer interaction.</p>
            </div>
          </div>

          {/* Recent Sessions */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Recent Sessions</span>
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" title="Pass" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" title="Pass" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" title="Needs Work" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" title="Pass" />
              <div className="w-2.5 h-2.5 rounded-full bg-gray-300" title="Missed" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" title="Pass" />
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Evaluation Steps</h3>
          <div className="space-y-8">
            
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="flex-none flex flex-col items-center">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">1</div>
                <div className="w-px h-full bg-gray-200 mt-2"></div>
              </div>
              <div className="flex-1 pb-2 min-w-0">
                <p className="text-sm font-medium text-gray-900 mb-3 mt-0.5">Greet every customer within 5 seconds of entering</p>
                <VideoCarousel videos={step1Videos} firstIsPlaying={true} />
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="flex-none flex flex-col items-center">
                <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center text-xs font-bold">2</div>
                <div className="w-px h-full bg-gray-200 mt-2"></div>
              </div>
              <div className="flex-1 pb-2 min-w-0">
                <p className="text-sm font-medium text-gray-900 mb-3 mt-0.5">Recommend a flavor based on customer preference</p>
                <VideoCarousel videos={step2Videos} />
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4">
              <div className="flex-none flex flex-col items-center">
                <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center text-xs font-bold">3</div>
                <div className="w-px h-full bg-gray-200 mt-2"></div>
              </div>
              <div className="flex-1 pb-2 min-w-0">
                <p className="text-sm font-medium text-gray-900 mb-3 mt-0.5">Confirm order back to customer before ringing up</p>
                <VideoCarousel videos={[]} empty={true} />
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-4">
              <div className="flex-none flex flex-col items-center">
                <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center text-xs font-bold">4</div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 mb-3 mt-0.5">Hand cone/cup with napkin and a smile</p>
                <VideoCarousel videos={step4Videos} />
              </div>
            </div>

          </div>
        </div>

        {/* Goal level videos */}
        <div className="bg-gray-50/80 p-6 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Video className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">Goal Training Videos</h3>
          </div>
          <div className="flex overflow-x-auto gap-4 pb-2 pt-1 scrollbar-hide snap-x -mx-1 px-1">
            {goalVideos.map((video, idx) => (
              <div key={video.id} className="snap-start">
                <VideoCard video={video} size="md" isPlaying={idx === 0} />
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
