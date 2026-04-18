"use client";

import { monthLabel, addMonths } from "@/lib/utils/date";

type MonthPickerProps = {
  month: Date;
  onChange: (next: Date) => void;
  min?: Date; // earliest allowed month (inclusive)
  max?: Date; // latest allowed month (inclusive)
};

export function MonthPicker({ month, onChange, min, max }: MonthPickerProps) {
  const prev = addMonths(month, -1);
  const next = addMonths(month, 1);

  const canGoPrev = !min || prev >= min;
  const canGoNext = !max || next <= max;

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-white/8 bg-white/4 px-1.5 py-1 shadow-sm backdrop-blur">
      <NavBtn label="Previous month" disabled={!canGoPrev} onClick={() => canGoPrev && onChange(prev)}>
        <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </NavBtn>

      <span className="min-w-27.5 px-2 text-center text-sm font-semibold text-white/85">
        {monthLabel(month)}
      </span>

      <NavBtn label="Next month" disabled={!canGoNext} onClick={() => canGoNext && onChange(next)}>
        <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none">
          <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </NavBtn>
    </div>
  );
}

function NavBtn({ children, onClick, label, disabled }: { children: React.ReactNode; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className={`flex h-7 w-7 items-center justify-center rounded-lg transition focus:outline-none focus:ring-2 focus:ring-white/15 ${
        disabled ? "cursor-not-allowed text-white/15" : "text-white/50 hover:bg-white/[0.07] hover:text-white/90"
      }`}
    >
      {children}
    </button>
  );
}
