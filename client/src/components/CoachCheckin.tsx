import { useState, useEffect, useRef } from 'react';
import { ClipboardCheck, ChevronLeft, ChevronDown, ChevronRight, Plus, AlertTriangle, FileText, Upload, Download, Trash2, Edit, X, Save, Paperclip, StickyNote } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../lib/auth';
import RichTextEditor, { RichTextViewer } from './RichTextEditor';

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

interface CoachNoteData {
  id: string;
  employee_id: string;
  coach_id: string;
  coach_name: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface CoachCheckinProps {
  employeeId: string;
  employeeName: string;
  onClose: () => void;
}

type TabType = 'checkins' | 'notes' | 'files';

const SETTING_OPTIONS = [
  { value: 'work_shift', label: 'Work Shift' },
  { value: 'training', label: 'Training' },
  { value: 'event', label: 'Event' },
];

const TODAY_OPTIONS = [
  { value: 'good', label: 'Good', icon: '👍' },
  { value: 'okay', label: 'Okay', icon: '😐' },
  { value: 'hard', label: 'Hard', icon: '👎' },
];

const INDEPENDENCE_OPTIONS = [
  { value: 'yes', label: 'Yes', icon: '✅' },
  { value: 'a_little_help', label: 'A little help', icon: '🤏' },
  { value: 'a_lot_of_help', label: 'A lot of help', icon: '🆘' },
];

const ENGAGEMENT_OPTIONS = [
  { value: 'yes', label: 'Yes', icon: '😀' },
  { value: 'some', label: 'Some', icon: '😐' },
  { value: 'no', label: 'No', icon: '😞' },
];

const WIN_TYPE_OPTIONS = [
  { value: 'task_alone', label: 'Did a task alone' },
  { value: 'tried_new', label: 'Tried something new' },
  { value: 'worked_with_others', label: 'Worked well with others' },
  { value: 'felt_proud', label: 'Felt proud/confident' },
];

const CHALLENGE_OPTIONS = [
  { value: 'none', label: 'None', icon: '❌' },
  { value: 'focus', label: 'Focus', icon: '🧠' },
  { value: 'communication', label: 'Communication', icon: '🗣️' },
  { value: 'transitions', label: 'Transitions', icon: '🔄' },
  { value: 'environment', label: 'Environment', icon: '🌪️' },
];

const COMPARED_OPTIONS = [
  { value: 'better', label: 'Better', icon: '⬆️' },
  { value: 'same', label: 'Same', icon: '➡️' },
  { value: 'harder', label: 'Harder', icon: '⬇️' },
];

const SUPPORT_OPTIONS = [
  { value: 'reminders', label: 'Reminders', icon: '🗣️' },
  { value: 'visuals', label: 'Visuals', icon: '👀' },
  { value: 'peer_help', label: 'Peer help', icon: '👥' },
  { value: 'coach_help', label: 'Coach help', icon: '👤' },
  { value: 'none_needed', label: 'None needed', icon: '❌' },
];

function OptionButton({ selected, onClick, label, icon }: { selected: boolean; onClick: () => void; label: string; icon?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
        selected
          ? 'bg-blue-50 border-blue-400 text-blue-700 shadow-sm'
          : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      {icon && <span className="text-base">{icon}</span>}
      {label}
    </button>
  );
}

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

// ========== Notes Tab ==========

function NotesTab({ employeeId, isCoachOrAdmin, userId }: { employeeId: string; isCoachOrAdmin: boolean; userId?: string }) {
  const [notes, setNotes] = useState<CoachNoteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'create' | 'edit' | 'view'>('list');
  const [selectedNote, setSelectedNote] = useState<CoachNoteData | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { fetchNotes(); }, [employeeId]);

