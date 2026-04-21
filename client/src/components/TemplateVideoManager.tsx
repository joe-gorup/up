import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Video as VideoIcon, ExternalLink, X, Pencil, Archive, Save } from 'lucide-react';
import { apiRequest } from '../lib/auth';
import { useAuth } from '../contexts/AuthContext';

export interface TemplateVideo {
  id: string;
  title: string;
  description: string | null;
  youtube_url: string;
  source: 'golden_scoop' | 'employer';
  status: 'active' | 'archived';
  created_by: string | null;
  created_at: string;
  display_order?: number;
  link_id?: string;
}

interface Props {
  // Either templateId (template-level) or stepId (step-level) must be provided.
  templateId?: string;
  stepId?: string;
  // When 'admin', user can add golden_scoop videos. When 'coach', user can only add employer videos.
  mode: 'admin' | 'coach' | 'view';
  compact?: boolean;
  // Override the section heading; defaults to "Training Videos".
  heading?: string;
}

function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export default function TemplateVideoManager({ templateId, stepId, mode, compact = false, heading }: Props) {
  const { user } = useAuth();
  const [videos, setVideos] = useState<TemplateVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', description: '', youtube_url: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', youtube_url: '' });

  const scope: 'template' | 'step' | null = stepId ? 'step' : (templateId ? 'template' : null);
  const scopeId = stepId ?? templateId ?? '';

  const load = useCallback(async () => {
    if (!scope) return;
    setLoading(true);
    try {
      const param = scope === 'step' ? 'template_step_id' : 'template_id';
      const res = await apiRequest(`/api/videos?${param}=${encodeURIComponent(scopeId)}`);
      if (res.ok) {
        const data = await res.json();
        setVideos(data);
      }
    } catch (e) {
      console.error('Failed to load videos', e);
    } finally {
      setLoading(false);
    }
  }, [scope, scopeId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    setError('');
    if (!form.title.trim() || !form.youtube_url.trim()) {
      setError('Title and YouTube URL are required');
      return;
    }
    if (!getYouTubeId(form.youtube_url)) {
      setError('Please enter a valid YouTube URL');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          youtube_url: form.youtube_url.trim(),
          source: mode === 'admin' ? 'golden_scoop' : 'employer',
          ...(scope === 'template' ? { template_id: scopeId } : { template_step_id: scopeId }),
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        setError(txt || 'Failed to add video');
        return;
      }
      setForm({ title: '', description: '', youtube_url: '' });
      setShowForm(false);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to add video');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (videoId: string) => {
    const label = scope === 'step' ? 'this step' : 'the goal';
    if (!confirm(`Remove this video from ${label}?`)) return;
    try {
      const url = scope === 'step'
        ? `/api/goal-template-steps/${scopeId}/videos/${videoId}`
        : `/api/goal-templates/${scopeId}/videos/${videoId}`;
      const res = await apiRequest(url, { method: 'DELETE' });
      if (res.ok) await load();
    } catch (e) {
      console.error('Failed to remove video', e);
    }
  };

  const startEdit = (v: TemplateVideo) => {
    setEditingId(v.id);
    setEditForm({ title: v.title, description: v.description ?? '', youtube_url: v.youtube_url });
    setError('');
  };

  const handleSaveEdit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!editingId) return;
    setError('');
    if (!editForm.title.trim() || !editForm.youtube_url.trim()) {
      setError('Title and YouTube URL are required');
      return;
    }
    if (!getYouTubeId(editForm.youtube_url)) {
      setError('Please enter a valid YouTube URL');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest(`/api/videos/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title.trim(),
          description: editForm.description.trim() || null,
          youtube_url: editForm.youtube_url.trim(),
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        setError(txt || 'Failed to update video');
        return;
      }
      setEditingId(null);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to update video');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (v: TemplateVideo) => {
    if (!confirm(`Archive "${v.title}" for everyone? It will no longer appear on any goal.`)) return;
    try {
      const res = await apiRequest(`/api/videos/${v.id}`, { method: 'DELETE' });
      if (res.ok) await load();
    } catch (e) {
      console.error('Failed to archive video', e);
    }
  };

  const canAdd = mode !== 'view';
  const canRemove = (v: TemplateVideo) =>
    user?.role === 'Administrator' || (mode === 'coach' && v.created_by === user?.id);
  const canEdit = (v: TemplateVideo) =>
    user?.role === 'Administrator' || v.created_by === user?.id;
  const canArchive = (v: TemplateVideo) =>
    user?.role === 'Administrator' || v.created_by === user?.id;

  return (
    <div className={compact ? 'mt-3' : 'bg-white rounded-xl shadow-sm border border-gray-200 p-6'}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <VideoIcon className="h-4 w-4 text-blue-600" />
          <h3 className={compact ? 'text-sm font-semibold text-gray-800' : 'text-lg font-semibold text-gray-900'}>
            {heading ?? 'Training Videos'} {videos.length > 0 && <span className="text-gray-400 font-normal">({videos.length})</span>}
          </h3>
        </div>
        {canAdd && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Video
          </button>
        )}
      </div>

      {showForm && (
        <div
          role="group"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') { e.preventDefault(); handleAdd(); } }}
          className="mb-4 p-3 border border-gray-200 rounded-xl bg-gray-50 space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700">
              {mode === 'admin' ? 'New Golden Scoop Video' : 'New Employer Video'}
            </span>
            <button type="button" onClick={() => { setShowForm(false); setError(''); }} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <input
            type="text"
            placeholder="Video title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <input
            type="url"
            placeholder="YouTube URL (e.g. https://youtu.be/...)"
            value={form.youtube_url}
            onChange={(e) => setForm({ ...form, youtube_url: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <textarea
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setShowForm(false); setError(''); }} className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="button" onClick={(e) => handleAdd(e)} disabled={submitting} className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {submitting ? 'Adding…' : 'Add Video'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading videos…</p>
      ) : videos.length === 0 ? (
        <p className="text-sm text-gray-500">No videos attached yet.</p>
      ) : (
        <ul className="space-y-2">
          {videos.map((v) => {
            const ytId = getYouTubeId(v.youtube_url);
            const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null;
            const isEditing = editingId === v.id;
            return (
              <li key={v.id} className="p-2 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors" data-testid={`video-item-${v.id}`}>
                {isEditing ? (
                  <div
                    role="group"
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') { e.preventDefault(); handleSaveEdit(); } }}
                    className="space-y-2"
                  >
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      placeholder="Video title"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      data-testid={`input-edit-title-${v.id}`}
                    />
                    <input
                      type="url"
                      value={editForm.youtube_url}
                      onChange={(e) => setEditForm({ ...editForm, youtube_url: e.target.value })}
                      placeholder="YouTube URL"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      data-testid={`input-edit-url-${v.id}`}
                    />
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      rows={2}
                      placeholder="Description (optional)"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    {error && <p className="text-xs text-red-600">{error}</p>}
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => { setEditingId(null); setError(''); }} className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                        Cancel
                      </button>
                      <button type="button" onClick={(e) => handleSaveEdit(e)} disabled={submitting} data-testid={`button-save-edit-${v.id}`} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                        <Save className="h-3.5 w-3.5" />
                        {submitting ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    {thumb ? (
                      <a href={v.youtube_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        <img src={thumb} alt="" className="w-24 h-14 object-cover rounded-md border border-gray-200" />
                      </a>
                    ) : (
                      <div className="w-24 h-14 bg-gray-100 rounded-md flex items-center justify-center shrink-0">
                        <VideoIcon className="h-5 w-5 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <a href={v.youtube_url} target="_blank" rel="noopener noreferrer"
                         className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline break-words">
                        {v.title}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded ${v.source === 'golden_scoop' ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700'}`}>
                          {v.source === 'golden_scoop' ? 'Golden Scoop' : 'Employer'}
                        </span>
                      </div>
                      {v.description && <p className="text-xs text-gray-600 mt-1">{v.description}</p>}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {canEdit(v) && (
                        <button
                          type="button"
                          onClick={() => startEdit(v)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Edit video"
                          data-testid={`button-edit-${v.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {canArchive(v) && (
                        <button
                          type="button"
                          onClick={() => handleArchive(v)}
                          className="p-1.5 text-gray-400 hover:text-orange-600 transition-colors"
                          title="Archive video (removes from all goals)"
                          data-testid={`button-archive-${v.id}`}
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      )}
                      {canRemove(v) && (
                        <button
                          type="button"
                          onClick={() => handleRemove(v.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                          title="Remove from this goal only"
                          data-testid={`button-remove-${v.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
