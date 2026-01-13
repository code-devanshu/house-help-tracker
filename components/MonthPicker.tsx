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
    <div className="flex items-center justify-end">
      <div
        className={[
          "inline-flex items-center gap-1.5 rounded-2xl px-2 py-2",
          "bg-black/20 backdrop-blur-xl ring-1 ring-white/10",
          "shadow-[0_16px_50px_rgba(0,0,0,0.35)]",
        ].join(" ")}
      >
        <IconBtn
          ariaLabel="Previous month"
          title="Previous month"
          onClick={() => onChange(addMonths(month, -1))}
        >
          ‹
        </IconBtn>

        <div className="px-3 sm:px-4">
          <div className="text-[11px] font-medium tracking-wide text-white/50">
            Month
          </div>
          <div className="text-base font-semibold tracking-tight text-white">
            {monthLabel(month)}
          </div>
        </div>

        <IconBtn
          ariaLabel="Next month"
          title="Next month"
          onClick={() => onChange(addMonths(month, 1))}
        >
          ›
        </IconBtn>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  ariaLabel,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  ariaLabel: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      className={[
        "inline-flex h-10 w-10 items-center justify-center rounded-xl",
        "text-white/80 hover:text-white",
        "hover:bg-white/[0.06]",
        "transition focus:outline-none focus:ring-4 focus:ring-white/10",
      ].join(" ")}
    >
      <span className="text-[20px] leading-none">{children}</span>
    </button>
  );
}
