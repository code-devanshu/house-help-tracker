import type { ShiftStatus } from "@/lib/storage/schema";

const statusMeta: Record<ShiftStatus, { label: string; cls: string }> = {
  WORKED: { label: "Worked", cls: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25" },
  ABSENT: { label: "Absent", cls: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/25" },
  HALF:   { label: "Half",   cls: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25" },
  OFF:    { label: "Off",    cls: "bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/25" },
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
