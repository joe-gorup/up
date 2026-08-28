import { useState } from 'react';
import { ClipboardList, Edit, Trash2, ChevronDown, ChevronUp, Download, X, Save } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { apiRequest } from '../lib/auth';
import { useToast } from '../hooks/use-toast';

const REVIEW_QUESTIONS = [
  { key: 'q1', label: "What are this employee's greatest strengths this period?" },
  { key: 'q2', label: 'What areas need the most growth or additional support?' },
  { key: 'q3', label: 'How has the employee progressed toward their development goals?' },
  { key: 'q4', label: 'How does this employee demonstrate teamwork, communication, and attitude?' },
  { key: 'q5', label: 'What specific achievements or milestones deserve recognition?' },
  { key: 'q6', label: 'What are the goals and focus areas for the next review period?' },
] as const;

type ReviewType = 'mid_year' | 'annual';

interface Review {
  id: string;
  employee_id: string;
  reviewer_id: string;
  reviewer_name?: string;
  review_type: ReviewType;
  q1: string | null;
  q2: string | null;
  q3: string | null;
  q4: string | null;
  q5: string | null;
  q6: string | null;
  created_at: string;
  updated_at: string;
}

interface FormState {
  review_type: ReviewType;
  q1: string; q2: string; q3: string; q4: string; q5: string; q6: string;
}

const BLANK_FORM: FormState = { review_type: 'mid_year', q1: '', q2: '', q3: '', q4: '', q5: '', q6: '' };

function ReviewCard({
  review,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  review: Review;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const date = new Date(review.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const typeLabel = review.review_type === 'mid_year' ? 'Mid-Year Review' : 'Annual Review';
  const typeBg = review.review_type === 'mid_year' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200';

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${typeBg}`}>{typeLabel}</span>
          <span className="text-sm text-gray-700 font-medium">{date}</span>
          {review.reviewer_name && (
            <span className="text-xs text-gray-500">by {review.reviewer_name}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              onClick={e => { e.stopPropagation(); onEdit(); }}
              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
              title="Edit review"
            >
              <Edit className="h-4 w-4" />
            </button>
          )}
          {canDelete && (
            <button
              onClick={e => { e.stopPropagation(); onDelete(); }}
              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
              title="Delete review"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 py-4 space-y-4">
          {REVIEW_QUESTIONS.map(({ key, label }) => {
            const answer = review[key as keyof Review] as string | null;
            return (
              <div key={key}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                  {answer?.trim() ? answer : <span className="italic text-gray-400">Not answered</span>}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ReviewFormProps {
  initial?: FormState;
  onSave: (data: FormState) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

function ReviewForm({ initial = BLANK_FORM, onSave, onCancel, saving }: ReviewFormProps) {
  const [form, setForm] = useState<FormState>(initial);

  const set = (field: keyof FormState, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const allAnswered = REVIEW_QUESTIONS.every(({ key }) => form[key as keyof FormState]?.trim());

  return (
    <div className="border border-blue-200 rounded-xl p-4 bg-blue-50 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Edit Review</h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Review Type</label>
        <select
          value={form.review_type}
          onChange={e => set('review_type', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        >
          <option value="mid_year">Mid-Year Review</option>
          <option value="annual">Annual Review</option>
        </select>
      </div>

      {REVIEW_QUESTIONS.map(({ key, label }, i) => (
        <div key={key}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {i + 1}. {label} <span className="text-red-500">*</span>
          </label>
          <textarea
            value={form[key as keyof FormState] as string}
            onChange={e => set(key as keyof FormState, e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none bg-white"
            placeholder="Enter your response..."
          />
        </div>
      ))}

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSave(form)}
          disabled={saving || !allAnswered}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Review'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function EmployeeReviews({ employeeId, embedded = false }: { employeeId: string; embedded?: boolean }) {
  const { user } = useAuth();
  const { canView, canModify, canDelete: canDel } = usePermissions('employee_reviews');
  const { toast } = useToast();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [exporting, setExporting] = useState(false);

  const isAdmin = user?.role === 'Administrator';

  const load = async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const res = await apiRequest(`/api/employees/${employeeId}/reviews`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data);
        setLoaded(true);
      }
    } catch {
      toast({ title: 'Failed to load reviews', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !loaded) load();
  };

  const handleEdit = async (form: FormState) => {
    if (!editingReview) return;
    setSaving(true);
    try {
      const res = await apiRequest(`/api/reviews/${editingReview.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: err.error || 'Failed to update review', variant: 'destructive' });
        return;
      }
      const updated = await res.json();
      setReviews(prev => prev.map(r => r.id === updated.id ? updated : r));
      setEditingReview(null);
      toast({ title: 'Review updated' });
    } catch {
      toast({ title: 'Failed to update review', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (review: Review) => {
    if (!confirm('Delete this review? This cannot be undone.')) return;
    try {
      const res = await apiRequest(`/api/reviews/${review.id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast({ title: 'Failed to delete review', variant: 'destructive' });
        return;
      }
      setReviews(prev => prev.filter(r => r.id !== review.id));
      toast({ title: 'Review deleted' });
    } catch {
      toast({ title: 'Failed to delete review', variant: 'destructive' });
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await apiRequest(`/api/employees/${employeeId}/reviews/export`);
      if (!res.ok) {
        toast({ title: 'Export failed', variant: 'destructive' });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reviews-${employeeId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  if (!canView && !isAdmin) return null;

  const editFormInitial: FormState | undefined = editingReview ? {
    review_type: editingReview.review_type,
    q1: editingReview.q1 || '', q2: editingReview.q2 || '',
    q3: editingReview.q3 || '', q4: editingReview.q4 || '',
    q5: editingReview.q5 || '', q6: editingReview.q6 || '',
  } : undefined;

  return (
    <div className={`${embedded ? 'rounded-xl border border-gray-200 bg-gray-50/50 p-3 sm:p-4' : 'bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6'}`}>
      <button
        onClick={handleToggle}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          <ClipboardList className="h-5 w-5 text-indigo-500" />
          <h2 className="text-lg font-semibold text-gray-900">{embedded ? 'Previous Reviews' : 'Reviews'}</h2>
          {loaded && (
            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-medium">
              {reviews.length}
            </span>
          )}
        </div>
        {isAdmin && expanded && (
          <button
            onClick={e => { e.stopPropagation(); handleExport(); }}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 rounded-xl text-xs font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        )}
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          {loading && (
            <div className="text-sm text-gray-500 py-4 text-center">Loading reviews...</div>
          )}

          {!loading && loaded && reviews.length === 0 && (
            <div className="text-sm text-gray-500 py-6 text-center">
              No previous reviews recorded.
            </div>
          )}

          {reviews.map(review => (
            editingReview?.id === review.id ? (
              <ReviewForm
                key={review.id}
                initial={editFormInitial}
                onSave={handleEdit}
                onCancel={() => setEditingReview(null)}
                saving={saving}
              />
            ) : (
              <ReviewCard
                key={review.id}
                review={review}
                canEdit={(canModify || isAdmin) && (review.reviewer_id === user?.id || isAdmin)}
                canDelete={(canDel || isAdmin) && (review.reviewer_id === user?.id || isAdmin)}
                onEdit={() => setEditingReview(review)}
                onDelete={() => handleDelete(review)}
              />
            )
          ))}
        </div>
      )}
    </div>
  );
}
