import { Upload, FileText, Award, BookOpen, Users, Target, ChevronRight, Check } from "lucide-react";

const tabs = [
  { key: "assess", label: "Assessment History", icon: FileText },
  { key: "mastered", label: "Mastered Goals", icon: Award },
  { key: "templates", label: "Goal Templates", icon: BookOpen },
  { key: "assign", label: "Assign Goals", icon: Target, active: true },
];

const employees = [
  { name: "Alex Johnson", role: "Super Scooper", checked: true },
  { name: "Maria Lopez", role: "Super Scooper", checked: true },
  { name: "Sam Chen", role: "Shift Lead", checked: false, already: true },
  { name: "Jordan Reed", role: "Super Scooper", checked: true },
  { name: "Priya Patel", role: "Super Scooper", checked: false },
  { name: "Devon Brooks", role: "Mentor", checked: true },
];

export function BulkUploadTab() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-[600px] mx-auto">
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-gray-900">Bulk Upload</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Import data and assign goals at scale
          </p>
        </div>

        <div className="flex items-center gap-1 mb-4 bg-white rounded-lg border border-gray-200 p-1 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                className={
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors " +
                  (t.active
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:bg-gray-50")
                }
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                Assign one goal to many employees
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Pick a template, then choose employees. No CSV needed.
              </p>
            </div>
          </div>

          <div className="mb-4">
            <label className="text-[11px] font-medium text-gray-700 uppercase tracking-wide">
              Goal Template
            </label>
            <div className="mt-1.5 flex items-center justify-between p-3 border border-blue-200 bg-blue-50/40 rounded-lg">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900">
                  Customer Service Excellence
                </div>
                <div className="text-[11px] text-gray-500">
                  4 steps · target 30 days
                </div>
              </div>
              <button className="text-xs font-medium text-blue-700 hover:underline">
                Change
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-medium text-gray-700 uppercase tracking-wide">
                Employees
              </label>
              <div className="flex items-center gap-2 text-[11px]">
                <button className="text-blue-700 hover:underline">
                  Select all eligible
                </button>
                <span className="text-gray-300">·</span>
                <button className="text-gray-500 hover:underline">Clear</button>
              </div>
            </div>

            <label className="flex items-center gap-1.5 text-[11px] text-gray-600 mb-2">
              <input
                type="checkbox"
                defaultChecked
                className="w-3 h-3 rounded border-gray-300 text-blue-600"
              />
              Skip employees who already have this goal
            </label>

            <div className="border border-gray-200 rounded-lg max-h-[260px] overflow-y-auto divide-y divide-gray-100">
              {employees.map((e) => (
                <label
                  key={e.name}
                  className={
                    "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer " +
                    (e.already ? "opacity-60 bg-gray-50" : "hover:bg-blue-50/40")
                  }
                >
                  <input
                    type="checkbox"
                    defaultChecked={e.checked}
                    disabled={e.already}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600"
                  />
                  <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold flex items-center justify-center">
                    {e.name
                      .split(" ")
                      .map((s) => s[0])
                      .join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-900 truncate">
                      {e.name}
                    </div>
                    <div className="text-[10px] text-gray-500">{e.role}</div>
                  </div>
                  {e.already && (
                    <span className="text-[9px] uppercase tracking-wide text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
                      Already assigned
                    </span>
                  )}
                </label>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-gray-500">
                <span className="font-medium text-gray-700">4</span> employees
                selected
              </div>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  <Check className="w-3.5 h-3.5" />
                  Assign to 4 employees
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
