"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  Deduction,
  MonthLock,
  SalaryConfig,
  ShiftEntry,
  ShiftStatus,
  Worker,
} from "@/lib/storage/schema";

import {
  deleteDeduction,
  getMonthDeductions,
  loadAppData,
  upsertDeduction,
  upsertEntry,
  upsertMonthLock,
  upsertSalaryConfig,
  upsertWorker,
} from "@/lib/storage/localStore";

import { MonthPicker } from "@/components/MonthPicker";
import { SalaryCard } from "@/components/SalaryCard";
import { StatusDot } from "@/components/StatusDot";
import { StatusPill } from "@/components/StatusPill";

import {
  getMonthDays,
  getWeekdayIndexMon0,
  monthLabel,
  toISODate,
  weekdayShort,
} from "@/lib/utils/date";
import { makeId } from "@/lib/utils/id";
import { ShareButton } from "@/components/ShareButton";
import { createWorkerShareLink } from "../shareActions";
import { Toggle } from "@/components/Toggle";

const STATUSES: ShiftStatus[] = ["WORKED", "ABSENT", "HALF", "OFF"];

const statusLabel: Record<ShiftStatus, string> = {
  WORKED: "Worked",
  ABSENT: "Absent",
  HALF: "Half",
  OFF: "Off",
};

const statusIcon: Record<ShiftStatus, string> = {
  WORKED: "✓",
  ABSENT: "✕",
  HALF: "½",
  OFF: "—",
};

type PickerState = { open: boolean; iso: string | null; x: number; y: number };

