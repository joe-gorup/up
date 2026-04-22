import { Search, Plus, Target, Check, ChevronDown, X } from "lucide-react";
import { useState } from "react";

const employees = [
  { name: "Alex Johnson", role: "Super Scooper" },
  { name: "Maria Lopez", role: "Super Scooper" },
  { name: "Sam Chen", role: "Shift Lead" },
  { name: "Jordan Reed", role: "Super Scooper" },
  { name: "Priya Patel", role: "Super Scooper" },
  { name: "Devon Brooks", role: "Mentor" },
];

const roleColor: Record<string, string> = {
  "Super Scooper": "bg-blue-100 text-blue-700",
  "Shift Lead": "bg-emerald-100 text-emerald-700",
  Mentor: "bg-purple-100 text-purple-700",
};

export function EmpMgmtHeaderBtn() {
  const [open, setOpen] = useState(true);
  const [picked, setPicked] = useState<Record<string, boolean>>({
    "Alex Johnson": true,
    "Maria Lopez": true,
    "Jordan Reed": true,
  });

  const count = Object.values(picked).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gray-50 p-6 relative">
      <div className="max-w-[600px] mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Employees</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage your team</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-300 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-50"
            >
              <Target className="w-3.5 h-3.5" />
              Assign Goal to Many
            </button>
            <button className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700">
              <Plus className="w-3.5 h-3.5" />
              Add Employee
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search employees..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-[10px] font-medium text-gray-500 uppercase tracking-wide">
            Employee · Role · Last Login
          </div>
          <div className="divide-y divide-gray-100">
            {employees.map((e) => (
              <div
                key={e.name}
                className="flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50"
              >
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
                  <div className="text-[10px] text-gray-500">2 days ago</div>
                </div>
                <span
                  className={
                    "text-[10px] font-medium px-1.5 py-0.5 rounded " +
                    (roleColor[e.role] ?? "bg-gray-100 text-gray-600")
                  }
                >
                  {e.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-1/2 top-12 -translate-x-1/2 z-20 w-[440px] bg-white rounded-xl shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Target className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Assign Goal to Many Employees
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    Step 2 of 2 · pick employees
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between p-2.5 border border-blue-200 bg-blue-50/40 rounded-lg">
                <div className="text-xs">
                  <div className="font-medium text-gray-900">
                    Customer Service Excellence
                  </div>
                  <div className="text-[11px] text-gray-500">4 steps</div>
                </div>
                <button className="text-[11px] font-medium text-blue-700 hover:underline">
                  Change
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-medium text-gray-700 uppercase tracking-wide">
                    Employees
                  </label>
                  <button className="text-[10px] text-blue-700 hover:underline">
                    Select all
                  </button>
                </div>
                <div className="border border-gray-200 rounded-lg max-h-[180px] overflow-y-auto divide-y divide-gray-100">
                  {employees.map((e) => (
                    <label
                      key={e.name}
                      className="flex items-center gap-2 px-2.5 py-2 text-xs cursor-pointer hover:bg-blue-50/40"
                    >
                      <input
                        type="checkbox"
                        checked={!!picked[e.name]}
                        onChange={(ev) =>
                          setPicked({ ...picked, [e.name]: ev.target.checked })
                        }
                        className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600"
                      />
                      <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-[9px] font-semibold flex items-center justify-center">
                        {e.name
                          .split(" ")
                          .map((s) => s[0])
                          .join("")}
                      </div>
                      <span className="flex-1 truncate">{e.name}</span>
                      <span
                        className={
                          "text-[9px] font-medium px-1 py-0.5 rounded " +
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

            <div className="flex items-center justify-between p-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
              <span className="text-[11px] text-gray-600">
                <span className="font-medium text-gray-900">{count}</span>{" "}
                selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOpen(false)}
                  className="px-3 py-1 text-[11px] font-medium text-gray-700 border border-gray-300 rounded hover:bg-white"
                >
                  Cancel
                </button>
                <button className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-medium bg-blue-600 text-white rounded hover:bg-blue-700">
                  <Check className="w-3 h-3" />
                  Assign to {count}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
