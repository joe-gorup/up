import { useEffect, useState, useCallback } from 'react';
import { Video as VideoIcon, X, ExternalLink } from 'lucide-react';
import { apiRequest } from '../lib/auth';

interface StepVideo {
  id: string;
  title: string;
  description: string | null;
  youtube_url: string;
  source: 'golden_scoop' | 'employer';
}

interface Props {
  templateStepId: string | null | undefined;
  stepLabel?: string;
}

function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/
  );
  return m ? m[1] : null;
}

export default function StepVideosButton({ templateStepId, stepLabel }: Props) {
  const [videos, setVideos] = useState<StepVideo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const load = useCallback(async () => {
    if (!templateStepId) {
      setLoaded(true);
      return;
    }
    try {
      const res = await apiRequest(
        `/api/videos?template_step_id=${encodeURIComponent(templateStepId)}`
      );
      if (res.ok) {
        const data: StepVideo[] = await res.json();
        setVideos(data);
      }
    } catch (e) {
      console.error('Failed to load step videos', e);
    } finally {
      setLoaded(true);
    }
  }, [templateStepId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!loaded || videos.length === 0) return null;

  const active = videos[activeIdx];
  const ytId = active ? getYouTubeId(active.youtube_url) : null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setActiveIdx(0);
          setOpen(true);
        }}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
        data-testid={`button-watch-video-${templateStepId}`}
        title="Watch training video for this step"
      >
        <VideoIcon className="h-3.5 w-3.5" />
        <span>Watch video{videos.length > 1 ? `s (${videos.length})` : ''}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
          data-testid={`modal-step-videos-${templateStepId}`}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-gray-900 truncate">
                  {active?.title ?? 'Training Video'}
                </h3>
                {stepLabel && (
                  <p className="text-xs text-gray-500 truncate">{stepLabel}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
                aria-label="Close"
                data-testid="button-close-step-videos"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {ytId ? (
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    key={active.id}
                    src={`https://www.youtube.com/embed/${ytId}`}
                    title={active.title}
                    className="absolute inset-0 w-full h-full rounded-lg border border-gray-200"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <a
                  href={active?.youtube_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                >
                  Open video <ExternalLink className="h-3 w-3" />
                </a>
              )}

              {active?.description && (
                <p className="text-sm text-gray-700">{active.description}</p>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-block text-[10px] px-1.5 py-0.5 rounded ${
                    active?.source === 'golden_scoop'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-purple-100 text-purple-700'
                  }`}
                >
                  {active?.source === 'golden_scoop' ? 'Golden Scoop' : 'Employer'}
                </span>
                <a
                  href={active?.youtube_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline"
                >
                  Open on YouTube <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              {videos.length > 1 && (
                <div className="border-t border-gray-200 pt-3">
                  <p className="text-xs font-medium text-gray-700 mb-2">
                    More videos for this step ({videos.length})
                  </p>
                  <ul className="space-y-1">
                    {videos.map((v, i) => {
                      const tId = getYouTubeId(v.youtube_url);
                      const thumb = tId
                        ? `https://img.youtube.com/vi/${tId}/mqdefault.jpg`
                        : null;
                      return (
                        <li key={v.id}>
                          <button
                            type="button"
                            onClick={() => setActiveIdx(i)}
                            className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${
                              i === activeIdx
                                ? 'bg-blue-50 border border-blue-200'
                                : 'hover:bg-gray-50 border border-transparent'
                            }`}
                            data-testid={`button-select-video-${v.id}`}
                          >
                            {thumb ? (
                              <img
                                src={thumb}
                                alt=""
                                className="w-20 h-12 object-cover rounded border border-gray-200 shrink-0"
                              />
                            ) : (
                              <div className="w-20 h-12 bg-gray-100 rounded flex items-center justify-center shrink-0">
                                <VideoIcon className="h-4 w-4 text-gray-400" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {v.title}
                              </p>
                              <span
                                className={`inline-block text-[10px] px-1.5 py-0.5 rounded ${
                                  v.source === 'golden_scoop'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-purple-100 text-purple-700'
                                }`}
                              >
                                {v.source === 'golden_scoop' ? 'Golden Scoop' : 'Employer'}
                              </span>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
