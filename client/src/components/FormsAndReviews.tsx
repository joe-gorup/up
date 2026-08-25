import { useEffect, useMemo, useState } from 'react';
import {
  Archive, ArrowDown, ArrowLeft, ArrowUp, Check, ClipboardCheck, Copy,
  FileText, GripVertical, Plus, Save, Send, Settings2, Trash2, X,
} from 'lucide-react';
import { apiRequest } from '../lib/auth';
import { useAuth } from '../contexts/AuthContext';
import { useData, type Employee } from '../contexts/DataContext';
import { useToast } from '../hooks/use-toast';

type QuestionType =
  | 'free_text' | 'long_text' | 'yes_no' | 'single_select' | 'multi_select'
  | 'date' | 'date_time' | 'section_header' | 'help_text'
  | 'rich_text' | 'number' | 'scale' | 'email' | 'phone' | 'time'
  | 'signature' | 'file' | 'repeatable_group' | 'divider';
type FormQuestion = {
  id?: string; section_id?: string | null; stable_key: string; prompt: string; help_text?: string | null;
  question_type: QuestionType; config_json: Record<string, any>; sort_order: number; status?: string;
};
type FormSection = { id?: string; title: string; sort_order: number; status?: string; questions?: FormQuestion[] };
type FormTemplate = {
  id: string; name: string; description?: string | null; form_type: string; status: string; version: number;
  settings_json: Record<string, any>; sections: FormSection[]; questions: FormQuestion[];
};
type ResponseSet = {
  id: string; employee_id: string; status: string; cycle_label?: string | null; template: FormTemplate;
  answers: Array<{ question_id: string; value_json: any }>;
};

const questionTypes: Array<{ value: QuestionType; label: string; hint: string }> = [
  { value: 'free_text', label: 'Short answer', hint: 'One-line text' },
  { value: 'long_text', label: 'Long answer', hint: 'Paragraph response' },
  { value: 'single_select', label: 'Single select', hint: 'Choose one option' },
  { value: 'multi_select', label: 'Multi-select', hint: 'Choose multiple options' },
  { value: 'yes_no', label: 'Yes / No', hint: 'Binary response' },
  { value: 'date', label: 'Date', hint: 'Calendar date' },
  { value: 'date_time', label: 'Date & time', hint: 'Date and time' },
  { value: 'section_header', label: 'Section header', hint: 'Read-only heading' },
  { value: 'help_text', label: 'Help text', hint: 'Read-only guidance' },
  { value: 'rich_text', label: 'Rich text', hint: 'Coming soon' },
  { value: 'number', label: 'Number', hint: 'Coming soon' },
  { value: 'scale', label: 'Scale', hint: 'Numeric range' },
  { value: 'email', label: 'Email', hint: 'Coming soon' },
  { value: 'phone', label: 'Phone', hint: 'Coming soon' },
  { value: 'time', label: 'Time', hint: 'Coming soon' },
  { value: 'signature', label: 'Signature', hint: 'Coming soon' },
  { value: 'file', label: 'File', hint: 'Coming soon' },
  { value: 'repeatable_group', label: 'Repeatable group', hint: 'Coming soon' },
  { value: 'divider', label: 'Divider', hint: 'Coming soon' },
];

const defaultQuestion = (index: number, sectionId?: string): FormQuestion => ({
  stable_key: `question_${Date.now()}_${index}`,
  section_id: sectionId || null,
  prompt: '',
  help_text: '',
  question_type: 'free_text',
  config_json: { required: false },
  sort_order: index,
});

const defaultTemplate = (): Partial<FormTemplate> => {
  const generalSectionId = `local-section-${Date.now()}`;
  return {
    name: '',
    description: '',
    form_type: 'custom',
    status: 'active',
    settings_json: { allowed_fill_roles: ['Administrator'], lock_on_submit: true },
    sections: [{ id: generalSectionId, title: 'General', sort_order: 0, status: 'active', questions: [] }],
    questions: [defaultQuestion(0, generalSectionId)],
  };
};

function normalizeQuestions(template: FormTemplate): FormQuestion[] {
  if (Array.isArray(template.questions)) return template.questions;
  return (template.sections || []).flatMap(section => (section.questions || []).map(question => ({ ...question, section_id: question.section_id || section.id })));
}

