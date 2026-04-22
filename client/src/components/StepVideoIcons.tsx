import { useEffect, useState, useCallback } from 'react';
import { Video as VideoIcon } from 'lucide-react';
import { apiRequest } from '../lib/auth';

interface StepVideo {
  id: string;
  title: string;
  youtube_url: string;
}

interface Props {
  templateStepId: string | null | undefined;
  className?: string;
}

export default function StepVideoIcons({ templateStepId, className }: Props) {
  const [videos, setVideos] = useState<StepVideo[]>([]);
  const [loaded, setLoaded] = useState(false);

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

  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ''}`}>
      {videos.map((v) => (
        <a
          key={v.id}
          href={v.youtube_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title={`Watch: ${v.title}`}
          aria-label={`Watch training video: ${v.title}`}
          className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors"
          data-testid={`link-step-video-${v.id}`}
        >
          <VideoIcon className="w-3.5 h-3.5" />
        </a>
      ))}
    </span>
  );
}
