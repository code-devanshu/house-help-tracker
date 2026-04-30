import type { ShiftStatus } from "@/lib/storage/schema";

const statusMeta: Record<ShiftStatus, { label: string; cls: string }> = {
  WORKED: { label: "Worked", cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/25" },
  ABSENT: { label: "Absent", cls: "bg-rose-50 text-rose-600 ring-1 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/25" },
  HALF:   { label: "Half",   cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/25" },
  OFF:    { label: "Off",    cls: "bg-slate-100 text-slate-500 ring-1 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/25" },
};

export function StatusPill({ status, compact = false }: { status: ShiftStatus; compact?: boolean }) {
  const meta = statusMeta[status];
  return (
    <span
      className={[
        "inline-flex items-center justify-center rounded-full font-semibold whitespace-nowrap",
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        meta.cls,
      ].join(" ")}
      title={meta.label}
    >
      {meta.label}
    </span>
  );
}
