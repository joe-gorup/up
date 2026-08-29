import { useState, useEffect, useRef } from 'react';
import { ClipboardCheck, ChevronLeft, ChevronDown, ChevronRight, Plus, AlertTriangle, Upload, Download, Trash2, Paperclip, StickyNote } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../lib/auth';
import { FormFiller } from './FormsAndReviews';
import { type Employee } from '../contexts/DataContext';
import NotesFeed from './NotesFeed';

interface CheckinData {
  id: string;
  employee_id: string;
  coach_id: string;
  coach_name: string;
  checkin_date: string;
  setting: string;
  how_was_today: string;
  independence: string;
  engagement: string;
  big_win: boolean;
  big_win_type: string | null;
  challenge: string;
  safety_concern: boolean;
  safety_details: string | null;
  compared_to_last: string;
  support_helped: string;
  notes: string | null;
}

interface CoachFileData {
  id: string;
  employee_id: string;
  coach_id: string;
  coach_name: string;
  file_name: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
}

interface CoachCheckinProps {
  employeeId: string;
  employeeName: string;
  onClose: () => void;
}

interface CoachFormResponse {
  id: string;
  status: string;
  submitted_at?: string | null;
  updated_at?: string;
  template: any;
  answers: Array<{ question_id: string; value_json: any }>;
}

export function normalizeCoachCheckinPayload(data: unknown): {
  legacy: CheckinData[];
  template: any | null;
  responses: CoachFormResponse[];
} {
  const payload = data && typeof data === 'object' ? data as Record<string, unknown> : {};
  return {
    legacy: Array.isArray(payload.legacy) ? payload.legacy as CheckinData[] : [],
    template: payload.template ?? null,
    responses: Array.isArray(payload.responses) ? payload.responses as CoachFormResponse[] : [],
  };
}

type TabType = 'checkins' | 'notes' | 'files';

function formatLabel(value: string): string {
  const map: Record<string, string> = {
    work_shift: 'Work Shift', training: 'Training', event: 'Event',
    good: '👍 Good', okay: '😐 Okay', hard: '👎 Hard',
    yes: '✅ Yes', a_little_help: '🤏 A little help', a_lot_of_help: '🆘 A lot of help',
    some: '😐 Some', no: '😞 No',
    task_alone: 'Did a task alone', tried_new: 'Tried something new',
    worked_with_others: 'Worked well with others', felt_proud: 'Felt proud/confident',
    none: '❌ None', focus: '🧠 Focus', communication: '🗣️ Communication',
    transitions: '🔄 Transitions', environment: '🌪️ Environment',
    better: '⬆️ Better', same: '➡️ Same', harder: '⬇️ Harder',
    reminders: '🗣️ Reminders', visuals: '👀 Visuals', peer_help: '👥 Peer help',
    coach_help: '👤 Coach help', none_needed: '❌ None needed',
  };
  return map[value] || value;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string) {
  if (type === 'application/pdf') return '📄';
  if (type === 'text/plain') return '📝';
  if (type.includes('word')) return '📃';
  return '📎';
}

