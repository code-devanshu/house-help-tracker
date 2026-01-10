"use client";

import { monthLabel, addMonths } from "@/lib/utils/date";

export function MonthPicker({
  month,
  onChange,
}: {
  month: Date;
  onChange: (next: Date) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50"
        onClick={() => onChange(addMonths(month, -1))}
      >
        ← Prev
      </button>

      <div className="min-w-xs text-center text-sm font-semibold">
        {monthLabel(month)}
      </div>

      <button
        type="button"
        className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50"
        onClick={() => onChange(addMonths(month, 1))}
      >
        Next →
      </button>
    </div>
  );
}
