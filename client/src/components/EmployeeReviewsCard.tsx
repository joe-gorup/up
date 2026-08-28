import { type ReactNode, useEffect, useState } from 'react';
import { ClipboardCheck, Eye, FilePlus2, Loader2, Play, RefreshCw } from 'lucide-react';
import { apiRequest } from '../lib/auth';
import { useAuth } from '../contexts/AuthContext';
import { type Employee } from '../contexts/DataContext';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/use-toast';
import { FormFiller } from './FormsAndReviews';

type FormTemplate = { id: string; name: string; form_type: string };
type ResponseSet = {
  id: string;
  status: string;
  cycle_label?: string | null;
  created_at?: string;
  updated_at?: string;
  template: any;
  answers: Array<{ question_id: string; value_json: unknown }>;
};

export default function EmployeeReviewsCard({ employee, children }: { employee: Employee; children?: ReactNode }) {
  const { user } = useAuth();
  const { canView, canModify } = usePermissions();
  const { toast } = useToast();
  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [responses, setResponses] = useState<ResponseSet[]>([]);
  const [activeResponse, setActiveResponse] = useState<ResponseSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const mayView = user?.role === 'Administrator' || canView('form_responses');
  const mayModify = user?.role === 'Administrator' || canModify('form_responses');

  const load = async () => {
    if (!mayView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const templateResponse = await apiRequest(`/api/form-templates/by-type/mid_year_review?employee_id=${encodeURIComponent(employee.id)}`);
      if (templateResponse.status === 404) {
        setTemplate(null);
        setResponses([]);
        return;
      }
      if (!templateResponse.ok) throw new Error((await templateResponse.json()).error || 'Unable to load the review template');
      const loadedTemplate = await templateResponse.json();
      setTemplate(loadedTemplate);
      const responsesResponse = await apiRequest(`/api/employees/${employee.id}/form-responses?template_id=${loadedTemplate.id}`);
      if (!responsesResponse.ok) throw new Error((await responsesResponse.json()).error || 'Unable to load reviews');
      setResponses(await responsesResponse.json());
    } catch (error) {
      toast({ title: 'Could not load reviews', description: error instanceof Error ? error.message : 'Please try again.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [employee.id, mayView]);

  const startReview = async () => {
    if (!template) return;
    setStarting(true);
    try {
      const cycleLabel = `${new Date().getFullYear()}-mid-year`;
      const response = await apiRequest('/api/form-responses', {
        method: 'POST',
        body: JSON.stringify({ template_id: template.id, employee_id: employee.id, cycle_label: cycleLabel }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to start review');
      setActiveResponse(data);
    } catch (error) {
      toast({ title: 'Could not start review', description: error instanceof Error ? error.message : 'Please try again.', type: 'error' });
    } finally {
      setStarting(false);
    }
  };

  if (!mayView) return null;

  if (activeResponse) {
    return <FormFiller response={activeResponse as any} employee={employee} onClose={() => { setActiveResponse(null); load(); }} onComplete={() => { setActiveResponse(null); load(); }} />;
  }

  const currentDraft = responses.find(response => response.status === 'draft');
  const submitted = responses.filter(response => response.status === 'submitted');

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-amber-50 p-2 text-amber-700"><ClipboardCheck className="h-5 w-5" /></div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Reviews</h2>
            <p className="text-xs text-gray-500">Mid-Year Review</p>
          </div>
        </div>
        <button type="button" onClick={load} className="rounded-xl p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-700" title="Refresh reviews">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-5 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Loading reviews…</div>
      ) : !template ? (
        <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">The Mid-Year Review template has not been seeded yet.</p>
      ) : (
        <div className="space-y-3">
          {currentDraft ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div><p className="text-sm font-semibold text-amber-900">Draft review</p><p className="text-xs text-amber-800">{currentDraft.cycle_label || 'Mid-year'} · Continue when ready</p></div>
              {mayModify && <button type="button" onClick={() => setActiveResponse(currentDraft)} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"><Play className="h-3.5 w-3.5" />Continue</button>}
            </div>
          ) : mayModify && (
            <button type="button" onClick={startReview} disabled={starting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}
              {starting ? 'Starting…' : 'Start Mid-Year Review'}
            </button>
          )}

          {submitted.length > 0 ? (
            <div className="space-y-2 pt-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Submitted</p>
              {submitted.map(response => (
                <div key={response.id} className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                  <div><p className="text-sm font-medium text-gray-900">{response.cycle_label || 'Mid-Year Review'}</p><p className="text-xs text-emerald-700">Submitted · read only</p></div>
                  <button type="button" onClick={() => setActiveResponse(response)} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"><Eye className="h-3.5 w-3.5" />View</button>
                </div>
              ))}
            </div>
          ) : !currentDraft && !mayModify ? <p className="text-sm text-gray-500">No submitted mid-year reviews yet.</p> : null}
        </div>
      )}

      {children && (
        <div className="mt-5 border-t border-gray-200 pt-5">
          {children}
        </div>
      )}
    </section>
  );
}