function CheckinCard({ checkin, isOwner, onDelete }: { checkin: CheckinData; isOwner: boolean; onDelete?: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
            checkin.how_was_today === 'good' ? 'bg-green-100' :
            checkin.how_was_today === 'okay' ? 'bg-yellow-100' : 'bg-red-100'
          }`}>
            {checkin.how_was_today === 'good' ? '👍' : checkin.how_was_today === 'okay' ? '😐' : '👎'}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">
              {new Date(checkin.checkin_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
            <p className="text-xs text-gray-500">
              {formatLabel(checkin.setting)} &middot; by {checkin.coach_name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            checkin.compared_to_last === 'better' ? 'bg-green-100 text-green-700' :
            checkin.compared_to_last === 'same' ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-700'
          }`}>
            {formatLabel(checkin.compared_to_last)}
          </span>
          {expanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div><span className="text-gray-500">How was today:</span> <span className="font-medium">{formatLabel(checkin.how_was_today)}</span></div>
            <div><span className="text-gray-500">Independent:</span> <span className="font-medium">{formatLabel(checkin.independence)}</span></div>
            <div><span className="text-gray-500">Engaged:</span> <span className="font-medium">{formatLabel(checkin.engagement)}</span></div>
            <div><span className="text-gray-500">Big win:</span> <span className="font-medium">{checkin.big_win ? (checkin.big_win_type ? formatLabel(checkin.big_win_type) : '🏆 Yes') : '❌ No'}</span></div>
            <div><span className="text-gray-500">Challenge:</span> <span className="font-medium">{formatLabel(checkin.challenge)}</span></div>
            <div><span className="text-gray-500">Support:</span> <span className="font-medium">{formatLabel(checkin.support_helped)}</span></div>
          </div>
          {checkin.safety_concern && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-red-700 font-medium text-xs">Safety concern reported</p>
                {checkin.safety_details && <p className="text-red-600 text-xs mt-1">{checkin.safety_details}</p>}
              </div>
            </div>
          )}
          {checkin.notes && (
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-xs text-gray-500 mb-1">Notes</p>
              <p className="text-sm text-gray-700">{checkin.notes}</p>
            </div>
          )}
          {isOwner && onDelete && (
            <div className="flex justify-end pt-1">
              <button onClick={onDelete} className="text-xs text-red-500 hover:text-red-700">Delete check-in</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ========== Files Tab ==========

function FilesTab({ employeeId, isCoachOrAdmin, userId }: { employeeId: string; isCoachOrAdmin: boolean; userId?: string }) {
  const [files, setFiles] = useState<CoachFileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchFiles(); }, [employeeId]);

  async function fetchFiles() {
    try {
      const res = await apiRequest(`/api/coach-files/${employeeId}`);
      if (res.ok) setFiles(await res.json());
    } catch (err) {
      console.error('Failed to fetch files', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || uploading) return;
    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/coach-files/${employeeId}`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      });

      if (res.ok) {
        fetchFiles();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to upload file');
      }
    } catch {
      setError('Failed to upload file');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDownload(fileId: string, fileName: string) {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/coach-files/download/${fileId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        setError('Failed to download file');
      }
    } catch { setError('Failed to download file'); }
  }

  async function handleDelete(fileId: string) {
    if (!confirm('Delete this file?')) return;
    try {
      await apiRequest(`/api/coach-files/${fileId}`, { method: 'DELETE' });
      fetchFiles();
    } catch { console.error('Failed to delete file'); }
  }

  return (
    <div>
      {isCoachOrAdmin && (
        <div className="mb-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.doc,.docx,.rtf"
            onChange={handleUpload}
            className="hidden"
            id="coach-file-upload"
          />
          <label
            htmlFor="coach-file-upload"
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
              uploading
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Uploading...' : 'Upload File'}
          </label>
          <p className="text-xs text-gray-400 mt-2">PDF, TXT, DOC, DOCX, or RTF (max 10 MB)</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-xl mb-4">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : files.length === 0 ? (
        <div className="text-center py-12">
          <Paperclip className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-1">No files uploaded yet</p>
          {isCoachOrAdmin && <p className="text-sm text-gray-400">Tap "Upload File" to add one.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {files.map(file => (
            <div key={file.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
              <span className="text-2xl">{getFileIcon(file.file_type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{file.file_name}</p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(file.file_size)} &middot; by {file.coach_name} &middot; {new Date(file.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleDownload(file.id, file.file_name)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </button>
                {file.coach_id === userId && (
                  <button
                    onClick={() => handleDelete(file.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ========== Main Component ==========

export default function CoachCheckin({ employeeId, employeeName, onClose }: CoachCheckinProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('checkins');
  const [view, setView] = useState<'list' | 'form'>('list');
  const [checkins, setCheckins] = useState<CheckinData[]>([]);
  const [template, setTemplate] = useState<any | null>(null);
  const [responses, setResponses] = useState<CoachFormResponse[]>([]);
  const [activeResponse, setActiveResponse] = useState<CoachFormResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isCoachOrAdmin = user?.role === 'Job Coach' || user?.role === 'Administrator';

  useEffect(() => {
    fetchCoachCheckins();
  }, [employeeId]);

  async function fetchCoachCheckins() {
    try {
      const res = await apiRequest(`/api/coach-checkins/${employeeId}`);
      if (res.ok) {
        const payload = normalizeCoachCheckinPayload(await res.json());
        setCheckins(payload.legacy);
        setTemplate(payload.template);
        setResponses(payload.responses);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to load check-ins');
      }
    } catch (err) {
      console.error('Failed to fetch check-ins', err);
      setError('Failed to load check-ins');
    } finally {
      setLoading(false);
    }
  }

  async function startCheckin() {
    if (!template) {
      setError('The Coach Check-In template has not been seeded yet.');
      return;
    }
    const draft = responses.find(response => response.status === 'draft');
    if (draft) {
      setActiveResponse(draft);
      setView('form');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await apiRequest('/api/form-responses', {
        method: 'POST',
        body: JSON.stringify({ template_id: template.id, employee_id: employeeId }),
      });
      if (res.ok) {
        setActiveResponse(await res.json());
        setView('form');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to start check-in');
      }
    } catch {
      setError('Failed to start check-in');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this check-in?')) return;
    try {
      await apiRequest(`/api/checkins/${id}`, { method: 'DELETE' });
      fetchCoachCheckins();
    } catch (err) {
      console.error('Failed to delete', err);
    }
  }

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'checkins', label: 'Check-Ins', icon: ClipboardCheck },
    { id: 'notes', label: 'Notes', icon: StickyNote },
    { id: 'files', label: 'Files', icon: Paperclip },
  ];

  return (
    <div className="p-3 sm:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-900">Coach Notes & Files</h2>
          <p className="text-sm text-gray-500">{employeeName}</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); if (tab.id === 'checkins') setView('list'); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'checkins' && (
        <>
          {view === 'list' && (
            <div>
              {isCoachOrAdmin && (
                <button
                  onClick={startCheckin}
                  disabled={saving || !template}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors mb-4 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  {saving ? 'Starting…' : 'New Check-In'}
                </button>
              )}
              {error && <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600"><AlertTriangle className="h-4 w-4 flex-shrink-0" />{error}</div>}
              {loading ? (
                <div className="text-center py-12 text-gray-400">Loading...</div>
              ) : checkins.length === 0 && responses.length === 0 ? (
                <div className="text-center py-12">
                  <ClipboardCheck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-1">No check-ins yet</p>
                  {isCoachOrAdmin && <p className="text-sm text-gray-400">{template ? 'Tap "New Check-In" to record the first one.' : 'The Coach Check-In template has not been seeded yet.'}</p>}
                </div>
              ) : (
                <div className="space-y-4">
                  {responses.filter(response => response.status === 'draft').map(response => (
                    <div key={response.id} className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <div><p className="text-sm font-semibold text-amber-900">Draft check-in</p><p className="text-xs text-amber-800">Continue where you left off</p></div>
                      <button type="button" onClick={() => { setActiveResponse(response); setView('form'); }} className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700">Continue</button>
                    </div>
                  ))}
                  {responses.filter(response => response.status === 'submitted').map(response => (
                    <button key={response.id} type="button" onClick={() => { setActiveResponse(response); setView('form'); }} className="flex w-full items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 text-left hover:bg-emerald-50">
                      <div><p className="text-sm font-semibold text-gray-900">Coach Check-In</p><p className="text-xs text-emerald-700">Submitted · {response.submitted_at ? new Date(response.submitted_at).toLocaleDateString() : 'read only'}</p></div>
                      <span className="text-xs font-semibold text-emerald-800">View</span>
                    </button>
                  ))}
                  {checkins.length > 0 && <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Legacy check-in history</p>}
                  {checkins.map(checkin => (
                    <CheckinCard key={checkin.id} checkin={checkin} isOwner={checkin.coach_id === user?.id} onDelete={() => handleDelete(checkin.id)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'form' && activeResponse && (
            <FormFiller
              response={activeResponse as any}
              employee={{ first_name: employeeName, last_name: '' } as Pick<Employee, 'first_name' | 'last_name'>}
              allowAdminEditSubmitted={false}
              onClose={() => { setActiveResponse(null); setView('list'); fetchCoachCheckins(); }}
              onComplete={() => { setActiveResponse(null); setView('list'); fetchCoachCheckins(); }}
            />
          )}
        </>
      )}

      {activeTab === 'notes' && (
        <NotesFeed employeeId={employeeId} />
      )}

      {activeTab === 'files' && (
        <FilesTab employeeId={employeeId} isCoachOrAdmin={isCoachOrAdmin} userId={user?.id} />
      )}
    </div>
  );
}

export function LatestCheckinBadge({ checkin }: { checkin: CheckinData }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`w-6 h-6 rounded-full flex items-center justify-center ${
        checkin.how_was_today === 'good' ? 'bg-green-100' :
        checkin.how_was_today === 'okay' ? 'bg-yellow-100' : 'bg-red-100'
      }`}>
        {checkin.how_was_today === 'good' ? '👍' : checkin.how_was_today === 'okay' ? '😐' : '👎'}
      </span>
      <span className="text-gray-500">
        {new Date(checkin.checkin_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </span>
      <span className={`px-1.5 py-0.5 rounded-full ${
        checkin.compared_to_last === 'better' ? 'bg-green-100 text-green-700' :
        checkin.compared_to_last === 'same' ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-700'
      }`}>
        {checkin.compared_to_last === 'better' ? '⬆️' : checkin.compared_to_last === 'same' ? '➡️' : '⬇️'}
      </span>
    </div>
  );
}
