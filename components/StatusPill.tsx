import type { ShiftStatus } from "@/lib/storage/schema";

const statusMeta: Record<
  ShiftStatus,
  { label: string; short: string; cls: string }
> = {
  WORKED: {
    label: "Worked",
    short: "W",
    cls: "bg-green-100 text-green-800 border-green-200",
  },
  ABSENT: {
    label: "Absent",
    short: "A",
    cls: "bg-red-100 text-red-800 border-red-200",
  },
  HALF: {
    label: "Half",
    short: "H",
    cls: "bg-amber-100 text-amber-800 border-amber-200",
  },
  OFF: {
    label: "Off",
    short: "O",
    cls: "bg-slate-100 text-slate-800 border-slate-200",
  },
};

export function StatusPill({
  status,
  compact = false,
}: {
  status: ShiftStatus;
  compact?: boolean;
}) {
  const meta = statusMeta[status];

  return (
    <span
      className={[
        // allow shrinking inside flex containers
        "min-w-0 max-w-full",
        // visual
        "inline-flex items-center justify-center rounded-full border font-semibold",
        // responsive sizing
        compact
          ? "px-1.5 py-0.5 text-[10px] leading-none"
          : "px-2 py-0.5 text-xs leading-none",
        // critical: prevent overflow
        "whitespace-nowrap overflow-hidden text-ellipsis",
        meta.cls,
      ].join(" ")}
      title={meta.label}
    >
      {/* On small screens show short label; on sm+ show full */}
      <span className="sm:hidden">{compact ? meta.short : meta.label}</span>
      <span className="hidden sm:inline">{meta.label}</span>
    </span>
  );
}
