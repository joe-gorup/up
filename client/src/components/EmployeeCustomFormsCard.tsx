import { useEffect, useState } from 'react';
import { Eye, FilePlus2, FileText, Loader2, Play, RefreshCw } from 'lucide-react';
import { apiRequest } from '../lib/auth';
import { useAuth } from '../contexts/AuthContext';
import { type Employee } from '../contexts/DataContext';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/use-toast';
import { FormFiller } from './FormsAndReviews';

type FormTemplate = {
  id: string;
  name: string;
  description?: string | null;
  form_type: string;
  can_fill?: boolean;
};

type ResponseSet = {
  id: string;
  template_id: string;
  status: string;
  cycle_label?: string | null;
  template: FormTemplate;
  answers: Array<{ question_id: string; value_json: unknown }>;
};

export default function EmployeeCustomFormsCard({ employee }: { employee: Employee }) {
  const { user } = useAuth();
  const { canView, canModify } = usePermissions();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [responses, setResponses] = useState<ResponseSet[]>([]);
  const [activeResponse, setActiveResponse] = useState<ResponseSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingTemplateId, setStartingTemplateId] = useState<string | null>(null);

  const mayView = user?.role === 'Administrator' || canView('form_responses');
  const mayModify = user?.role === 'Administrator' || canModify('form_responses');

  const load = async () => {
    if (!mayView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [templateResponse, responsesResponse] = await Promise.all([
        apiRequest(`/api/form-templates/for-employee?employee_id=${encodeURIComponent(employee.id)}`),
        apiRequest(`/api/employees/${employee.id}/form-responses`),
      ]);
      if (!templateResponse.ok) {
        throw new Error((await templateResponse.json()).error || 'Unable to load custom forms');
      }
      if (!responsesResponse.ok) {
        throw new Error((await responsesResponse.json()).error || 'Unable to load form responses');
      }
      setTemplates(await templateResponse.json());
      const loadedResponses = await responsesResponse.json();
      setResponses(loadedResponses.filter((response: ResponseSet) => response.template?.form_type === 'custom'));
    } catch (error) {
      toast({ title: 'Could not load custom forms', description: error instanceof Error ? error.message : 'Please try again.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [employee.id, mayView]);

  const startForm = async (template: FormTemplate) => {
    setStartingTemplateId(template.id);
    try {
      const response = await apiRequest('/api/form-responses', {
        method: 'POST',
        body: JSON.stringify({ template_id: template.id, employee_id: employee.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to start form');
      setActiveResponse(data);
    } catch (error) {
      toast({ title: 'Could not start form', description: error instanceof Error ? error.message : 'Please try again.', type: 'error' });
    } finally {
      setStartingTemplateId(null);
    }
  };

  if (!mayView) return null;

  if (activeResponse) {
    return (
      <FormFiller
        response={activeResponse as any}
        employee={employee}
        onClose={() => { setActiveResponse(null); load(); }}
        onComplete={() => { setActiveResponse(null); load(); }}
      />
    );
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-sky-50 p-2 text-sky-700"><FileText className="h-5 w-5" /></div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Forms</h2>
            <p className="text-xs text-gray-500">Custom employee forms</p>
          </div>
        </div>
        <button type="button" onClick={load} className="rounded-xl p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-700" title="Refresh custom forms">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-5 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Loading forms…</div>
      ) : templates.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">No custom forms yet.</p>
      ) : (
        <div className="space-y-3">
          {templates.map(template => {
            const templateResponses = responses.filter(response => response.template_id === template.id);
            const currentDraft = templateResponses.find(response => response.status === 'draft');
            const submitted = templateResponses.filter(response => response.status === 'submitted');
            const canFill = Boolean(template.can_fill && mayModify);

            return (
              <div key={template.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{template.name}</p>
                    {template.description && <p className="mt-0.5 text-xs text-gray-500">{template.description}</p>}
                  </div>
                  {!currentDraft && submitted.length === 0 && canFill && (
                    <button
                      type="button"
                      onClick={() => startForm(template)}
                      disabled={startingTemplateId === template.id}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      {startingTemplateId === template.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FilePlus2 className="h-3.5 w-3.5" />}
                      {startingTemplateId === template.id ? 'Starting…' : 'Start'}
                    </button>
                  )}
                </div>

                {currentDraft && (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <div>
                      <p className="text-sm font-semibold text-amber-900">Draft in progress</p>
                      <p className="text-xs text-amber-800">{currentDraft.cycle_label || 'Not submitted yet'}</p>
                    </div>
                    {canFill && (
                      <button type="button" onClick={() => setActiveResponse(currentDraft)} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700">
                        <Play className="h-3.5 w-3.5" />Continue
                      </button>
                    )}
                  </div>
                )}

                {submitted.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Submitted</p>
                    {submitted.map(response => (
                      <div key={response.id} className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{response.cycle_label || 'Submitted response'}</p>
                          <p className="text-xs text-emerald-700">Submitted · read only</p>
                        </div>
                        <button type="button" onClick={() => setActiveResponse(response)} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50">
                          <Eye className="h-3.5 w-3.5" />View
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {!currentDraft && submitted.length === 0 && !canFill && (
                  <p className="mt-3 text-sm text-gray-500">No response submitted yet.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}