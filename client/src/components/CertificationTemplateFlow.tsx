import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { apiRequest } from '../lib/auth';
import { type Employee } from '../contexts/DataContext';
import { useToast } from '../hooks/use-toast';
import { FormFiller } from './FormsAndReviews';

type CertificationType = 'mentor' | 'shift_lead';

export default function CertificationTemplateFlow({
  employee,
  certificationType,
  onClose,
  onCompleted,
  onTemplateUnavailable,
}: {
  employee: Employee;
  certificationType: CertificationType;
  onClose: () => void;
  onCompleted: () => void;
  onTemplateUnavailable: () => void;
}) {
  const { toast } = useToast();
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const open = async () => {
      try {
        const formType = certificationType === 'mentor' ? 'mentor_certification' : 'shift_lead_certification';
        const templateResponse = await apiRequest(`/api/form-templates/by-type/${formType}?employee_id=${encodeURIComponent(employee.id)}`);
        if (templateResponse.status === 404) {
          if (!cancelled) onTemplateUnavailable();
          return;
        }
        if (!templateResponse.ok) throw new Error((await templateResponse.json()).error || 'Unable to load certification template');
        const template = await templateResponse.json();
        const responseResult = await apiRequest('/api/form-responses', {
          method: 'POST',
          body: JSON.stringify({
            template_id: template.id,
            employee_id: employee.id,
            cycle_label: `certification-${crypto.randomUUID()}`,
          }),
        });
        const responseData = await responseResult.json();
        if (!responseResult.ok) throw new Error(responseData.error || 'Unable to start certification');
        if (!cancelled) setResponse(responseData);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to start certification');
      }
    };
    open();
    return () => { cancelled = true; };
  }, [certificationType, employee.id]);

  const recordCertification = () => {
    toast({ title: 'Certification recorded', description: 'The submitted checklist is now linked to this certification.', type: 'success' });
    onCompleted();
  };

  if (error) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center"><p className="text-sm font-medium text-red-800">{error}</p><button type="button" onClick={onClose} className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700">Close</button></div>;
  }

  if (!response) {
    return <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /><span>Opening {certificationType === 'mentor' ? 'Mentor' : 'Shift Lead'} Certification…</span></div>;
  }

  return <FormFiller response={response} employee={employee} onClose={onClose} onComplete={recordCertification} />;
}