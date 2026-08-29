import { FileText, Award, BookOpen, Target, Upload, ChevronRight } from "lucide-react";

const actions = [
  {
    icon: FileText,
    title: "Import Assessment History",
    desc: "Upload a CSV of past assessments",
    type: "CSV import",
    color: "text-purple-600 bg-purple-50",
  },
  {
    icon: Award,
    title: "Import Mastered Goals",
    desc: "Upload a CSV of completed goals",
    type: "CSV import",
    color: "text-amber-600 bg-amber-50",
  },
  {
    icon: BookOpen,
    title: "Import Goal Templates",
    desc: "Upload a CSV of templates and steps",
    type: "CSV import",
    color: "text-emerald-600 bg-emerald-50",
  },
  {
    icon: Target,
    title: "Assign Goal to Many Employees",
    desc: "Pick a template, choose employees, done",
    type: "Guided action",
    color: "text-blue-600 bg-blue-50",
    highlight: true,
  },
];

export function BulkUploadHub() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-[600px] mx-auto">
        <div className="mb-5">
          <h1 className="text-xl font-semibold text-gray-900">Bulk Upload</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Import data via CSV or run guided bulk actions
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.title}
                className={
                  "group text-left p-4 bg-white rounded-xl border transition-all " +
                  (a.highlight
                    ? "border-blue-300 ring-2 ring-blue-100 shadow-sm"
                    : "border-gray-200 hover:border-gray-300 hover:shadow-sm")
                }
              >
                <div className="flex items-start gap-3">
                  <div
                    className={
                      "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 " +
                      a.color
                    }
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 leading-tight">
                        {a.title}
                      </h3>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-600 shrink-0" />
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                      {a.desc}
                    </p>
                    <span
                      className={
                        "inline-block mt-2 text-[9px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded " +
                        (a.type === "Guided action"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-600")
                      }
                    >
                      {a.type}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-5 p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-2">
          <Target className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-900">
            <span className="font-medium">New:</span> Assign one goal to many
            employees in seconds — no spreadsheet required. Replaces the old
            per-employee assignment flow.
          </div>
        </div>
      </div>
    </div>
  );
}