export default function WorkerTrackerPage() {
  const params = useParams<{ workerId?: string }>();
  const router = useRouter();
  const workerId = typeof params.workerId === "string" ? params.workerId : "";

  const [autoFillInfo, setAutoFillInfo] = useState<string | null>(null);
  const autoFillRanRef = useRef<Set<string>>(new Set());
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const [worker, setWorker] = useState<Worker | null>(null);
  const [month, setMonth] = useState<Date>(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });

  const [entries, setEntries] = useState<ShiftEntry[]>([]);
  const [monthLocks, setMonthLocks] = useState<MonthLock[]>([]);
  const [salaryConfigs, setSalaryConfigs] = useState<SalaryConfig[]>([]);
  const [selectedISO, setSelectedISO] = useState<string | null>(null);
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [lockConfirmOpen, setLockConfirmOpen] = useState(false);
  const [editingStartDate, setEditingStartDate] = useState(false);
  const [startDateDraft, setStartDateDraft] = useState("");

  const [salaryDraft, setSalaryDraft] = useState("");
  const [paidOffDraft, setPaidOffDraft] = useState("0");

  const [picker, setPicker] = useState<PickerState>({ open: false, iso: null, x: 0, y: 0 });

  // ── Derived ──
  const todayISO = useMemo(() => { const t = new Date(); t.setHours(0,0,0,0); return toISODate(t); }, []);
  const currentMonthKey = useMemo(() => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}`; }, []);
  const currentMonthStart = useMemo(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); }, []);
  const workerStartMonthDate = useMemo(() => {
    if (!worker?.startDate) return undefined;
    const [y, m] = worker.startDate.split("-").map(Number) as [number, number];
    return new Date(y, m - 1, 1);
  }, [worker?.startDate]);
  const monthDays = useMemo(() => getMonthDays(month), [month]);
  const monthKey = useMemo(() => `${month.getFullYear()}-${String(month.getMonth()+1).padStart(2,"0")}`, [month]);
  const daysInMonth = monthDays.length;
  const firstDayOffset = useMemo(() => getWeekdayIndexMon0(new Date(month.getFullYear(), month.getMonth(), 1)), [month]);

  const entriesByDate = useMemo(() => {
    const map = new Map<string, ShiftEntry>();
    for (const e of entries) map.set(e.dateISO, e);
    return map;
  }, [entries]);

  const monthEntries = useMemo(() =>
    monthDays.map((d) => entriesByDate.get(toISODate(d))).filter((x): x is ShiftEntry => Boolean(x)),
    [monthDays, entriesByDate]
  );

  const totals = useMemo(() => {
    let worked = 0, absent = 0, half = 0, off = 0, hours = 0;
    for (const e of monthEntries) {
      if (e.status === "WORKED") worked++;
      if (e.status === "ABSENT") absent++;
      if (e.status === "HALF") half++;
      if (e.status === "OFF") off++;
      if (typeof e.hours === "number") hours += e.hours;
    }
    return { worked, absent, half, off, hours };
  }, [monthEntries]);

  const currentMonthLock = useMemo(() => monthLocks.find((m) => m.monthKey === monthKey) ?? null, [monthLocks, monthKey]);
  const isMonthLocked = currentMonthLock?.locked ?? false;
  const currentSalaryConfig = useMemo(() => salaryConfigs.find((s) => s.monthKey === monthKey) ?? null, [salaryConfigs, monthKey]);
  const selectedEntry = useMemo(() => (selectedISO ? entriesByDate.get(selectedISO) ?? null : null), [selectedISO, entriesByDate]);
  const pickerEntry = useMemo(() => (picker.iso ? entriesByDate.get(picker.iso) ?? null : null), [picker.iso, entriesByDate]);

  // ── Effects ──
  useEffect(() => {
    if (!workerId) return;
    const data = loadAppData();
    const w = data.workers.find((x) => x.id === workerId) ?? null;
    if (!w) { router.replace("/workers"); return; }
    setWorker(w);
    setEntries(data.entries.filter((e) => e.workerId === workerId));
    setMonthLocks(data.monthLocks.filter((m) => m.workerId === workerId));
    setSalaryConfigs(data.salaryConfigs.filter((s) => s.workerId === workerId));
    setDeductions(data.deductions.filter((d) => d.workerId === workerId && d.monthKey === monthKey));
  }, [workerId, router, monthKey]);

  useEffect(() => {
    if (!picker.open) return;
    const onDown = (e: MouseEvent) => {
      if (popoverRef.current && e.target instanceof Node && !popoverRef.current.contains(e.target))
        setPicker((p) => ({ ...p, open: false }));
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPicker((p) => ({ ...p, open: false })); };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [picker.open]);

  useEffect(() => {
    if (!currentSalaryConfig) {
      const prev = [...salaryConfigs].filter((c) => c.monthKey < monthKey).sort((a, b) => b.monthKey.localeCompare(a.monthKey))[0];
      if (prev) { setSalaryDraft(String(prev.monthlySalary ?? 0)); setPaidOffDraft(String(prev.paidOffAllowance ?? 0)); }
      else { setSalaryDraft(""); setPaidOffDraft("0"); }
      return;
    }
    setSalaryDraft(String(currentSalaryConfig.monthlySalary ?? 0));
    setPaidOffDraft(String(currentSalaryConfig.paidOffAllowance ?? 0));
  }, [currentSalaryConfig, monthKey, salaryConfigs]);

  useEffect(() => {
    if (!workerId || !worker || monthKey !== currentMonthKey || isMonthLocked) return;
    if (autoFillRanRef.current.has(monthKey)) return;
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayISO = yesterday.toISOString().slice(0, 10);
    const startDateISO = worker.startDate ?? `${monthKey}-01`;
    const missingIsos = monthDays.map((d) => toISODate(d)).filter((iso) => iso >= startDateISO && iso <= yesterdayISO && !entriesByDate.has(iso));
    if (missingIsos.length === 0) { autoFillRanRef.current.add(monthKey); return; }
    const now = Date.now(); let store: ReturnType<typeof upsertEntry> | null = null;
    for (const iso of missingIsos) store = upsertEntry({ id: makeId("entry"), workerId, dateISO: iso, status: "WORKED", createdAt: now, updatedAt: now });
    if (store) { setEntries(store.entries.filter((e) => e.workerId === workerId)); setAutoFillInfo(yesterdayISO); }
    autoFillRanRef.current.add(monthKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerId, worker, monthKey, currentMonthKey, isMonthLocked, entries.length]);

  // ── Handlers ──
  const addDeduction = (payload: Omit<Deduction, "id" | "createdAt" | "updatedAt">) => {
    if (!workerId || isMonthLocked) return;
    const now = Date.now();
    const next: Deduction = { id: makeId("deduct"), createdAt: now, updatedAt: now, ...payload, workerId, monthKey };
    const updated = upsertDeduction(next);
    setDeductions(updated.deductions.filter((d) => d.workerId === workerId && d.monthKey === monthKey));
  };

  const removeDeduction = (deductionId: string) => {
    if (!workerId || isMonthLocked) return;
    const updated = deleteDeduction(deductionId);
    setDeductions(updated.deductions.filter((d) => d.workerId === workerId && d.monthKey === monthKey));
  };

  const setLocked = (locked: boolean) => {
    if (!workerId) return;
    const now = Date.now();
    const next: MonthLock = currentMonthLock
      ? { ...currentMonthLock, locked, lockedAt: locked ? now : currentMonthLock.lockedAt }
      : { id: makeId("lock"), workerId, monthKey, locked, lockedAt: locked ? now : undefined, lockedBy: undefined };
    const updated = upsertMonthLock(next);
    setMonthLocks(updated.monthLocks.filter((m) => m.workerId === workerId));
    if (locked) setPicker((p) => ({ ...p, open: false }));
  };

  const saveSalaryConfig = () => {
    if (!workerId || isMonthLocked) return;
    const now = Date.now();
    const monthlySalary = Math.max(0, Math.round(Number(salaryDraft || 0)));
    const paidOffAllowance = Math.max(0, Math.round(Number(paidOffDraft || 0)));
    const next: SalaryConfig = currentSalaryConfig
      ? { ...currentSalaryConfig, monthlySalary, paidOffAllowance, updatedAt: now }
      : { id: makeId("salary"), workerId, monthKey, monthlySalary, paidOffAllowance, updatedAt: now };
    const updated = upsertSalaryConfig(next);
    setSalaryConfigs(updated.salaryConfigs.filter((s) => s.workerId === workerId));
  };

  const upsertWithStatus = (iso: string, status: ShiftStatus) => {
    if (!workerId) return;
    const existing = entriesByDate.get(iso);
    const now = Date.now();
    const next: ShiftEntry = existing
      ? { ...existing, status, updatedAt: now }
      : { id: makeId("entry"), workerId, dateISO: iso, status, createdAt: now, updatedAt: now };
    const updated = upsertEntry(next);
    setEntries(updated.entries.filter((e) => e.workerId === workerId));
  };

  const openPicker = (iso: string, anchorEl: HTMLElement) => {
    const rect = anchorEl.getBoundingClientRect();
    const width = 240, height = 260;
    const x = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8));
    const y = Math.min(Math.max(8, rect.bottom + 8), Math.max(8, window.innerHeight - height - 8));
    setPicker({ open: true, iso, x, y });
  };

  const handleDayTap = (iso: string, el: HTMLElement) => {
    if (iso > todayISO || isMonthLocked) return;
    setSelectedISO(iso);
    if (!entriesByDate.get(iso)) upsertWithStatus(iso, "WORKED");
    openPicker(iso, el);
  };

  const saveStartDate = () => {
    if (!worker) return;
    const updated = upsertWorker({ ...worker, startDate: startDateDraft || undefined, updatedAt: Date.now() });
    const w = updated.workers.find((x) => x.id === workerId) ?? null;
    setWorker(w);
    setEditingStartDate(false);
  };

  const updateSelected = (patch: Partial<ShiftEntry>) => {
    if (!selectedISO || isMonthLocked) return;
    const existing = entriesByDate.get(selectedISO);
    if (!existing) return;
    const updated = upsertEntry({ ...existing, ...patch, updatedAt: Date.now() });
    setEntries(updated.entries.filter((e) => e.workerId === workerId));
  };

  if (!worker) return null;

  const workerInitials = worker.name.split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]!.toUpperCase()).join("");
  const hue = worker.name.charCodeAt(0) % 6;
  const avatarColors = ["from-indigo-500/60 to-violet-500/60","from-emerald-500/60 to-teal-500/60","from-amber-500/60 to-orange-500/60","from-rose-500/60 to-pink-500/60","from-cyan-500/60 to-sky-500/60","from-violet-500/60 to-purple-500/60"];

  return (
    <main className="px-4 pt-6 pb-20 text-white">

      {/* ── Top bar ── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/workers"
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/3 px-3 py-2 text-sm text-white/60 transition hover:bg-white/6 hover:text-white/80"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Workers
        </Link>
        <MonthPicker month={month} onChange={setMonth} min={workerStartMonthDate} max={currentMonthStart} />
      </div>

      {/* ── Worker header card ── */}
      <div className="mb-6 rounded-2xl border border-white/[0.07] bg-white/3 px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          {/* Identity */}
          <div className="flex items-center gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br ${avatarColors[hue]} ring-1 ring-white/10`}>
              <span className="text-sm font-bold text-white">{workerInitials}</span>
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-white">{worker.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/45">
                <span>{monthLabel(month)}</span>
                {worker.defaultShiftLabel && (
                  <>
                    <span className="text-white/20">·</span>
                    <span>{worker.defaultShiftLabel}</span>
                  </>
                )}
                <span className="text-white/20">·</span>
                {editingStartDate ? (
                  <span className="flex items-center gap-1.5">
                    <input
                      type="date"
                      autoFocus
                      value={startDateDraft}
                      onChange={(e) => setStartDateDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveStartDate(); if (e.key === "Escape") setEditingStartDate(false); }}
                      className="h-6 rounded-lg border border-indigo-400/40 bg-white/6 px-2 text-xs text-white outline-none scheme-dark focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <button onClick={saveStartDate} className="text-indigo-400 hover:text-indigo-300 transition text-[11px] font-semibold">Save</button>
                    <button onClick={() => setEditingStartDate(false)} className="text-white/30 hover:text-white/60 transition text-[11px]">Cancel</button>
                  </span>
                ) : (
                  <button
                    onClick={() => { setStartDateDraft(worker.startDate ?? ""); setEditingStartDate(true); }}
                    className="flex items-center gap-1 text-white/45 hover:text-white/70 transition"
                  >
                    <svg className="h-3 w-3 text-white/30" viewBox="0 0 12 12" fill="none">
                      <rect x="1" y="2" width="10" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M1 5h10" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M4 1v2M8 1v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                    {worker.startDate
                      ? `Started ${new Date(worker.startDate + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`
                      : <span className="text-white/30">Set start date</span>}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <ShareButton
              onShare={async () => {
                const res = await createWorkerShareLink(worker.id, 30);
                if (!res.ok) throw new Error(res.error);
                await navigator.clipboard.writeText(res.data.url);
              }}
            />

            {/* Lock toggle */}
            <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/3 px-3 py-2">
              <span className={`text-xs font-medium ${isMonthLocked ? "text-amber-400" : "text-white/45"}`}>
                {isMonthLocked ? "🔒 Locked" : "Unlocked"}
              </span>
              <Toggle
                value={isMonthLocked}
                onChange={() => { if (!isMonthLocked) setLockConfirmOpen(true); else setLocked(false); }}
              />
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {isMonthLocked ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300 ring-1 ring-amber-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Month locked · view only
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.6)]" />
              Tracking active · tap a day to update
            </span>
          )}
          {autoFillInfo && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-3 py-1 text-xs text-indigo-300 ring-1 ring-indigo-500/20">
              ✦ Auto-filled up to {autoFillInfo}
            </span>
          )}
        </div>
      </div>

      {/* ── Before-start banner ── */}
      {worker.startDate && monthKey < worker.startDate.slice(0, 7) && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/8 px-5 py-4">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" viewBox="0 0 16 16" fill="none">
            <path d="M8 1.5L1 14h14L8 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
            <path d="M8 6v4M8 11.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <div>
            <div className="text-sm font-semibold text-amber-300">No data for this month</div>
            <div className="mt-0.5 text-xs text-amber-200/60">
              {worker.name} started on{" "}
              {new Date(worker.startDate + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}.
              {" "}Attendance and salary records only exist from that date onwards.
            </div>
          </div>
        </div>
      )}

      {/* ── Salary ── */}
      <div className="mb-6">
        <SalaryCard
          workerId={workerId}
          monthKey={monthKey}
          daysInMonth={daysInMonth}
          totals={totals}
          savedMonthlySalary={currentSalaryConfig?.monthlySalary ?? 0}
          savedPaidOffAllowance={currentSalaryConfig?.paidOffAllowance ?? 0}
          salaryDraft={salaryDraft}
          paidOffDraft={paidOffDraft}
          disabled={isMonthLocked}
          onSalaryDraftChange={setSalaryDraft}
          onPaidOffDraftChange={setPaidOffDraft}
          onSave={saveSalaryConfig}
          deductions={deductions}
          onAddDeduction={(p) => addDeduction(p)}
          onDeleteDeduction={(id) => removeDeduction(id)}
        />
      </div>

      {/* ── Calendar + Details ── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">

        {/* Calendar */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/2.5">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
            <div className="text-sm font-semibold text-white/85">Attendance</div>
            {/* Legend */}
            <div className="flex items-center gap-3 text-[11px] text-white/40">
              {(["WORKED","HALF","ABSENT","OFF"] as ShiftStatus[]).map((s) => (
                <div key={s} className="flex items-center gap-1.5">
                  <StatusDot status={s} size="sm" />
                  <span>{statusLabel[s]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 sm:p-5">
            {/* Weekday headers */}
            <div className="mb-2 grid grid-cols-7 gap-1.5">
              {weekdayShort.map((w) => (
                <div key={w} className="py-1 text-center text-[11px] font-semibold text-white/30">{w}</div>
              ))}
            </div>

            {/* Days */}
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: firstDayOffset }).map((_, i) => <div key={`sp_${i}`} />)}

              {monthDays.map((d) => {
                const iso = toISODate(d);
                const e = entriesByDate.get(iso);
                const isSelected = selectedISO === iso;
                const isToday = iso === todayISO;
                const isFuture = iso > todayISO;
                const isBeforeStart = worker.startDate ? iso < worker.startDate : false;
                const disabled = isFuture || isMonthLocked || isBeforeStart;

                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={disabled}
                    onClick={(ev) => { if (!disabled) handleDayTap(iso, ev.currentTarget); }}
                    className={[
                      "relative flex min-h-11 flex-col items-center justify-center rounded-xl border pt-1 pb-1 text-center transition",
                      isBeforeStart ? "cursor-not-allowed border-white/3 bg-transparent opacity-25" :
                      disabled ? "cursor-not-allowed opacity-30" : "cursor-pointer hover:border-white/20 hover:bg-white/5",
                      !isBeforeStart && (isSelected ? "border-indigo-400/60 bg-indigo-500/10 ring-2 ring-indigo-500/20" :
                      isToday ? "border-indigo-300/40 bg-indigo-500/8" : "border-white/6 bg-white/2"),
                    ].join(" ")}
                  >
                    {isToday && <div className="absolute top-0 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-b-full bg-indigo-400" />}

                    <span className={`text-xs font-semibold ${isToday ? "text-indigo-300" : "text-white/75"}`}>
                      {d.getDate()}
                    </span>

                    {!isBeforeStart && (e ? (
                      <StatusDot status={e.status} size="sm" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-transparent" />
                    ))}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex flex-col gap-4">
          {/* Summary */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/2.5 p-5">
            <div className="mb-4 text-sm font-semibold text-white/85">Summary</div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: "Worked", value: totals.worked, color: "text-emerald-400" },
                { label: "Absent", value: totals.absent, color: "text-rose-400" },
                { label: "Half", value: totals.half, color: "text-amber-400" },
                { label: "Off", value: totals.off, color: "text-slate-400" },
              ].map((x) => (
                <div key={x.label} className="rounded-xl border border-white/6 bg-white/2.5 p-3">
                  <div className="text-[11px] font-medium text-white/40">{x.label}</div>
                  <div className={`mt-1 text-2xl font-bold ${x.color}`}>{x.value}</div>
                </div>
              ))}
            </div>
            {totals.hours > 0 && (
              <div className="mt-2.5 rounded-xl border border-white/6 bg-white/2.5 p-3">
                <div className="text-[11px] font-medium text-white/40">Total hours</div>
                <div className="mt-1 text-2xl font-bold text-white/80">{totals.hours}h</div>
              </div>
            )}
          </div>

          {/* Day Details */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/2.5 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-semibold text-white/85">Day Details</div>
              {selectedISO && <div className="text-xs text-white/35">{selectedISO}</div>}
            </div>

            {!selectedISO ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <div className="text-2xl opacity-30">📅</div>
                <div className="text-xs text-white/30">Tap any past day to view or edit details</div>
              </div>
            ) : !selectedEntry ? (
              <div className="text-xs text-white/35">No entry recorded.</div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">Status</span>
                  <StatusPill status={selectedEntry.status} />
                </div>

                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/35">Hours <span className="normal-case font-normal tracking-normal">(optional)</span></span>
                  <input
                    type="number" min={0} step={0.5}
                    disabled={isMonthLocked}
                    value={selectedEntry.hours ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const num = raw === "" ? undefined : Number(raw);
                      updateSelected({ hours: Number.isFinite(num) ? num : undefined });
                    }}
                    className="h-10 rounded-xl border border-white/10 bg-white/4 px-3 text-sm text-white outline-none transition focus:border-indigo-400/50 focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-40"
                    placeholder="e.g. 8"
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/35">Note <span className="normal-case font-normal tracking-normal">(optional)</span></span>
                  <textarea
                    disabled={isMonthLocked}
                    value={selectedEntry.note ?? ""}
                    onChange={(e) => updateSelected({ note: e.target.value })}
                    className="min-h-20 rounded-xl border border-white/10 bg-white/4 px-3 py-2.5 text-sm text-white outline-none transition focus:border-indigo-400/50 focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-40 resize-none"
                    placeholder="Late arrival, extra cleaning…"
                  />
                </label>

                {isMonthLocked && <div className="text-xs text-amber-400/60">Month is locked. Unlock to edit.</div>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Status Picker Popover ── */}
      {picker.open && picker.iso && (
        <div
          ref={popoverRef}
          className="fixed z-50 w-56 rounded-2xl border border-white/10 bg-[#0D1117] shadow-[0_20px_60px_rgba(0,0,0,0.7)]"
          style={{ left: picker.x, top: picker.y }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="px-3 pt-3 pb-1 text-[11px] font-semibold text-white/40">{picker.iso}</div>
          <div className="p-1.5 space-y-0.5">
            {STATUSES.map((s) => {
              const active = pickerEntry?.status === s;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={isMonthLocked}
                  onPointerDown={(e) => {
                    e.preventDefault(); e.stopPropagation();
                    if (!isMonthLocked) { upsertWithStatus(picker.iso!, s); setPicker((p) => ({ ...p, open: false })); }
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm transition ${
                    active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/6 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <StatusDot status={s} size="md" />
                    <span className="font-medium">{statusLabel[s]}</span>
                  </div>
                  {active && <span className="text-xs text-indigo-400">✓</span>}
                </button>
              );
            })}
          </div>
          <div className="border-t border-white/[0.07] px-3 py-2 text-[10px] text-white/25">Press Esc to close</div>
        </div>
      )}

      {/* ── Lock Confirmation Modal ── */}
      {lockConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setLockConfirmOpen(false); }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#0D1117] shadow-[0_24px_64px_rgba(0,0,0,0.7)]">
            <div className="border-b border-white/[0.07] px-5 py-4">
              <div className="text-sm font-semibold text-white">Lock {monthKey}?</div>
              <div className="mt-0.5 text-xs text-white/40">No edits will be possible until you unlock.</div>
            </div>
            <div className="px-5 py-5 space-y-4">
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-xs text-amber-200/80">
                Attendance, salary settings, and deductions will all be read-only.
              </div>
              <div className="flex gap-3">
                <button onClick={() => setLockConfirmOpen(false)} className="h-10 flex-1 rounded-xl border border-white/10 bg-white/4 text-sm font-medium text-white/60 hover:bg-white/[0.07] transition">
                  Cancel
                </button>
                <button
                  onClick={() => { setLocked(true); setLockConfirmOpen(false); }}
                  className="h-10 flex-1 rounded-xl bg-amber-500 text-sm font-semibold text-white hover:bg-amber-400 transition"
                >
                  Lock month
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