function isSameQuestion(candidate: FormQuestion, target: FormQuestion) {
  return target.id ? candidate.id === target.id : candidate.stable_key === target.stable_key;
}

function QuestionEditor({ question, onChange, onRemove, onMove }: {
  question: FormQuestion; onChange: (next: FormQuestion) => void; onRemove: () => void; onMove: (direction: -1 | 1) => void;
}) {
  const config = question.config_json || {};
  const updateConfig = (patch: Record<string, any>) => onChange({ ...question, config_json: { ...config, ...patch } });
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <GripVertical className="mt-2 h-5 w-5 flex-shrink-0 text-slate-300" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              value={question.prompt}
              onChange={e => onChange({ ...question, prompt: e.target.value })}
              placeholder="Write the question prompt…"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            />
            <select
              value={question.question_type}
              onChange={e => onChange({ ...question, question_type: e.target.value as QuestionType })}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500"
            >
              {questionTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </div>
          <input
            value={question.help_text || ''}
            onChange={e => onChange({ ...question, help_text: e.target.value })}
            placeholder="Optional help text for the person completing this form"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 outline-none focus:border-amber-500"
          />
          {(question.question_type === 'single_select' || question.question_type === 'multi_select') && (
            <textarea
              value={(config.options || []).join('\n')}
              onChange={e => updateConfig({ options: e.target.value.split('\n').map(value => value.trim()).filter(Boolean) })}
              placeholder="Options, one per line"
              rows={3}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
            />
          )}
          {question.question_type === 'single_select' && (
            <select
              value={config.display?.style || 'dropdown'}
              onChange={e => updateConfig({ display: { ...(config.display || {}), style: e.target.value } })}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500"
            >
              <option value="dropdown">Dropdown style</option>
              <option value="chips">Chip style</option>
            </select>
          )}
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={Boolean(config.required)} onChange={e => updateConfig({ required: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500" />
            Required question
          </label>
        </div>
        <div className="flex flex-shrink-0 gap-1">
          <button onClick={() => onMove(-1)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Move question up"><ArrowUp className="h-4 w-4" /></button>
          <button onClick={() => onMove(1)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Move question down"><ArrowDown className="h-4 w-4" /></button>
          <button onClick={() => onChange({ ...question, status: question.status === 'inactive' ? 'active' : 'inactive' })} className={`rounded-lg px-2 py-1.5 text-xs font-medium ${question.status === 'inactive' ? 'bg-amber-50 text-amber-800' : 'text-slate-400 hover:bg-amber-50 hover:text-amber-700'}`} aria-label="Toggle question active status">{question.status === 'inactive' ? 'Activate' : 'Deactivate'}</button>
          <button onClick={onRemove} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove question"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}

function FormBuilder({ initial, onClose, onSaved }: { initial?: FormTemplate; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<Partial<FormTemplate>>(initial ? JSON.parse(JSON.stringify(initial)) : defaultTemplate());
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const sections = draft.sections || [];
  const questions = normalizeQuestions(draft as FormTemplate);
  const sectionQuestions = (section: FormSection) => questions.filter(question => (question.section_id || null) === (section.id || section.title));
  const allowedFillRoles = Array.isArray(draft.settings_json?.allowed_fill_roles) ? draft.settings_json.allowed_fill_roles as string[] : ['Administrator'];
  const toggleAllowedRole = (role: string) => {
    if (role === 'Administrator') return;
    const nextRoles = allowedFillRoles.includes(role)
      ? allowedFillRoles.filter(item => item !== role)
      : [...allowedFillRoles, role];
    setDraft(prev => ({ ...prev, settings_json: { ...(prev.settings_json || {}), allowed_fill_roles: nextRoles } }));
  };

  const updateSection = (index: number, patch: Partial<FormSection>) => setDraft(prev => ({ ...prev, sections: (prev.sections || []).map((section, i) => i === index ? { ...section, ...patch } : section) }));
  const addSection = () => {
    const title = `Section ${sections.length + 1}`;
    setDraft(prev => ({ ...prev, sections: [...(prev.sections || []), { id: `local-section-${Date.now()}`, title, sort_order: sections.length, status: 'active', questions: [] }] }));
    setActiveSection(sections.length);
  };
  const addQuestion = () => {
    const section = sections[activeSection];
    if (!section) return;
    const question = defaultQuestion(questions.length, section.id || section.title);
    setDraft(prev => ({ ...prev, questions: [...normalizeQuestions(prev as FormTemplate), question] }));
  };
  const removeSection = (index: number) => {
    const section = sections[index];
    if (!section) return;
    const sectionReference = section.id || section.title;
    setDraft(prev => ({
      ...prev,
      sections: (prev.sections || []).filter((_, sectionIndex) => sectionIndex !== index),
      questions: normalizeQuestions(prev as FormTemplate).filter(question => (question.section_id || null) !== sectionReference),
    }));
    setActiveSection(current => Math.max(0, Math.min(current === index ? index - 1 : current, sections.length - 2)));
  };
  const moveSection = (direction: -1 | 1) => {
    const to = activeSection + direction;
    if (to < 0 || to >= sections.length) return;
    const next = [...sections];
    [next[activeSection], next[to]] = [next[to], next[activeSection]];
    setDraft(prev => ({ ...prev, sections: next }));
    setActiveSection(to);
  };
  const save = async () => {
    if (!draft.name?.trim()) {
      toast({ title: 'Name required', description: 'Give this form a name before saving.', type: 'error' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: draft.name.trim(), description: draft.description || null, form_type: draft.form_type || 'custom',
        status: draft.status || 'active', settings_json: draft.settings_json || {},
        sections: sections.map((section, index) => ({ ...section, sort_order: index })),
        questions: questions.map((question, index) => ({ ...question, sort_order: index })),
      };
      let response: Response;
      if (draft.id) {
        response = await apiRequest(`/api/form-templates/${draft.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        const create = await apiRequest('/api/form-templates', { method: 'POST', body: JSON.stringify(payload) });
        const created = await create.json();
        if (!create.ok) throw new Error(created.error || 'Unable to create form');
        response = await apiRequest(`/api/form-templates/${created.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      }
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Unable to save form');
      }
      toast({ title: 'Form saved', description: 'Your template is ready to use.', type: 'success' });
      onSaved();
    } catch (error) {
      toast({ title: 'Could not save form', description: error instanceof Error ? error.message : 'Please try again.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };
  const moveQuestion = (question: FormQuestion, direction: -1 | 1) => {
    const inSection = sectionQuestions(sections[activeSection]);
    const from = inSection.findIndex(item => isSameQuestion(item, question));
    const to = from + direction;
    if (from < 0 || to < 0 || to >= inSection.length) return;
    const next = [...questions];
    const globalFrom = next.findIndex(item => isSameQuestion(item, question));
    const swap = next.findIndex(item => isSameQuestion(item, inSection[to]));
    [next[globalFrom], next[swap]] = [next[swap], next[globalFrom]];
    setDraft(prev => ({ ...prev, questions: next }));
  };
  const visibleQuestions = sectionQuestions(sections[activeSection]);

  return (
    <div className="min-h-full bg-[#f7f7f5] p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"><ArrowLeft className="h-5 w-5" /></button>
            <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Template builder</p><h2 className="text-2xl font-semibold text-slate-900">{draft.id ? 'Edit form' : 'New form'}</h2></div>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-white">Cancel</button>
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"><Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save template'}</button>
          </div>
        </div>
        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800"><Settings2 className="h-4 w-4 text-amber-600" />Form details</div>
              <div className="space-y-3">
                <input value={draft.name || ''} onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))} placeholder="Form name" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-500" />
                <textarea value={draft.description || ''} onChange={e => setDraft(prev => ({ ...prev, description: e.target.value }))} placeholder="What is this form for?" rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-500" />
                <select value={draft.form_type || 'custom'} onChange={e => setDraft(prev => ({ ...prev, form_type: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  <option value="custom">Custom form</option><option value="review">Employee review</option><option value="check_in">Check-in</option><option value="certification">Certification</option>
                </select>
                <select value={draft.status || 'active'} onChange={e => setDraft(prev => ({ ...prev, status: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="active">Active</option><option value="archived">Archived</option></select>
                <div className="border-t border-slate-100 pt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Who can fill this form</p>
                  <div className="space-y-2">
                    {['Administrator', 'Shift Lead', 'Assistant Manager', 'Job Coach', 'Guardian'].map(role => (
                      <label key={role} className="flex items-center gap-2 text-xs text-slate-600">
                        <input type="checkbox" checked={allowedFillRoles.includes(role)} disabled={role === 'Administrator'} onChange={() => toggleAllowedRole(role)} className="h-3.5 w-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 disabled:opacity-50" />
                        {role}
                      </label>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] leading-4 text-slate-400">Role permissions still control access to employee responses.</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between px-2"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Sections</p><button onClick={addSection} className="rounded-lg p-1.5 text-amber-700 hover:bg-amber-50" aria-label="Add section"><Plus className="h-4 w-4" /></button></div>
              <div className="space-y-1">
                {sections.map((section, index) => <button key={`${section.id || section.title}-nav-${index}`} onClick={() => setActiveSection(index)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${activeSection === index ? 'bg-amber-50 font-semibold text-amber-900' : 'text-slate-600 hover:bg-slate-50'}`}><span className="truncate">{section.title}</span><span className="ml-2 text-xs text-slate-400">{sectionQuestions(section).length}</span></button>)}
              </div>
            </div>
          </aside>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            {sections[activeSection] ? (
              <>
                <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-2"><input value={sections[activeSection].title} onChange={e => updateSection(activeSection, { title: e.target.value })} className="min-w-0 border-b border-transparent px-1 py-1 text-lg font-semibold text-slate-900 outline-none focus:border-amber-500" /><button onClick={() => moveSection(-1)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Move section up"><ArrowUp className="h-4 w-4" /></button><button onClick={() => moveSection(1)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Move section down"><ArrowDown className="h-4 w-4" /></button><button onClick={() => removeSection(activeSection)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove section"><Trash2 className="h-4 w-4" /></button></div>
                  <button onClick={addQuestion} className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"><Plus className="h-4 w-4" />Add question</button>
                </div>
                <div className="space-y-3">
                  {visibleQuestions.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">This section is empty. Add its first question.</div>}
                  {visibleQuestions.map((question, index) => <QuestionEditor key={`${question.id || question.stable_key}-editor-${index}`} question={question} onChange={next => setDraft(prev => ({ ...prev, questions: normalizeQuestions(prev as FormTemplate).map(item => isSameQuestion(item, question) ? next : item) }))} onRemove={() => setDraft(prev => ({ ...prev, questions: normalizeQuestions(prev as FormTemplate).filter(item => !isSameQuestion(item, question)) }))} onMove={direction => moveQuestion(question, direction)} />)}
                </div>
              </>
            ) : <div className="py-20 text-center text-sm text-slate-500">Add a section to start building this form.</div>}
          </section>
        </div>
      </div>
    </div>
  );
}

function AnswerControl({ question, value, onChange }: { question: FormQuestion; value: any; onChange: (value: any) => void }) {
  const config = question.config_json || {};
  const options = config.options || ['Option 1', 'Option 2'];
  const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100';
  if (question.question_type === 'free_text') return <input type="text" value={value || ''} onChange={e => onChange(e.target.value)} className={inputClass} />;
  if (question.question_type === 'long_text') return <textarea rows={5} value={value || ''} onChange={e => onChange(e.target.value)} className={inputClass} />;
  if (question.question_type === 'date') return <input type="date" value={value || ''} onChange={e => onChange(e.target.value)} className={inputClass} />;
  if (question.question_type === 'date_time') return <input type="datetime-local" value={value || ''} onChange={e => onChange(e.target.value)} className={inputClass} />;
  if (question.question_type === 'yes_no') return <div className="flex gap-2">{['Yes', 'No'].map(option => <button key={option} onClick={() => onChange(option.toLowerCase())} className={`rounded-xl border px-4 py-2 text-sm font-medium ${value === option.toLowerCase() ? 'border-amber-500 bg-amber-50 text-amber-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{option}</button>)}</div>;
  if (question.question_type === 'scale') {
    const min = Number.isFinite(Number(config.min)) ? Number(config.min) : 1;
    const max = Number.isFinite(Number(config.max)) ? Number(config.max) : 5;
    const labels = config.labels || {};
    return (
      <div className="grid grid-cols-5 gap-2 sm:flex sm:flex-wrap">
        {Array.from({ length: Math.max(0, max - min + 1) }, (_, index) => min + index).map(option => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={Number(value) === option}
            className={`min-w-12 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${Number(value) === option ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-sm' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {labels[String(option)] || option}
          </button>
        ))}
      </div>
    );
  }
  if (question.question_type === 'single_select' && config.display?.style !== 'chips') return <select value={value || ''} onChange={e => onChange(e.target.value)} className={inputClass}><option value="">Choose an option…</option>{options.map((option: string) => <option key={option} value={option}>{option}</option>)}</select>;
  if (question.question_type === 'single_select') return <div className="grid gap-2 sm:grid-cols-2">{options.map((option: string) => <button key={option} onClick={() => onChange(option)} className={`rounded-xl border px-3 py-2 text-left text-sm ${value === option ? 'border-amber-500 bg-amber-50 font-semibold text-amber-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{option}</button>)}</div>;
  if (question.question_type === 'multi_select') return <div className="grid gap-2 sm:grid-cols-2">{options.map((option: string) => { const selected = Array.isArray(value) && value.includes(option); return <label key={option} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${selected ? 'border-amber-500 bg-amber-50 text-amber-900' : 'border-slate-200 text-slate-600'}`}><input type="checkbox" checked={selected} onChange={() => onChange(selected ? value.filter((item: string) => item !== option) : [...(value || []), option])} className="h-4 w-4 text-amber-600 focus:ring-amber-500" />{option}</label>; })}</div>;
  return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-500">This question type is registered and will be available in a future phase.</div>;
}

function ReadOnlyAnswer({ value, question }: { value: any; question?: FormQuestion }) {
  if (question?.question_type === 'scale' && value !== undefined && value !== null && value !== '') {
    const labels = question.config_json?.labels || {};
    return <div className="min-h-10 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-900">Rating: {labels[String(value)] || value}</div>;
  }
  const rendered = Array.isArray(value) ? value.join(', ') : value === true ? 'Yes' : value === false ? 'No' : value;
  return <div className="min-h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">{rendered === undefined || rendered === null || rendered === '' ? 'No response provided.' : String(rendered)}</div>;
}

export function FormFiller({ response, employee, onClose, onComplete }: { response: ResponseSet; employee: Employee; onClose: () => void; onComplete: (response?: ResponseSet) => void }) {
  const { toast } = useToast();
  const [answers, setAnswers] = useState<Record<string, any>>(() => Object.fromEntries(response.answers.map(answer => [answer.question_id, answer.value_json])));
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const questions = normalizeQuestions(response.template).filter(question => question.status !== 'inactive');
  const isSubmitted = response.status === 'submitted';
  const save = async (submit = false) => {
    submit ? setSubmitting(true) : setSaving(true);
    try {
      const answerList = Object.entries(answers).map(([question_id, value_json]) => ({ question_id, value_json }));
      const saved = await apiRequest(`/api/form-responses/${response.id}`, { method: 'PUT', body: JSON.stringify({ answers: answerList }) });
      if (!saved.ok) throw new Error((await saved.json()).error || 'Unable to save response');
      if (submit) {
        const submitted = await apiRequest(`/api/form-responses/${response.id}/submit`, { method: 'POST' });
        if (!submitted.ok) throw new Error((await submitted.json()).error || 'Unable to submit response');
        const submittedResponse = await submitted.json();
        toast({ title: 'Form submitted', description: 'This response is now locked for review.', type: 'success' });
        onComplete(submittedResponse);
      } else toast({ title: 'Draft saved', description: 'You can come back and finish this form later.', type: 'success' });
    } catch (error) {
      toast({ title: submit ? 'Could not submit form' : 'Could not save draft', description: error instanceof Error ? error.message : 'Please try again.', type: 'error' });
    } finally {
      setSaving(false); setSubmitting(false);
    }
  };
  return (
    <div className="min-h-full bg-[#f7f7f5] p-4 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-start justify-between gap-4"><div><button onClick={onClose} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" />Back to Forms & Reviews</button><p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Standalone response</p><h2 className="mt-1 text-2xl font-semibold text-slate-900">{response.template.name}</h2><p className="mt-1 text-sm text-slate-500">For {employee.first_name} {employee.last_name} · {isSubmitted ? 'Submitted response' : 'Draft response'}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${isSubmitted ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{isSubmitted ? 'Submitted · read only' : `Version ${response.template.version}`}</span></div>
        <div className="space-y-4">
          {response.template.sections.filter(section => section.status !== 'archived').map(section => (
            <section key={section.id || section.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="mb-5 text-lg font-semibold text-slate-900">{section.title}</h3>
              <div className="space-y-5">
                {questions.filter(question => (question.section_id || null) === section.id).map(question => {
                  if (question.question_type === 'section_header') {
                    return <h4 key={question.id || question.stable_key} className="border-b border-slate-100 pb-2 text-base font-semibold text-slate-800">{question.prompt}</h4>;
                  }
                  if (question.question_type === 'help_text') {
                    return <p key={question.id || question.stable_key} className="rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">{question.prompt || question.help_text}</p>;
                  }
                  return <div key={question.id || question.stable_key}>
                    <label className="mb-2 block text-sm font-semibold text-slate-800">{question.prompt || 'Untitled question'}{question.config_json?.required && <span className="ml-1 text-amber-700">*</span>}</label>
                    {question.help_text && <p className="mb-2 text-xs text-slate-500">{question.help_text}</p>}
                    {isSubmitted ? <ReadOnlyAnswer question={question} value={answers[question.id || question.stable_key]} /> : <AnswerControl question={question} value={answers[question.id || question.stable_key]} onChange={value => setAnswers(prev => ({ ...prev, [question.id || question.stable_key]: value }))} />}
                  </div>;
                })}
              </div>
            </section>
          ))}
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-white">{isSubmitted ? 'Back to forms' : 'Exit'}</button>{!isSubmitted && <><button onClick={() => save(false)} disabled={saving || submitting} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"><Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save draft'}</button><button onClick={() => save(true)} disabled={saving || submitting} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"><Send className="h-4 w-4" />{submitting ? 'Submitting…' : 'Submit response'}</button></>}</div>
      </div>
    </div>
  );
}

export default function FormsAndReviews() {
  const { user } = useAuth();
  const { employees } = useData();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [builder, setBuilder] = useState<{ open: boolean; template?: FormTemplate }>({ open: false });
  const [filler, setFiller] = useState<{ response: ResponseSet; employee: Employee } | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [cycleLabel, setCycleLabel] = useState('');

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await apiRequest('/api/form-templates');
      if (!response.ok) throw new Error('Unable to load templates');
      setTemplates(await response.json());
    } catch (error) {
      toast({ title: 'Could not load forms', description: error instanceof Error ? error.message : 'Please refresh and try again.', type: 'error' });
    } finally { setLoading(false); }
  };
  useEffect(() => { loadTemplates(); }, []);
  const visibleTemplates = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return templates.filter(template => {
      const matchesStatus = statusFilter === 'all' || template.status === statusFilter;
      const matchesSearch = !query || template.name.toLowerCase().includes(query) || (template.description || '').toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [templates, statusFilter, searchTerm]);
  const startForm = async () => {
    const employee = employees.find(item => item.id === selectedEmployee);
    if (!employee || !selectedTemplate) return;
    try {
      const response = await apiRequest('/api/form-responses', { method: 'POST', body: JSON.stringify({ template_id: selectedTemplate, employee_id: employee.id, cycle_label: cycleLabel || undefined }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to start form');
      setFiller({ response: data, employee });
    } catch (error) {
      toast({ title: 'Could not start form', description: error instanceof Error ? error.message : 'Please try again.', type: 'error' });
    }
  };
  const duplicate = async (template: FormTemplate) => {
    const response = await apiRequest(`/api/form-templates/${template.id}/duplicate`, { method: 'POST' });
    if (!response.ok) return toast({ title: 'Could not duplicate form', type: 'error' });
    await loadTemplates();
    toast({ title: 'Form duplicated', description: 'A new active copy was created.', type: 'success' });
  };
  const archive = async (template: FormTemplate) => {
    if (!confirm(`Archive "${template.name}"? Existing responses will remain available.`)) return;
    const response = await apiRequest(`/api/form-templates/${template.id}`, { method: 'DELETE' });
    if (response.ok) { await loadTemplates(); toast({ title: 'Form archived', type: 'success' }); }
  };
  if (filler) return <FormFiller response={filler.response} employee={filler.employee} onClose={() => setFiller(null)} onComplete={() => { setFiller(null); }} />;
  if (builder.open) return <FormBuilder initial={builder.template} onClose={() => setBuilder({ open: false })} onSaved={() => { setBuilder({ open: false }); loadTemplates(); }} />;
  if (user?.role !== 'Administrator') return <div className="p-6"><div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-red-50 p-8 text-center"><X className="mx-auto mb-3 h-10 w-10 text-red-400" /><h2 className="font-semibold text-red-900">Administrator access required</h2><p className="mt-1 text-sm text-red-700">Forms & Reviews templates are managed by Administrators.</p></div></div>;
  return (
    <div className="min-h-full bg-[#f7f7f5] p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><div className="mb-2 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"><ClipboardCheck className="h-3.5 w-3.5" />Structured documentation</div><h2 className="text-3xl font-semibold tracking-tight text-slate-900">Forms & Reviews</h2><p className="mt-1 max-w-2xl text-sm text-slate-500">Build reusable review and check-in templates, then capture locked responses for each Super Scooper.</p></div><button onClick={() => setBuilder({ open: true })} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"><Plus className="h-4 w-4" />New form template</button></div>
        <div className="mb-5 grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[1fr_1fr_1fr_auto]"><div><label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Start a response</label><select value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">Choose a form…</option>{templates.filter(template => template.status === 'active').map(template => <option key={template.id} value={template.id}>{template.name}</option>)}</select></div><div><label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Super Scooper</label><select value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">Choose an employee…</option>{employees.filter(employee => employee.isActive).map(employee => <option key={employee.id} value={employee.id}>{employee.first_name} {employee.last_name}</option>)}</select></div><div><label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Cycle (optional)</label><input value={cycleLabel} onChange={e => setCycleLabel(e.target.value)} placeholder="e.g. Q3 2026" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-500" /></div><button onClick={startForm} disabled={!selectedTemplate || !selectedEmployee} className="self-end rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50">Open form</button></div>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h3 className="font-semibold text-slate-900">Template library</h3><p className="text-sm text-slate-500">{visibleTemplates.length} {visibleTemplates.length === 1 ? 'template' : 'templates'}</p></div><div className="flex flex-col gap-2 sm:flex-row"><input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search templates…" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500" /><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="active">Active templates</option><option value="archived">Archived templates</option><option value="all">All templates</option></select></div></div>
        {loading ? <div className="py-16 text-center text-sm text-slate-500">Loading templates…</div> : visibleTemplates.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center"><FileText className="mx-auto mb-3 h-10 w-10 text-slate-300" /><h3 className="font-semibold text-slate-800">No templates here yet</h3><p className="mt-1 text-sm text-slate-500">Create a reusable form to start documenting reviews and check-ins.</p></div> : <div className="grid gap-4 md:grid-cols-2">{visibleTemplates.map(template => <article key={template.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"><div className="mb-4 flex items-start justify-between gap-3"><div className="flex min-w-0 gap-3"><div className="rounded-xl bg-amber-50 p-2.5 text-amber-700"><FileText className="h-5 w-5" /></div><div className="min-w-0"><h3 className="truncate font-semibold text-slate-900">{template.name}</h3><p className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-400">{template.form_type.replace('_', ' ')} · v{template.version}</p></div></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${template.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{template.status}</span></div><p className="mb-4 min-h-[40px] text-sm text-slate-500">{template.description || 'No description added.'}</p><div className="mb-5 flex gap-4 text-xs text-slate-500"><span>{template.sections.length} sections</span><span>{normalizeQuestions(template).filter(question => question.status !== 'inactive').length} questions</span></div><div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4"><button onClick={() => setBuilder({ open: true, template })} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">Edit</button><button onClick={() => duplicate(template)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"><Copy className="h-3.5 w-3.5" />Duplicate</button>{template.status === 'active' && <button onClick={() => archive(template)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-red-50 hover:text-red-700"><Archive className="h-3.5 w-3.5" />Archive</button>}</div></article>)}</div>}
      </div>
    </div>
  );
}