  async function fetchNotes() {
    try {
      const res = await apiRequest(`/api/coach-notes/${employeeId}`);
      if (res.ok) setNotes(await res.json());
    } catch (err) {
      console.error('Failed to fetch notes', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    setError('');
    try {
      const body = { employee_id: employeeId, title, content };
      const res = selectedNote
        ? await apiRequest(`/api/coach-notes/${selectedNote.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, content }) })
        : await apiRequest('/api/coach-notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) {
        setTitle(''); setContent(''); setSelectedNote(null); setView('list');
        fetchNotes();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save note');
      }
    } catch { setError('Failed to save note'); } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this note?')) return;
    try {
      await apiRequest(`/api/coach-notes/${id}`, { method: 'DELETE' });
      fetchNotes();
    } catch { console.error('Failed to delete note'); }
  }

  if (view === 'create' || view === 'edit') {
    return (
      <div className="space-y-4">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Note title..."
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium"
        />
        <RichTextEditor
          content={content}
          onChange={setContent}
          placeholder="Write your note here..."
        />
        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-xl">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={() => { setView('list'); setTitle(''); setContent(''); setSelectedNote(null); setError(''); }}
            className="flex-1 py-3 px-4 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || !content.trim() || saving}
            className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : (selectedNote ? 'Update Note' : 'Save Note')}
          </button>
        </div>
      </div>
    );
  }

  if (view === 'view' && selectedNote) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => { setView('list'); setSelectedNote(null); }} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          {selectedNote.coach_id === userId && (
            <div className="flex gap-2">
              <button
                onClick={() => { setTitle(selectedNote.title); setContent(selectedNote.content); setView('edit'); }}
                className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
              >
                <Edit className="h-3.5 w-3.5" /> Edit
              </button>
              <button
                onClick={() => handleDelete(selectedNote.id)}
                className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          )}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{selectedNote.title}</h3>
          <p className="text-xs text-gray-500 mt-1">
            by {selectedNote.coach_name} &middot; {new Date(selectedNote.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <RichTextViewer content={selectedNote.content} />
        </div>
      </div>
    );
  }

  return (
    <div>
      {isCoachOrAdmin && (
        <button
          onClick={() => { setView('create'); setTitle(''); setContent(''); setSelectedNote(null); }}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors mb-4"
        >
          <Plus className="h-4 w-4" />
          New Note
        </button>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : notes.length === 0 ? (
        <div className="text-center py-12">
          <StickyNote className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-1">No notes yet</p>
          {isCoachOrAdmin && <p className="text-sm text-gray-400">Tap "New Note" to write one.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map(note => (
            <button
              key={note.id}
              onClick={() => { setSelectedNote(note); setView('view'); }}
              className="w-full bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-left hover:shadow-md hover:border-blue-300 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-gray-900 truncate">{note.title}</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    by {note.coach_name} &middot; {new Date(note.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              </div>
            </button>
          ))}
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [setting, setSetting] = useState('');
  const [howWasToday, setHowWasToday] = useState('');
  const [independence, setIndependence] = useState('');
  const [engagement, setEngagement] = useState('');
  const [bigWin, setBigWin] = useState<boolean | null>(null);
  const [bigWinType, setBigWinType] = useState('');
  const [challenge, setChallenge] = useState('');
  const [safetyConcern, setSafetyConcern] = useState<boolean | null>(null);
  const [safetyDetails, setSafetyDetails] = useState('');
  const [comparedToLast, setComparedToLast] = useState('');
  const [supportHelped, setSupportHelped] = useState('');
  const [notes, setNotes] = useState('');

  const isCoachOrAdmin = user?.role === 'Job Coach' || user?.role === 'Administrator';

  useEffect(() => {
    fetchCheckins();
  }, [employeeId]);

  async function fetchCheckins() {
    try {
      const res = await apiRequest(`/api/checkins/${employeeId}`);
      if (res.ok) {
        const data = await res.json();
        setCheckins(data);
      }
    } catch (err) {
      console.error('Failed to fetch check-ins', err);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setSetting(''); setHowWasToday(''); setIndependence(''); setEngagement('');
    setBigWin(null); setBigWinType(''); setChallenge('');
    setSafetyConcern(null); setSafetyDetails(''); setComparedToLast('');
    setSupportHelped(''); setNotes('');
  }

  const isFormValid = setting && howWasToday && independence && engagement &&
    bigWin !== null && challenge && safetyConcern !== null && comparedToLast && supportHelped;

  async function handleSubmit() {
    if (!isFormValid) return;
    setSaving(true);
    setError('');

    try {
      const body = {
        employee_id: employeeId,
        setting,
        how_was_today: howWasToday,
        independence,
        engagement,
        big_win: bigWin,
        big_win_type: bigWin ? bigWinType || null : null,
        challenge,
        safety_concern: safetyConcern,
        safety_details: safetyConcern ? safetyDetails || null : null,
        compared_to_last: comparedToLast,
        support_helped: supportHelped,
        notes: notes || null,
      };

      const res = await apiRequest('/api/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        resetForm();
        setView('list');
        fetchCheckins();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save check-in');
      }
    } catch (err) {
      setError('Failed to save check-in');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this check-in?')) return;
    try {
      await apiRequest(`/api/checkins/${id}`, { method: 'DELETE' });
      fetchCheckins();
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
                  onClick={() => setView('form')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors mb-4"
                >
                  <Plus className="h-4 w-4" />
                  New Check-In
                </button>
              )}
              {loading ? (
                <div className="text-center py-12 text-gray-400">Loading...</div>
              ) : checkins.length === 0 ? (
                <div className="text-center py-12">
                  <ClipboardCheck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-1">No check-ins yet</p>
                  {isCoachOrAdmin && (
                    <p className="text-sm text-gray-400">Tap "New Check-In" to record the first one.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {checkins.map(checkin => (
                    <CheckinCard
                      key={checkin.id}
                      checkin={checkin}
                      isOwner={checkin.coach_id === user?.id}
                      onDelete={() => handleDelete(checkin.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'form' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3">1. Where were we today?</h3>
                <div className="flex flex-wrap gap-2">
                  {SETTING_OPTIONS.map(opt => (
                    <OptionButton key={opt.value} selected={setting === opt.value} onClick={() => setSetting(opt.value)} label={opt.label} />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3">2. How was today?</h3>
                <div className="flex flex-wrap gap-2">
                  {TODAY_OPTIONS.map(opt => (
                    <OptionButton key={opt.value} selected={howWasToday === opt.value} onClick={() => setHowWasToday(opt.value)} label={opt.label} icon={opt.icon} />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3">3. Did they do most tasks on their own?</h3>
                <div className="flex flex-wrap gap-2">
                  {INDEPENDENCE_OPTIONS.map(opt => (
                    <OptionButton key={opt.value} selected={independence === opt.value} onClick={() => setIndependence(opt.value)} label={opt.label} icon={opt.icon} />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3">4. Were they engaged?</h3>
                <div className="flex flex-wrap gap-2">
                  {ENGAGEMENT_OPTIONS.map(opt => (
                    <OptionButton key={opt.value} selected={engagement === opt.value} onClick={() => setEngagement(opt.value)} label={opt.label} icon={opt.icon} />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3">5. Any big wins today?</h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  <OptionButton selected={bigWin === true} onClick={() => setBigWin(true)} label="Yes" icon="🏆" />
                  <OptionButton selected={bigWin === false} onClick={() => { setBigWin(false); setBigWinType(''); }} label="No" icon="❌" />
                </div>
                {bigWin && (
                  <div className="pl-4 border-l-2 border-blue-200">
                    <p className="text-xs text-gray-500 mb-2">Pick one:</p>
                    <div className="flex flex-wrap gap-2">
                      {WIN_TYPE_OPTIONS.map(opt => (
                        <OptionButton key={opt.value} selected={bigWinType === opt.value} onClick={() => setBigWinType(opt.value)} label={opt.label} />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3">6. Any challenges?</h3>
                <div className="flex flex-wrap gap-2">
                  {CHALLENGE_OPTIONS.map(opt => (
                    <OptionButton key={opt.value} selected={challenge === opt.value} onClick={() => setChallenge(opt.value)} label={opt.label} icon={opt.icon} />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3">7. Did anything unsafe happen?</h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  <OptionButton selected={safetyConcern === false} onClick={() => setSafetyConcern(false)} label="No" icon="❌" />
                  <OptionButton selected={safetyConcern === true} onClick={() => setSafetyConcern(true)} label="Yes" icon="⚠️" />
                </div>
                {safetyConcern && (
                  <div className="pl-4 border-l-2 border-red-200">
                    <textarea
                      value={safetyDetails}
                      onChange={(e) => setSafetyDetails(e.target.value)}
                      placeholder="Describe what happened..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      rows={3}
                    />
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3">8. Compared to last time, today was:</h3>
                <div className="flex flex-wrap gap-2">
                  {COMPARED_OPTIONS.map(opt => (
                    <OptionButton key={opt.value} selected={comparedToLast === opt.value} onClick={() => setComparedToLast(opt.value)} label={opt.label} icon={opt.icon} />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3">9. What support helped most?</h3>
                <div className="flex flex-wrap gap-2">
                  {SUPPORT_OPTIONS.map(opt => (
                    <OptionButton key={opt.value} selected={supportHelped === opt.value} onClick={() => setSupportHelped(opt.value)} label={opt.label} icon={opt.icon} />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Additional Notes (optional)</h3>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything else to note..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  rows={3}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-xl">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { resetForm(); setView('list'); }}
                  className="flex-1 py-3 px-4 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!isFormValid || saving}
                  className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Check-In'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'notes' && (
        <NotesTab employeeId={employeeId} isCoachOrAdmin={isCoachOrAdmin} userId={user?.id} />
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
