"use client";

import { useMemo, useState } from "react";
import type { Deduction } from "@/lib/storage/schema";
import { Toggle } from "./Toggle";

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

  // ✅ Deductions (Plan B)
  deductions?: Deduction[];
  onAddDeduction?: (
    next: Omit<Deduction, "id" | "createdAt" | "updatedAt">
  ) => void;
  onDeleteDeduction?: (deductionId: string) => void;
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

const surface =
  "rounded-3xl border border-white/10 bg-white/[0.05] shadow-[0_20px_60px_rgba(0,0,0,0.35)]";
const surfaceHeader = "border-b border-white/10";
const muted = "text-white/60";
const muted2 = "text-white/45";

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

  deductions,
  onAddDeduction,
  onDeleteDeduction,
}: Props) {
  // ✅ Defensive: never crash if parent passes undefined/wrong type
  const safeDeductions: Deduction[] = useMemo(
    () => (Array.isArray(deductions) ? deductions : []),
    [deductions]
  );

  const [enabled, setEnabled] = useState(false);

  const canAddDeductionHandler = typeof onAddDeduction === "function";
  const canDeleteDeductionHandler = typeof onDeleteDeduction === "function";

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

  const grossPayable = workedAmt + halfAmt + absentAmt + offAmt;

  const deductionsTotal = useMemo(() => {
    let sum = 0;
    for (const d of safeDeductions) {
      const amt = Number(d.amount);
      if (Number.isFinite(amt) && amt > 0) sum += amt;
    }
    return sum;
  }, [safeDeductions]);

  const netPayable = Math.max(0, grossPayable - deductionsTotal);

  const isDirty =
    monthlySalary !== (savedMonthlySalary ?? 0) ||
    paidOffAllowance !== (savedPaidOffAllowance ?? 0);

  const disabledMsg = disabled
    ? "Month is locked. Unlock to edit salary."
    : isDirty
    ? "Changes not saved yet."
    : "Saved and applied instantly.";

  // -------------------------
  // Deduction Draft UI
  // -------------------------
  const [deductAmount, setDeductAmount] = useState<string>("");
  const [deductNote, setDeductNote] = useState<string>("");
  const [deductDate, setDeductDate] = useState<string>(() => {
    // default: first day of that month if possible, else fallback today
    const safe = `${monthKey}-01`;
    return safe;
  });

  const canAddDeduction = useMemo(() => {
    const amt = Number(deductAmount);
    return Number.isFinite(amt) && amt > 0;
  }, [deductAmount]);

  const handleAddDeduction = () => {
    if (disabled) return;
    if (!canAddDeductionHandler) return;
    if (!canAddDeduction) return;

    const amt = Math.round(Number(deductAmount));
    const next = {
      workerId: safeDeductions[0]?.workerId ?? "", // parent should provide correct workerId in real usage
      monthKey,
      dateISO: deductDate || `${monthKey}-01`,
      amount: amt,
      note: deductNote.trim() || undefined,
    } as Omit<Deduction, "id" | "createdAt" | "updatedAt">;

    // NOTE: workerId should be passed correctly from parent; if you want this component
    // to be fully self-sufficient, add `workerId` to Props. For now we keep it parent-driven.
    onAddDeduction(next);

    setDeductAmount("");
    setDeductNote("");
  };

  const handleDeleteDeduction = (id: string) => {
    if (disabled) return;
    if (!canDeleteDeductionHandler) return;
    onDeleteDeduction(id);
  };

  return (
    <section className={cx(surface, "text-white")}>
      {/* Header */}
      <div className={cx(surfaceHeader, "px-2 sm:px-6 py-5")}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-[260px]">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-base font-semibold tracking-tight text-white/90">
                Salary
              </div>

              <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/70 ring-1 ring-white/10">
                {monthKey}
              </span>

              {disabled ? (
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/80 ring-1 ring-white/15">
                  Locked
                </span>
              ) : null}
            </div>

            <p className={cx("mt-1 text-sm leading-relaxed", muted)}>
              Monthly salary is split across{" "}
              <span className="font-semibold text-white">{daysInMonth}</span>{" "}
              days. OFF is paid only up to the allowance.
            </p>

            <div className="flex items-center gap-4 mt-3">
              <Toggle value={enabled} onChange={setEnabled} />

              <span className="text-sm text-white/70">Enable Settings</span>
            </div>
          </div>

          {/* Payable */}
          <div className="min-w-[260px] w-full sm:w-auto rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.09] to-white/[0.04] px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className={cx("text-xs font-semibold", muted)}>
                Net payable (auto)
              </div>

              <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] font-semibold text-white/70 ring-1 ring-white/10">
                OFF: {paidOffCount} paid
                {unpaidOffCount ? ` • ${unpaidOffCount} unpaid` : ""}
              </span>
            </div>

            <div className="mt-2 text-3xl font-extrabold tracking-tight text-white">
              ₹{money(netPayable)}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className={muted2}>Gross: ₹{money(grossPayable)}</span>
              <span className="text-white/20">•</span>
              <span className="text-white/70">
                Deductions: ₹{money(deductionsTotal)}
              </span>
            </div>

            <div className={cx("mt-1 text-xs", muted2)}>
              Based on attendance for this month
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-2 sm:px-6 py-6">
        <div
          className={`grid gap-4 lg:grid-cols-[1.25fr_0.75fr] ${
            enabled ? "" : "hidden"
          }`}
        >
          {/* Settings */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white/90">
                  Settings
                </div>
                <div className={cx("mt-1 text-xs", muted2)}>
                  Update salary and OFF allowance for this month.
                </div>
              </div>

              <div className="rounded-xl bg-white/5 px-3 py-2 text-[11px] font-semibold text-white/70 ring-1 ring-white/10">
                Per-day: ₹{money(perDay)}
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 sm:items-start">
              {/* Monthly salary */}
              <label className="grid gap-2">
                <span className="text-sm font-medium text-white/80">
                  Monthly salary <span className="text-white/40">(₹)</span>
                </span>

                <input
                  type="number"
                  min={0}
                  step={1}
                  disabled={disabled}
                  value={salaryDraft}
                  onChange={(e) => onSalaryDraftChange(e.target.value)}
                  className={cx(
                    "h-11 rounded-xl border px-4 text-sm outline-none transition",
                    "border-white/10 bg-white/[0.03] text-white placeholder:text-white/30",
                    !disabled &&
                      "focus:border-indigo-400/50 focus:ring-4 focus:ring-indigo-500/15",
                    disabled && "opacity-60"
                  )}
                  placeholder="e.g., 12000"
                />

                <span className="min-h-[16px] text-xs text-white/35" />
              </label>

              {/* Paid OFF allowance */}
              <label className="grid gap-2">
                <span className="text-sm font-medium text-white/80">
                  Paid OFF allowance{" "}
                  <span className="text-white/40">(days)</span>
                </span>

                <input
                  type="number"
                  min={0}
                  step={1}
                  disabled={disabled}
                  value={paidOffDraft}
                  onChange={(e) => onPaidOffDraftChange(e.target.value)}
                  className={cx(
                    "h-11 rounded-xl border px-4 text-sm outline-none transition",
                    "border-white/10 bg-white/[0.03] text-white placeholder:text-white/30",
                    !disabled &&
                      "focus:border-indigo-400/50 focus:ring-4 focus:ring-indigo-500/15",
                    disabled && "opacity-60"
                  )}
                  placeholder="e.g., 4"
                />

                <span className="text-xs text-white/45">
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
                  "h-11 rounded-xl px-4 text-sm font-semibold transition focus:outline-none focus:ring-4",
                  disabled || !isDirty
                    ? "cursor-not-allowed bg-white/10 text-white/40"
                    : "bg-white text-slate-900 hover:brightness-95 focus:ring-white/20"
                )}
              >
                Save salary
              </button>

              <div className={cx("text-sm", muted)}>{disabledMsg}</div>
            </div>
          </div>

          {/* Derived rates */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-5">
            <div className="text-sm font-semibold text-white/90">
              Derived rates
            </div>
            <div className={cx("mt-1 text-xs", muted2)}>
              Auto-calculated from monthly salary and actual days.
            </div>

            <div className="mt-4 grid gap-2">
              <RateRow label="Worked / day" value={`₹${money(perDay)}`} />
              <RateRow label="Half-day" value={`₹${money(halfDay)}`} />
              <RateRow label="Absent" value="₹0" />

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-white/85">OFF</div>

                  <div className="text-sm font-extrabold text-white">
                    ₹{money(perDay)}{" "}
                    <span className="text-xs font-semibold text-white/45">
                      (paid)
                    </span>
                  </div>
                </div>

                <div className={cx("mt-1 text-xs", muted2)}>
                  {paidOffCount} paid, {unpaidOffCount} unpaid
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ✅ Deductions panel */}
        <div
          className={`mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-5 ${
            enabled ? "" : "hidden"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white/90">
                Deductions
              </div>
              <div className={cx("mt-1 text-xs", muted2)}>
                Track advance money / deductions to subtract from payable.
              </div>
            </div>

            <div className="rounded-xl bg-white/5 px-3 py-2 text-[11px] font-semibold text-white/70 ring-1 ring-white/10">
              Total: ₹{money(deductionsTotal)}
            </div>
          </div>

          {/* Add row */}
          <div className="mt-4 grid gap-3 lg:grid-cols-[220px_1fr_260px]">
            {/* Date */}
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-white/70">Date</span>
              <input
                type="date"
                value={deductDate}
                onChange={(e) => setDeductDate(e.target.value)}
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white/90 outline-none transition focus:border-indigo-400/50 focus:ring-4 focus:ring-indigo-500/15"
              />
            </label>

            {/* Note */}
            <label className="grid gap-2 min-w-0">
              <span className="text-sm font-semibold text-white/70">Note</span>
              <input
                value={deductNote}
                onChange={(e) => setDeductNote(e.target.value)}
                placeholder="e.g., advance / festival / groceries"
                className="h-11 w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white/90 placeholder:text-white/30 outline-none transition focus:border-indigo-400/50 focus:ring-4 focus:ring-indigo-500/15"
              />
            </label>

            {/* Amount + Add */}
            <div className="grid gap-2">
              <span className="text-sm font-semibold text-white/70">
                Amount (₹)
              </span>

              <div className="flex w-full min-w-[240px] items-stretch gap-2">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={deductAmount}
                  onChange={(e) => setDeductAmount(e.target.value)}
                  placeholder="e.g., 500"
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white/90 placeholder:text-white/30 outline-none transition focus:border-indigo-400/50 focus:ring-4 focus:ring-indigo-500/15"
                />

                <button
                  type="button"
                  onClick={handleAddDeduction}
                  disabled={disabled || !canAddDeduction}
                  className={[
                    "h-11 shrink-0 rounded-xl px-5 text-sm font-semibold transition",
                    disabled || !canAddDeduction
                      ? "cursor-not-allowed bg-white/10 text-white/40"
                      : "bg-white text-slate-900 hover:brightness-95",
                  ].join(" ")}
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Hint if parent not wired */}
          {!canAddDeductionHandler ? (
            <div className="mt-3 text-xs text-amber-200/80">
              Deductions UI is visible, but add/delete handlers are not wired
              from parent yet (no crash — just disabled).
            </div>
          ) : null}

          {/* List */}
          <div className="mt-4">
            {safeDeductions.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/60">
                No deductions added for this month.
              </div>
            ) : (
              <div className="grid gap-2">
                {safeDeductions.map((d) => (
                  <div
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <div className="text-sm font-semibold text-white/85">
                          ₹{money(d.amount)}
                        </div>
                        <span className="text-white/20">•</span>
                        <div className="text-xs text-white/55">{d.dateISO}</div>
                        {d.note ? (
                          <>
                            <span className="text-white/20">•</span>
                            <div className="text-xs text-white/60 truncate max-w-[520px]">
                              {d.note}
                            </div>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={disabled || !canDeleteDeductionHandler}
                      onClick={() => handleDeleteDeduction(d.id)}
                      className={cx(
                        "h-9 rounded-xl px-3 text-xs font-semibold transition focus:outline-none focus:ring-4",
                        disabled || !canDeleteDeductionHandler
                          ? "cursor-not-allowed bg-white/10 text-white/40"
                          : "bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 focus:ring-rose-500/30"
                      )}
                      title={
                        disabled
                          ? "Month is locked"
                          : !canDeleteDeductionHandler
                          ? "Delete handler not wired"
                          : "Delete deduction"
                      }
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Breakdown tiles */}
        <div className="mt-5 grid grid-cols-1 gap-3 grid-cols-2 lg:grid-cols-4">
          <BreakTile
            title="Worked"
            subtitle={`${totals.worked} × ₹${money(perDay)}`}
            amount={`₹${money(workedAmt)}`}
            tone="emerald"
          />
          <BreakTile
            title="Half"
            subtitle={`${totals.half} × ₹${money(halfDay)}`}
            amount={`₹${money(halfAmt)}`}
            tone="amber"
          />
          <BreakTile
            title="Absent"
            subtitle={`${totals.absent} × ₹0`}
            amount="₹0"
            tone="rose"
          />
          <BreakTile
            title="Off"
            subtitle={`${paidOffCount} paid • ${unpaidOffCount} unpaid`}
            amount={`₹${money(offAmt)}`}
            tone="slate"
          />
        </div>
      </div>
    </section>
  );
}

function RateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-sm font-semibold text-white/80">{label}</div>
      <div className="text-sm font-extrabold text-white">{value}</div>
    </div>
  );
}

function BreakTile({
  title,
  subtitle,
  amount,
  tone,
}: {
  title: string;
  subtitle: string;
  amount: string;
  tone: "emerald" | "amber" | "rose" | "slate";
}) {
  const toneStyles: Record<typeof tone, { bar: string }> = {
    emerald: { bar: "bg-emerald-400/70" },
    amber: { bar: "bg-amber-400/70" },
    rose: { bar: "bg-rose-400/70" },
    slate: { bar: "bg-white/25" },
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
      <div
        className={cx("absolute left-0 top-0 h-full w-1", toneStyles[tone].bar)}
      />
      <div className="pl-2">
        <div className="text-xs font-semibold text-white/60">{title}</div>
        <div className="mt-1 text-sm font-semibold text-white/80">
          {subtitle}
        </div>
        <div className="mt-3 text-2xl font-extrabold tracking-tight text-white">
          {amount}
        </div>
      </div>
    </div>
  );
}
