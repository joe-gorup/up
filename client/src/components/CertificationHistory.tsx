import { useMemo, useState } from 'react';
import { TrendingUp, AlertCircle, EyeOff, Star, Shield } from 'lucide-react';
import { PromotionCertification } from '../contexts/DataContext';
import { normalizeChecklistAnswer } from '@shared/schema';

interface Props {
  certifications: PromotionCertification[];
}

type CertType = 'mentor' | 'shift_lead';

function ScoreSparkline({ certs }: { certs: PromotionCertification[] }) {
  const sorted = [...certs].sort(
    (a, b) => new Date(a.dateCompleted).getTime() - new Date(b.dateCompleted).getTime()
  );
  const passing = sorted[0]?.passingScore ?? 80;

  const width = 320;
  const height = 90;
  const padX = 24;
  const padY = 14;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const xFor = (i: number) =>
    sorted.length === 1 ? padX + innerW / 2 : padX + (i * innerW) / (sorted.length - 1);
  const yFor = (score: number) => padY + innerH - (score / 100) * innerH;

  const path = sorted
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(c.score)}`)
    .join(' ');

  const passY = yFor(passing);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-24"
      preserveAspectRatio="none"
      role="img"
      aria-label="Certification score trend"
    >
      <line x1={padX} y1={padY} x2={padX} y2={padY + innerH} stroke="#e5e7eb" strokeWidth={1} />
      <line
        x1={padX}
        y1={padY + innerH}
        x2={padX + innerW}
        y2={padY + innerH}
        stroke="#e5e7eb"
        strokeWidth={1}
      />
      <line
        x1={padX}
        y1={passY}
        x2={padX + innerW}
        y2={passY}
        stroke="#10b981"
        strokeOpacity={0.4}
        strokeDasharray="3 3"
        strokeWidth={1}
      />
      <text x={padX + innerW} y={passY - 3} textAnchor="end" fontSize={9} fill="#10b981">
        pass {passing}%
      </text>
      {sorted.length > 1 && (
        <path d={path} fill="none" stroke="#2563eb" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      )}
      {sorted.map((c, i) => (
        <g key={c.id}>
          <circle
            cx={xFor(i)}
            cy={yFor(c.score)}
            r={4}
            fill={c.passed ? '#10b981' : '#ef4444'}
            stroke="white"
            strokeWidth={1.5}
          />
          <text
            x={xFor(i)}
            y={yFor(c.score) - 8}
            textAnchor="middle"
            fontSize={9}
            fill="#374151"
            fontWeight="600"
          >
            {c.score}%
          </text>
        </g>
      ))}
      {sorted.length > 0 && (
        <>
          <text x={padX} y={height - 2} textAnchor="start" fontSize={8} fill="#9ca3af">
            {new Date(sorted[0].dateCompleted).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </text>
          {sorted.length > 1 && (
            <text x={padX + innerW} y={height - 2} textAnchor="end" fontSize={8} fill="#9ca3af">
              {new Date(sorted[sorted.length - 1].dateCompleted).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </text>
          )}
        </>
      )}
    </svg>
  );
}

function ItemBreakdown({ certs }: { certs: PromotionCertification[] }) {
  const stats = useMemo(() => {
    const map = new Map<string, { question: string; incorrect: number; no_opportunity: number; total: number }>();
    for (const cert of certs) {
      const results = Array.isArray(cert.checklistResults) ? cert.checklistResults : [];
      for (const r of results) {
        const question = r?.question;
        if (!question || typeof question !== 'string') continue;
        const n = normalizeChecklistAnswer(r?.answer);
        const entry = map.get(question) || { question, incorrect: 0, no_opportunity: 0, total: 0 };
        entry.total += 1;
        if (n === 'incorrect') entry.incorrect += 1;
        else if (n === 'no_opportunity') entry.no_opportunity += 1;
        map.set(question, entry);
      }
    }
    const all = Array.from(map.values());
    const mostMissed = [...all]
      .filter((e) => e.incorrect > 0)
      .sort((a, b) => b.incorrect - a.incorrect || b.incorrect / b.total - a.incorrect / a.total)
      .slice(0, 5);
    const alwaysNoOpportunity = all
      .filter((e) => e.total > 0 && e.no_opportunity === e.total)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    const mostNoOpportunity = [...all]
      .filter((e) => e.no_opportunity > 0 && !(e.no_opportunity === e.total))
      .sort((a, b) => b.no_opportunity - a.no_opportunity || b.no_opportunity / b.total - a.no_opportunity / a.total)
      .slice(0, 5);
    return { mostMissed, alwaysNoOpportunity, mostNoOpportunity };
  }, [certs]);

  if (
    stats.mostMissed.length === 0 &&
    stats.alwaysNoOpportunity.length === 0 &&
    stats.mostNoOpportunity.length === 0
  ) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
      {stats.mostMissed.length > 0 && (
        <div className="border border-red-100 bg-red-50/50 rounded-xl p-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-red-500" />
            <p className="text-xs font-semibold text-red-700">Most frequently missed</p>
          </div>
          <ul className="space-y-1.5">
            {stats.mostMissed.map((e) => (
              <li key={e.question} className="flex items-start justify-between gap-2 text-xs">
                <span className="text-gray-800 leading-snug flex-1">{e.question}</span>
                <span className="shrink-0 text-red-600 font-semibold whitespace-nowrap">
                  {e.incorrect}/{e.total}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(stats.alwaysNoOpportunity.length > 0 || stats.mostNoOpportunity.length > 0) && (
        <div className="border border-slate-200 bg-slate-50 rounded-xl p-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <EyeOff className="h-3.5 w-3.5 text-slate-500" />
            <p className="text-xs font-semibold text-slate-700">Observation gaps</p>
          </div>
          {stats.alwaysNoOpportunity.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">
                Never observed (always "No opportunity")
              </p>
              <ul className="space-y-1.5">
                {stats.alwaysNoOpportunity.map((e) => (
                  <li key={e.question} className="flex items-start justify-between gap-2 text-xs">
                    <span className="text-gray-800 leading-snug flex-1">{e.question}</span>
                    <span className="shrink-0 text-slate-700 font-semibold whitespace-nowrap">
                      {e.no_opportunity}/{e.total}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {stats.mostNoOpportunity.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">
                Most often "No opportunity"
              </p>
              <ul className="space-y-1.5">
                {stats.mostNoOpportunity.map((e) => (
                  <li key={e.question} className="flex items-start justify-between gap-2 text-xs">
                    <span className="text-gray-800 leading-snug flex-1">{e.question}</span>
                    <span className="shrink-0 text-slate-600 font-semibold whitespace-nowrap">
                      {e.no_opportunity}/{e.total}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TypeBreakdown({ type, certs }: { type: CertType; certs: PromotionCertification[] }) {
  if (certs.length === 0) return null;

  const sorted = [...certs].sort(
    (a, b) => new Date(a.dateCompleted).getTime() - new Date(b.dateCompleted).getTime()
  );
  const latest = sorted[sorted.length - 1];
  const first = sorted[0];
  const delta = sorted.length > 1 ? latest.score - first.score : 0;
  const best = sorted.reduce((m, c) => (c.score > m ? c.score : m), 0);
  const passCount = sorted.filter((c) => c.passed).length;

  const Icon = type === 'mentor' ? Star : Shield;
  const label = type === 'mentor' ? 'Mentor' : 'Shift Lead';
  const accent = type === 'mentor' ? 'text-amber-600' : 'text-blue-600';

  return (
    <div className="border border-gray-200 rounded-xl bg-white p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Icon className={`h-4 w-4 ${accent}`} />
          <p className="text-xs font-semibold text-gray-900">{label} attempts</p>
          <span className="text-xs text-gray-400">({sorted.length})</span>
        </div>
        {sorted.length > 1 && (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-medium ${
              delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-gray-500'
            }`}
            title="Change from first to latest attempt"
          >
            <TrendingUp className={`h-3 w-3 ${delta < 0 ? 'rotate-180' : ''}`} />
            {delta > 0 ? '+' : ''}
            {delta}%
          </span>
        )}
      </div>

      <ScoreSparkline certs={sorted} />

      <div className="grid grid-cols-3 gap-2 mt-2 text-center">
        <div className="bg-gray-50 rounded-lg py-1.5">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Latest</p>
          <p className={`text-sm font-semibold ${latest.passed ? 'text-green-600' : 'text-red-600'}`}>
            {latest.score}%
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg py-1.5">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Best</p>
          <p className="text-sm font-semibold text-gray-800">{best}%</p>
        </div>
        <div className="bg-gray-50 rounded-lg py-1.5">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Passed</p>
          <p className="text-sm font-semibold text-gray-800">
            {passCount}/{sorted.length}
          </p>
        </div>
      </div>

      <ItemBreakdown certs={sorted} />
    </div>
  );
}

export default function CertificationHistory({ certifications }: Props) {
  const [expanded, setExpanded] = useState(false);

  const mentor = certifications.filter((c) => c.certificationType === 'mentor');
  const shift = certifications.filter((c) => c.certificationType === 'shift_lead');

  if (certifications.length === 0) return null;

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-2.5 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 transition-colors"
        aria-expanded={expanded}
        data-testid="button-toggle-cert-history"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-600" />
          <span className="text-xs font-semibold text-gray-900">Score history & breakdown</span>
        </div>
        <span className="text-xs text-gray-500">
          {certifications.length} attempt{certifications.length === 1 ? '' : 's'}
        </span>
      </button>
      {expanded && (
        <div className="mt-2 space-y-3" data-testid="cert-history-panel">
          <TypeBreakdown type="mentor" certs={mentor} />
          <TypeBreakdown type="shift_lead" certs={shift} />
        </div>
      )}
    </div>
  );
}
