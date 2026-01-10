"use client";

import { useMemo } from "react";

type SalaryBreakdown = {
  worked: number;
  half: number;
  absent: number;
  off: number;
};

type Props = {
  monthKey: string;
  daysInMonth: number;
  totals: SalaryBreakdown;

  savedMonthlySalary: number;
  savedPaidOffAllowance: number;

  salaryDraft: string;
  paidOffDraft: string;

  disabled?: boolean;

  onSalaryDraftChange: (value: string) => void;
  onPaidOffDraftChange: (value: string) => void;
  onSave: () => void;
};

const clampInt = (n: number, min: number, max: number) => {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
};

const toNum = (v: string): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const money = (n: number): string => {
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n));
};

const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

export function SalaryCard({
  monthKey,
  daysInMonth,
  totals,

  savedMonthlySalary,
  savedPaidOffAllowance,

  salaryDraft,
  paidOffDraft,

  disabled = false,

  onSalaryDraftChange,
  onPaidOffDraftChange,
  onSave,
}: Props) {
  const monthlySalary = useMemo(
    () => clampInt(toNum(salaryDraft), 0, 1_000_000_000),
    [salaryDraft]
  );

  const paidOffAllowance = useMemo(
    () => clampInt(toNum(paidOffDraft), 0, 366),
    [paidOffDraft]
  );

  const perDay = useMemo(
    () => (daysInMonth > 0 ? monthlySalary / daysInMonth : 0),
    [monthlySalary, daysInMonth]
  );
  const halfDay = perDay / 2;

  const paidOffCount = Math.min(totals.off, paidOffAllowance);
  const unpaidOffCount = Math.max(0, totals.off - paidOffAllowance);

  const workedAmt = totals.worked * perDay;
  const halfAmt = totals.half * halfDay;
  const absentAmt = 0;
  const offAmt = paidOffCount * perDay;

  const payable = workedAmt + halfAmt + absentAmt + offAmt;

  const isDirty =
    monthlySalary !== (savedMonthlySalary ?? 0) ||
    paidOffAllowance !== (savedPaidOffAllowance ?? 0);

  const disabledMsg = disabled
    ? "Month is locked. Unlock to edit salary."
    : isDirty
    ? "Changes not saved yet."
    : "Saved and applied instantly.";

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
        <div className="min-w-[260px]">
          <div className="flex items-center gap-2">
            <div className="text-base font-semibold tracking-tight text-slate-900">
              Salary
            </div>

            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
              {monthKey}
            </span>

            {disabled ? (
              <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                Locked
              </span>
            ) : null}
          </div>

          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Monthly salary is split across{" "}
            <span className="font-semibold text-slate-700">{daysInMonth}</span>{" "}
            days. OFF is paid only up to the allowance.
          </p>
        </div>

        {/* Payable card */}
        <div
          className={cx(
            "rounded-2xl border px-5 py-4",
            "border-slate-200 bg-slate-50",
            "min-w-[220px]"
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold text-slate-600">
              Payable (auto)
            </div>
            <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200">
              OFF: {paidOffCount} paid
              {unpaidOffCount ? ` • ${unpaidOffCount} unpaid` : ""}
            </span>
          </div>

          <div className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
            ₹{money(payable)}
          </div>

          <div className="mt-1 text-xs text-slate-500">
            Based on attendance for this month
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="border-t border-slate-200 px-6 py-6">
        <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          {/* Inputs panel */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Settings
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Update salary and OFF allowance for this month.
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                Per-day: ₹{money(perDay)}
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 sm:items-start">
              {/* Monthly salary */}
              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-slate-800">
                  Monthly salary (₹)
                </span>

                <input
                  type="number"
                  min={0}
                  step={1}
                  disabled={disabled}
                  value={salaryDraft}
                  onChange={(e) => onSalaryDraftChange(e.target.value)}
                  className={cx(
                    "h-11 rounded-xl border px-3 text-sm outline-none",
                    "border-slate-200 bg-white text-slate-900",
                    !disabled && "focus:ring-4 focus:ring-slate-100",
                    disabled && "bg-slate-50 text-slate-500"
                  )}
                  placeholder="e.g., 12000"
                />

                {/* placeholder helper line to keep alignment */}
                <span className="text-xs text-transparent select-none">
                  placeholder
                </span>
              </label>

              {/* Paid OFF allowance */}
              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-slate-800">
                  Paid OFF allowance (days)
                </span>

                <input
                  type="number"
                  min={0}
                  step={1}
                  disabled={disabled}
                  value={paidOffDraft}
                  onChange={(e) => onPaidOffDraftChange(e.target.value)}
                  className={cx(
                    "h-11 rounded-xl border px-3 text-sm outline-none",
                    "border-slate-200 bg-white text-slate-900",
                    !disabled && "focus:ring-4 focus:ring-slate-100",
                    disabled && "bg-slate-50 text-slate-500"
                  )}
                  placeholder="e.g., 4"
                />

                <span className="text-xs text-slate-500">
                  Extra OFF days beyond allowance become unpaid (₹0).
                </span>
              </label>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={disabled || !isDirty}
                onClick={onSave}
                className={cx(
                  "h-11 rounded-xl px-4 text-sm font-semibold transition",
                  disabled || !isDirty
                    ? "cursor-not-allowed bg-slate-200 text-slate-500"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                )}
              >
                Save salary
              </button>

              <div className="text-sm text-slate-600">{disabledMsg}</div>
            </div>
          </div>

          {/* Derived rates panel */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm font-semibold text-slate-900">
              Derived rates
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Auto-calculated from monthly salary and actual days.
            </div>

            <div className="mt-4 grid gap-2">
              <RateRow label="Worked / day" value={`₹${money(perDay)}`} />
              <RateRow label="Half-day" value={`₹${money(halfDay)}`} />
              <RateRow label="Absent" value="₹0" />
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">
                    OFF
                  </div>
                  <div className="text-sm font-extrabold text-slate-900">
                    ₹{money(perDay)}{" "}
                    <span className="text-xs font-semibold text-slate-500">
                      (paid)
                    </span>
                  </div>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {paidOffCount} paid, {unpaidOffCount} unpaid
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Breakdown tiles */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <BreakTile
            title="Worked"
            subtitle={`${totals.worked} × ₹${money(perDay)}`}
            amount={`₹${money(workedAmt)}`}
            accent="border-l-emerald-500 bg-emerald-50/40"
          />
          <BreakTile
            title="Half"
            subtitle={`${totals.half} × ₹${money(halfDay)}`}
            amount={`₹${money(halfAmt)}`}
            accent="border-l-amber-500 bg-amber-50/40"
          />
          <BreakTile
            title="Absent"
            subtitle={`${totals.absent} × ₹0`}
            amount="₹0"
            accent="border-l-rose-500 bg-rose-50/40"
          />
          <BreakTile
            title="Off"
            subtitle={`${paidOffCount} paid • ${unpaidOffCount} unpaid`}
            amount={`₹${money(offAmt)}`}
            accent="border-l-slate-500 bg-slate-50"
          />
        </div>
      </div>
    </section>
  );
}

function RateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-sm font-semibold text-slate-900">{label}</div>
      <div className="text-sm font-extrabold text-slate-900">{value}</div>
    </div>
  );
}

function BreakTile({
  title,
  subtitle,
  amount,
  accent,
}: {
  title: string;
  subtitle: string;
  amount: string;
  accent: string;
}) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-slate-200 p-4 shadow-sm",
        "border-l-4",
        accent
      )}
    >
      <div className="text-xs font-semibold text-slate-600">{title}</div>
      <div className="mt-1 text-sm font-semibold text-slate-800">
        {subtitle}
      </div>
      <div className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900">
        {amount}
      </div>
    </div>
  );
}
