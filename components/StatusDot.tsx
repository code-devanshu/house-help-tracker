import type { ShiftStatus } from "@/lib/storage/schema";

const dotMeta: Record<ShiftStatus, { cls: string; title: string }> = {
  WORKED: { cls: "bg-green-500", title: "Worked" },
  ABSENT: { cls: "bg-red-500", title: "Absent" },
  HALF: { cls: "bg-amber-500", title: "Half" },
  OFF: { cls: "bg-slate-400", title: "Off" },
};

export function StatusDot({
  status,
  size = "sm",
}: {
  status: ShiftStatus;
  size?: "sm" | "md";
}) {
  const meta = dotMeta[status];
  const dim = size === "md" ? "h-2.5 w-2.5" : "h-2 w-2";

  return (
    <span
      className={[
        "inline-block rounded-full",
        "ring-2 ring-white",
        dim,
        meta.cls,
      ].join(" ")}
      title={meta.title}
      aria-label={meta.title}
    />
  );
}
