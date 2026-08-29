import { Search, Plus, Target, Mail, Archive, X } from "lucide-react";

const employees = [
  { name: "Alex Johnson", email: "alex@scoop.com", role: "Super Scooper", checked: true },
  { name: "Maria Lopez", email: "maria@scoop.com", role: "Super Scooper", checked: true },
  { name: "Sam Chen", email: "sam@scoop.com", role: "Shift Lead", checked: false },
  { name: "Jordan Reed", email: "jordan@scoop.com", role: "Super Scooper", checked: true },
  { name: "Priya Patel", email: "priya@scoop.com", role: "Super Scooper", checked: false },
  { name: "Devon Brooks", email: "devon@scoop.com", role: "Mentor", checked: false },
];

const roleColor: Record<string, string> = {
  "Super Scooper": "bg-blue-100 text-blue-700",
  "Shift Lead": "bg-emerald-100 text-emerald-700",
  Mentor: "bg-purple-100 text-purple-700",
};

export function EmpMgmtToolbar() {
  const selected = employees.filter((e) => e.checked).length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-[600px] mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Employees</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Manage your team and bulk-assign goals
            </p>
          </div>
          <button className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700">
            <Plus className="w-3.5 h-3.5" />
            Add Employee
          </button>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search employees..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-400 focus:outline-none"
            />
          </div>
          <div className="inline-flex bg-white border border-gray-300 rounded-lg p-0.5">
            {["All", "Active", "Inactive"].map((f, i) => (
              <button
                key={f}
                className={
                  "px-2.5 py-1 text-[11px] font-medium rounded " +
                  (i === 1 ? "bg-gray-100 text-gray-900" : "text-gray-500")
                }
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {selected > 0 && (
          <div className="mb-3 flex items-center justify-between px-3 py-2 bg-blue-600 text-white rounded-lg shadow-sm">
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white text-blue-700 text-[10px] font-bold">
                {selected}
              </span>
              <span className="font-medium">selected</span>
            </div>
            <div className="flex items-center gap-1">
              <button className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-blue-700 text-[11px] font-medium rounded hover:bg-blue-50">
                <Target className="w-3 h-3" />
                Assign goal
              </button>
              <button className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-white/90 hover:bg-blue-700 rounded">
                <Mail className="w-3 h-3" />
                Invite
              </button>
              <button className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-white/90 hover:bg-blue-700 rounded">
                <Archive className="w-3 h-3" />
                Deactivate
              </button>
              <span className="w-px h-4 bg-blue-400 mx-1" />
              <button className="p-1 text-white/80 hover:text-white" title="Clear">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[24px_1fr_100px] gap-3 px-3 py-2 bg-gray-50 border-b border-gray-200 text-[10px] font-medium text-gray-500 uppercase tracking-wide">
            <span>
              <input
                type="checkbox"
                className="w-3 h-3 rounded border-gray-300 text-blue-600"
              />
            </span>
            <span>Employee</span>
            <span>Role</span>
          </div>
          <div className="divide-y divide-gray-100">
            {employees.map((e) => (
              <label
                key={e.name}
                className={
                  "grid grid-cols-[24px_1fr_100px] gap-3 px-3 py-2.5 items-center cursor-pointer " +
                  (e.checked ? "bg-blue-50/40" : "hover:bg-gray-50")
                }
              >
                <input
                  type="checkbox"
                  defaultChecked={e.checked}
                  className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600"
                />
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold flex items-center justify-center shrink-0">
                    {e.name
                      .split(" ")
                      .map((s) => s[0])
                      .join("")}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-gray-900 truncate">
                      {e.name}
                    </div>
                    <div className="text-[10px] text-gray-500 truncate">
                      {e.email}
                    </div>
                  </div>
                </div>
                <span
                  className={
                    "text-[10px] font-medium px-1.5 py-0.5 rounded justify-self-start " +
                    (roleColor[e.role] ?? "bg-gray-100 text-gray-600")
                  }
                >
                  {e.role}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
