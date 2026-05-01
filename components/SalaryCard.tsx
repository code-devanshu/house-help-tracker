"use client";

import { useMemo, useState } from "react";
import type { Deduction } from "@/lib/storage/schema";

type SalaryBreakdown = { worked: number; half: number; absent: number; off: number };

type Props = {
  workerId?: string;
  monthKey: string;
  daysInMonth: number;
  totals: SalaryBreakdown;
  savedMonthlySalary: number;
  savedPaidOffAllowance: number;
  salaryDraft: string;
  paidOffDraft: string;
  disabled?: boolean;
  onSalaryDraftChange: (v: string) => void;
  onPaidOffDraftChange: (v: string) => void;
  onSave: () => void;
  deductions?: Deduction[];
  onAddDeduction?: (next: Omit<Deduction, "id" | "createdAt" | "updatedAt">) => void;
  onDeleteDeduction?: (id: string) => void;
  isGrouped?: boolean;
};

const toNum = (v: string) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number.isFinite(n) ? n : min)));
const money = (n: number) => { if (!Number.isFinite(n)) return "0"; const r = Math.round(n); return r.toLocaleString("en-IN"); };

export function SalaryCard({
  workerId = "",
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
  isGrouped = false,
}: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deductAmount, setDeductAmount] = useState("");
  const [deductNote, setDeductNote] = useState("");

  const safeDeductions = useMemo(() => (Array.isArray(deductions) ? deductions : []), [deductions]);

  const monthlySalary = useMemo(() => clamp(toNum(salaryDraft), 0, 1_000_000_000), [salaryDraft]);
  const paidOffAllowance = useMemo(() => clamp(toNum(paidOffDraft), 0, 366), [paidOffDraft]);
  const perDay = daysInMonth > 0 ? monthlySalary / daysInMonth : 0;
  const halfDay = perDay / 2;
  // Each absent = 1 day shortfall, each half = 0.5 day shortfall, each off = 1 day shortfall.
  // The paid-off allowance absorbs however many day-equivalents it can, regardless of status type.
  const totalShortfall = totals.absent + totals.half * 0.5 + totals.off;
  const coveredByAllowance = Math.min(totalShortfall, paidOffAllowance);
  const grossPayable = totals.worked * perDay + totals.half * halfDay + coveredByAllowance * perDay;
  const deductionsTotal = useMemo(() => safeDeductions.reduce((s, d) => { const a = Number(d.amount); return s + (Number.isFinite(a) && a > 0 ? a : 0); }, 0), [safeDeductions]);
  const netPayable = Math.max(0, grossPayable - deductionsTotal);
  const isDirty = monthlySalary !== (savedMonthlySalary ?? 0) || paidOffAllowance !== (savedPaidOffAllowance ?? 0);

  const canAddDeduction = useMemo(() => { const a = Number(deductAmount); return Number.isFinite(a) && a > 0; }, [deductAmount]);

  const handleAddDeduction = () => {
    if (disabled || !onAddDeduction || !canAddDeduction) return;
    onAddDeduction({ workerId, monthKey, dateISO: `${monthKey}-01`, amount: Math.round(Number(deductAmount)), note: deductNote.trim() || undefined });
    setDeductAmount(""); setDeductNote("");
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white text-slate-900 dark:border-white/7 dark:bg-white/2.5 dark:text-white">

      {/* ── Header row ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 dark:border-white/7">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-800 dark:text-white/85">Salary</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-white/6 dark:text-white/45">{monthKey}</span>
            {disabled && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300 ring-1 ring-amber-500/20">Locked</span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-white/40">
            ₹{money(perDay)}/day · {daysInMonth} days in month
          </p>
        </div>

        {/* Net payable pill */}
        <div className="min-w-[180px] rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3">
          <div className="text-[11px] font-medium text-emerald-400/70">Net payable</div>
          <div className="mt-0.5 text-2xl font-bold tracking-tight text-emerald-300">₹{money(netPayable)}</div>
          <div className="mt-1 text-[11px] text-slate-400 dark:text-white/35">
            Gross ₹{money(grossPayable)}
            {deductionsTotal > 0 && <span className="text-rose-400/70"> − ₹{money(deductionsTotal)}</span>}
          </div>
        </div>
      </div>

      {/* ── Breakdown tiles ── */}
      <div className="grid grid-cols-2 gap-2.5 border-b border-slate-100 px-5 py-4 dark:border-white/7 lg:grid-cols-4">
        {[
          { title: "Worked", sub: `${totals.worked} × ₹${money(perDay)}`, amt: totals.worked * perDay, color: "text-emerald-400", bar: "bg-emerald-400/60" },
          { title: "Half day", sub: `${totals.half} × ₹${money(halfDay)}`, amt: totals.half * halfDay, color: "text-amber-400", bar: "bg-amber-400/60" },
          { title: "Absent", sub: `${totals.absent} × ₹0`, amt: 0, color: "text-rose-400", bar: "bg-rose-400/60" },
          { title: "Allowance", sub: coveredByAllowance > 0 ? `${coveredByAllowance % 1 === 0 ? coveredByAllowance : coveredByAllowance.toFixed(1)}d of ${paidOffAllowance}d used` : `${paidOffAllowance}d available`, amt: coveredByAllowance * perDay, color: "text-slate-400", bar: "bg-slate-400/40" },
        ].map((t) => (
          <div key={t.title} className="relative overflow-hidden rounded-xl border border-slate-100 bg-slate-50 p-3.5 dark:border-white/6 dark:bg-white/2">
            <div className={`absolute left-0 top-0 h-full w-0.5 ${t.bar}`} />
            <div className="pl-2">
              <div className="text-[11px] font-medium text-slate-500 dark:text-white/45">{t.title}</div>
              <div className="mt-0.5 text-[11px] text-slate-400 dark:text-white/30">{t.sub}</div>
              <div className={`mt-2 text-lg font-bold ${t.color}`}>₹{money(t.amt)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Settings (collapsible) ── */}
      <div className="border-b border-slate-100 dark:border-white/7">
        <button
          type="button"
          onClick={() => setSettingsOpen((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-3.5 text-sm transition hover:bg-slate-50 dark:hover:bg-white/2"
        >
          <div className="flex items-center gap-2 font-medium text-slate-500 dark:text-white/60">
            <svg className="h-3.5 w-3.5 text-slate-400 dark:text-white/35" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.42 1.42M11.53 11.53l1.42 1.42M3.05 12.95l1.42-1.42M11.53 4.47l1.42-1.42" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            Salary settings
            {isDirty && !disabled && (
              <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-400">Unsaved</span>
            )}
          </div>
          <span className={`text-slate-300 text-xs transition-transform duration-200 dark:text-white/25 ${settingsOpen ? "rotate-180" : ""}`}>▼</span>
        </button>

        {settingsOpen && (
          <div className="border-t border-slate-100 px-5 pb-5 pt-4 dark:border-white/7">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35">Monthly salary (₹)</span>
                <input
                  type="number" min={0} step={1}
                  disabled={disabled}
                  value={salaryDraft}
                  onChange={(e) => onSalaryDraftChange(e.target.value)}
                  className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-40 dark:border-white/10 dark:bg-white/4 dark:text-white"
                  placeholder="e.g. 12000"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35">Paid OFF allowance (days)</span>
                <input
                  type="number" min={0} step={1}
                  disabled={disabled}
                  value={paidOffDraft}
                  onChange={(e) => onPaidOffDraftChange(e.target.value)}
                  className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-40 dark:border-white/10 dark:bg-white/4 dark:text-white"
                  placeholder="e.g. 4"
                />
              </label>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                disabled={disabled || !isDirty}
                onClick={onSave}
                className={`h-9 rounded-xl px-4 text-sm font-semibold transition ${
                  !disabled && isDirty
                    ? "bg-indigo-500 text-white hover:bg-indigo-400 shadow-[0_4px_14px_rgba(99,102,241,0.3)]"
                    : "bg-slate-100 text-slate-300 dark:bg-white/6 dark:text-white/25"
                }`}
              >
                Save settings
              </button>
              <span className="text-xs text-slate-400 dark:text-white/30">
                {disabled ? "Month is locked" : isDirty ? "You have unsaved changes" : "Settings saved"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Deductions ── */}
      <div className="px-5 py-4">
        {isGrouped ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/60 px-4 py-3 dark:border-indigo-500/20 dark:bg-indigo-500/5">
            <svg className="h-4 w-4 shrink-0 text-indigo-400" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <span className="text-xs text-indigo-600 dark:text-indigo-400">
              Deductions for linked workers are managed from the <strong>Dashboard</strong>.
            </span>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-medium text-slate-500 dark:text-white/60">Deductions</div>
              {deductionsTotal > 0 && (
                <span className="text-xs font-semibold text-rose-400">−₹{money(deductionsTotal)}</span>
              )}
            </div>

            {/* Add row */}
            {!disabled && onAddDeduction && (
              <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_160px_auto]">
                <input
                  value={deductNote}
                  onChange={(e) => setDeductNote(e.target.value)}
                  placeholder="Note (e.g. advance, festival)"
                  className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-white/4 dark:text-white dark:placeholder:text-white/25"
                />
                <input
                  type="number" min={0} step={1}
                  value={deductAmount}
                  onChange={(e) => setDeductAmount(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddDeduction(); }}
                  placeholder="Amount (₹)"
                  className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-white/4 dark:text-white dark:placeholder:text-white/25"
                />
                <button
                  type="button"
                  onClick={handleAddDeduction}
                  disabled={!canAddDeduction}
                  className={`h-9 rounded-xl px-4 text-sm font-semibold transition whitespace-nowrap ${
                    canAddDeduction ? "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/8 dark:text-white dark:hover:bg-white/12" : "bg-slate-50 text-slate-300 dark:bg-white/4 dark:text-white/25"
                  }`}
                >
                  + Add
                </button>
              </div>
            )}

            {/* List */}
            {safeDeductions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 py-4 text-center text-xs text-slate-400 dark:border-white/8 dark:text-white/25">
                No deductions for {monthKey}
              </div>
            ) : (
              <div className="space-y-1.5">
                {safeDeductions.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 dark:border-white/6 dark:bg-white/2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-sm font-semibold text-rose-500 dark:text-rose-300">−₹{money(d.amount)}</span>
                        {d.note && <span className="text-xs text-slate-500 truncate dark:text-white/50">{d.note}</span>}
                        <span className="text-[11px] text-slate-400 dark:text-white/25">{d.dateISO}</span>
                      </div>
                    </div>
                    {!disabled && onDeleteDeduction && (
                      <button
                        type="button"
                        onClick={() => onDeleteDeduction(d.id)}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition text-sm dark:text-white/25 dark:hover:bg-rose-500/15 dark:hover:text-rose-400"
                        title="Remove deduction"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
