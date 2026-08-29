import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, FileText, Heart, Pencil, Plus, RefreshCw, ShieldCheck, Trash2, UserCheck, X } from 'lucide-react';
import { apiRequest } from '../lib/auth';

type NotesFeedSource = 'guardian' | 'coach' | 'checkin' | 'profile';

interface NotesFeedItem {
  id: string;
  sourceType: NotesFeedSource;
  sourceId: string;
  body: string;
  title?: string | null;
  authorId: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
  updatedAt?: string | null;
  linked?: boolean;
  noteType?: string | null;
  canEdit: boolean;
  canDelete: boolean;
}

interface NotesFeedProps {
  employeeId: string;
  className?: string;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function sourceLabel(item: NotesFeedItem): string {
  if (item.sourceType === 'guardian') return 'Guardian note';
  if (item.sourceType === 'checkin') return 'Linked check-in';
  if (item.sourceType === 'profile') return 'Profile update';
  return 'Staff note';
}

function sourceIcon(item: NotesFeedItem) {
  if (item.sourceType === 'guardian') return <Heart className="h-3.5 w-3.5" aria-hidden="true" />;
  if (item.sourceType === 'checkin') return <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />;
  if (item.sourceType === 'profile') return <FileText className="h-3.5 w-3.5" aria-hidden="true" />;
  return <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />;
}

export default function NotesFeed({ employeeId, className = '' }: NotesFeedProps) {
  const [notes, setNotes] = useState<NotesFeedItem[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<NotesFeedItem | null>(null);
  const [saving, setSaving] = useState(false);

  const loadNotes = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const response = await apiRequest(`/api/scoopers/${employeeId}/notes-feed`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to load notes');
      }
      setNotes(Array.isArray(payload.notes) ? payload.notes : []);
      setCanWrite(Boolean(payload.permissions?.can_write));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load notes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [employeeId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const resetEditor = () => {
    setDraft('');
    setEditing(null);
  };

  const saveNote = async () => {
    const body = draft.trim();
    if (!body || saving) return;

    setSaving(true);
    setError('');
    try {
      const endpoint = editing
        ? `/api/scoopers/${employeeId}/notes-feed/${editing.sourceType}/${editing.sourceId}`
        : `/api/scoopers/${employeeId}/notes-feed`;
      const response = await apiRequest(endpoint, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to save note');
      }
      resetEditor();
      await loadNotes(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save note');
    } finally {
      setSaving(false);
    }
  };

  const deleteNote = async (note: NotesFeedItem) => {
    if (!window.confirm('Delete this note? This cannot be undone.')) return;

    setError('');
    try {
      const response = await apiRequest(
        `/api/scoopers/${employeeId}/notes-feed/${note.sourceType}/${note.sourceId}`,
        { method: 'DELETE' },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to delete note');
      }
      await loadNotes(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete note');
    }
  };

  const beginEdit = (note: NotesFeedItem) => {
    setEditing(note);
    setDraft(note.body);
    setError('');
  };

  return (
    <section className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-rose-50/50 px-4 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                <FileText className="h-4.5 w-4.5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-slate-900">Notes & updates</h2>
                <p className="text-xs text-slate-500">One shared timeline for the support team and family.</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => loadNotes(true)}
            disabled={loading || refreshing}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Refresh notes"
            title="Refresh notes"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="px-4 py-5 sm:px-6">
        {canWrite && (
          <div className="mb-6 rounded-xl border border-rose-100 bg-rose-50/50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <label htmlFor={`notes-feed-editor-${employeeId}`} className="text-sm font-semibold text-slate-800">
                {editing ? 'Edit your note' : 'Add a note'}
              </label>
              {editing && (
                <button
                  type="button"
                  onClick={resetEditor}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" /> Cancel
                </button>
              )}
            </div>
            <textarea
              id={`notes-feed-editor-${employeeId}`}
              value={draft}
              onChange={event => setDraft(event.target.value)}
              maxLength={10000}
              rows={editing ? 5 : 3}
              placeholder="Share an update, preference, win, or support detail..."
              className="w-full resize-y rounded-xl border border-rose-200 bg-white px-3 py-2.5 text-sm leading-6 text-slate-800 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-400">{draft.length.toLocaleString()} / 10,000</span>
              <button
                type="button"
                onClick={saveNote}
                disabled={!draft.trim() || saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {editing ? <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> : <Plus className="h-3.5 w-3.5" aria-hidden="true" />}
                {saving ? 'Saving...' : editing ? 'Update note' : 'Save note'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="space-y-4" aria-label="Loading notes">
            {[0, 1].map(index => (
              <div key={index} className="flex gap-3 animate-pulse">
                <div className="mt-1 h-8 w-8 rounded-full bg-slate-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 rounded bg-slate-100" />
                  <div className="h-16 rounded-xl bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : notes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-5 py-10 text-center">
            <FileText className="mx-auto mb-2 h-9 w-9 text-slate-300" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-600">No notes yet</p>
            <p className="mt-1 text-xs text-slate-400">
              {canWrite ? 'Add the first update to start the timeline.' : 'Updates will appear here when they are shared.'}
            </p>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute bottom-5 left-4 top-4 w-px bg-slate-200" aria-hidden="true" />
            <div className="space-y-5">
              {notes.map(note => (
                <article key={note.id} className="relative flex gap-3">
                  <div className={`relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-4 border-white shadow-sm ${
                    note.sourceType === 'guardian'
                      ? 'bg-rose-100 text-rose-600'
                      : note.sourceType === 'checkin'
                        ? 'bg-amber-100 text-amber-700'
                        : note.sourceType === 'profile'
                          ? 'bg-sky-100 text-sky-600'
                          : 'bg-indigo-100 text-indigo-600'
                  }`}>
                    {sourceIcon(note)}
                  </div>
                  <div className={`min-w-0 flex-1 rounded-xl border px-4 py-3 ${
                    note.linked
                      ? 'border-amber-100 bg-amber-50/50'
                      : 'border-slate-200 bg-white'
                  }`}>
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{note.authorName}</p>
                        <p className="text-[11px] text-slate-500">
                          {note.authorRole} <span className="px-1 text-slate-300">·</span> {sourceLabel(note)}
                        </p>
                      </div>
                      <time dateTime={note.createdAt} className="flex-shrink-0 text-[11px] font-medium text-slate-400">
                        {formatDate(note.createdAt)}
                        {note.updatedAt && note.updatedAt !== note.createdAt ? ' · edited' : ''}
                      </time>
                    </div>
                    {note.title && note.title !== 'Note' && (
                      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{note.title}</p>
                    )}
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{note.body}</p>
                    {(note.canEdit || note.canDelete) && (
                      <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-100 pt-2">
                        {note.canEdit && (
                          <button
                            type="button"
                            onClick={() => beginEdit(note)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                          >
                            <Pencil className="h-3 w-3" aria-hidden="true" /> Edit
                          </button>
                        )}
                        {note.canDelete && (
                          <button
                            type="button"
                            onClick={() => deleteNote(note)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-500 transition hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" aria-hidden="true" /> Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}