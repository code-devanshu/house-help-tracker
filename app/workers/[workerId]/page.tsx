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

const STATUSES: ShiftStatus[] = ["WORKED", "ABSENT", "HALF", "OFF"];

const statusLabel: Record<ShiftStatus, string> = {
  WORKED: "Worked",
  ABSENT: "Absent",
  HALF: "Half",
  OFF: "Off",
};

type PickerState = {
  open: boolean;
  iso: string | null;
  x: number;
  y: number;
};

const surface =
  "rounded-3xl border border-white/10 bg-white/[0.05] shadow-[0_20px_60px_rgba(0,0,0,0.35)]";
const surfaceHeader = "border-b border-white/10";
const muted = "text-white/60";
const muted2 = "text-white/45";

export default function WorkerTrackerPage() {
  const params = useParams<{ workerId?: string }>();
  const router = useRouter();

  const workerId = typeof params.workerId === "string" ? params.workerId : "";

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

  // Salary drafts (controlled)
  const [salaryDraft, setSalaryDraft] = useState<string>("");
  const [paidOffDraft, setPaidOffDraft] = useState<string>("0");

  // Status picker popover
  const [picker, setPicker] = useState<PickerState>({
    open: false,
    iso: null,
    x: 0,
    y: 0,
  });

  // ---------------------------
  // Derived values (declare FIRST)
  // ---------------------------

  const todayISO = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return toISODate(t);
  }, []);

  const currentMonthKey = useMemo(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const monthDays = useMemo(() => getMonthDays(month), [month]);

  const monthKey = useMemo(() => {
    return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
  }, [month]);

  const monthDeductions = useMemo(() => {
    if (!workerId) return [];
    return getMonthDeductions(workerId, monthKey);
  }, [workerId, monthKey]);

  const daysInMonth = monthDays.length;

  const entriesByDate = useMemo(() => {
    const map = new Map<string, ShiftEntry>();
    for (const e of entries) map.set(e.dateISO, e);
    return map;
  }, [entries]);

  const monthEntries = useMemo(() => {
    return monthDays
      .map((d) => entriesByDate.get(toISODate(d)))
      .filter((x): x is ShiftEntry => Boolean(x));
  }, [monthDays, entriesByDate]);

  const totals = useMemo(() => {
    let worked = 0;
    let absent = 0;
    let half = 0;
    let off = 0;
    let hours = 0;

    for (const e of monthEntries) {
      if (e.status === "WORKED") worked += 1;
      if (e.status === "ABSENT") absent += 1;
      if (e.status === "HALF") half += 1;
      if (e.status === "OFF") off += 1;
      if (typeof e.hours === "number") hours += e.hours;
    }

    return { worked, absent, half, off, hours };
  }, [monthEntries]);

  const firstDayOffset = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    return getWeekdayIndexMon0(first);
  }, [month]);

  const currentMonthLock = useMemo(() => {
    return monthLocks.find((m) => m.monthKey === monthKey) ?? null;
  }, [monthLocks, monthKey]);

  const isMonthLocked = currentMonthLock?.locked ?? false;

  const currentSalaryConfig = useMemo(() => {
    return salaryConfigs.find((s) => s.monthKey === monthKey) ?? null;
  }, [salaryConfigs, monthKey]);

  const selectedEntry = useMemo(() => {
    if (!selectedISO) return null;
    return entriesByDate.get(selectedISO) ?? null;
  }, [selectedISO, entriesByDate]);

  const pickerEntry = useMemo(() => {
    if (!picker.iso) return null;
    return entriesByDate.get(picker.iso) ?? null;
  }, [picker.iso, entriesByDate]);

  // ---------------------------
  // Effects
  // ---------------------------

  useEffect(() => {
    setDeductions(monthDeductions);
  }, [monthDeductions]);

  // Initial load
  useEffect(() => {
    if (!workerId) return;

    const data = loadAppData();
    const w = data.workers.find((x) => x.id === workerId) ?? null;

    if (!w) {
      router.replace("/workers");
      return;
    }

    setWorker(w);
    setEntries(data.entries.filter((e) => e.workerId === workerId));
    setMonthLocks(data.monthLocks.filter((m) => m.workerId === workerId));
    setSalaryConfigs(data.salaryConfigs.filter((s) => s.workerId === workerId));
  }, [workerId, router]);

  // Close popover on outside click / escape
  useEffect(() => {
    if (!picker.open) return;

    const onDown = (e: MouseEvent) => {
      const el = popoverRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setPicker((p) => ({ ...p, open: false }));
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPicker((p) => ({ ...p, open: false }));
    };

    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [picker.open]);

  // Hydrate salary drafts for active month
  useEffect(() => {
    if (!currentSalaryConfig) {
      setSalaryDraft("");
      setPaidOffDraft("0");
      return;
    }
    setSalaryDraft(String(currentSalaryConfig.monthlySalary ?? 0));
    setPaidOffDraft(String(currentSalaryConfig.paidOffAllowance ?? 0));
  }, [currentSalaryConfig]);

  // Auto-fill (Option A): only CURRENT month, fill untouched days <= today as WORKED
  useEffect(() => {
    if (!workerId) return;
    if (!worker) return;

    // Only for CURRENT month
    if (monthKey !== currentMonthKey) return;

    // If locked, do nothing (and DON'T mark as ran)
    if (isMonthLocked) return;

    // Run only once per monthKey in this session/view
    if (autoFillRanRef.current.has(monthKey)) return;

    const missingIsos = monthDays
      .map((d) => toISODate(d))
      .filter((iso) => iso <= todayISO && !entriesByDate.has(iso));

    if (missingIsos.length === 0) {
      autoFillRanRef.current.add(monthKey);
      return;
    }

    const now = Date.now();
    let store: ReturnType<typeof upsertEntry> | null = null;

    for (const iso of missingIsos) {
      store = upsertEntry({
        id: makeId("entry"),
        workerId,
        dateISO: iso,
        status: "WORKED",
        createdAt: now,
        updatedAt: now,
      });
    }

    if (store) {
      setEntries(store.entries.filter((e) => e.workerId === workerId));
    }

    autoFillRanRef.current.add(monthKey);
    // Keep deps minimal + stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    workerId,
    worker,
    monthKey,
    currentMonthKey,
    isMonthLocked,
    entries.length,
  ]);

  const addDeduction = (
    payload: Omit<Deduction, "id" | "createdAt" | "updatedAt">
  ) => {
    if (!workerId) return;
    if (isMonthLocked) return;

    const now = Date.now();
    const next: Deduction = {
      id: makeId("deduct"),
      createdAt: now,
      updatedAt: now,
      ...payload,
      workerId, // ensure correct
      monthKey, // ensure correct
    };

    const updated = upsertDeduction(next);
    setDeductions(
      updated.deductions.filter(
        (d) => d.workerId === workerId && d.monthKey === monthKey
      )
    );
  };

  const removeDeduction = (deductionId: string) => {
    if (!workerId) return;
    if (isMonthLocked) return;

    const updated = deleteDeduction(deductionId);
    setDeductions(
      updated.deductions.filter(
        (d) => d.workerId === workerId && d.monthKey === monthKey
      )
    );
  };
  // ---------------------------
  // Helpers / handlers
  // ---------------------------

  const setLocked = (locked: boolean) => {
    if (!workerId) return;

    const now = Date.now();

    const next: MonthLock = currentMonthLock
      ? {
          ...currentMonthLock,
          locked,
          lockedAt: locked ? now : currentMonthLock.lockedAt,
        }
      : {
          id: makeId("lock"),
          workerId,
          monthKey,
          locked,
          lockedAt: locked ? now : undefined,
          lockedBy: undefined,
        };

    const updated = upsertMonthLock(next);
    setMonthLocks(updated.monthLocks.filter((m) => m.workerId === workerId));

    if (locked) setPicker((p) => ({ ...p, open: false }));
  };

  const saveSalaryConfig = () => {
    if (!workerId) return;
    if (isMonthLocked) return;

    const now = Date.now();
    const monthlySalary = Math.max(0, Math.round(Number(salaryDraft || 0)));
    const paidOffAllowance = Math.max(0, Math.round(Number(paidOffDraft || 0)));

    const next: SalaryConfig = currentSalaryConfig
      ? {
          ...currentSalaryConfig,
          monthlySalary,
          paidOffAllowance,
          updatedAt: now,
        }
      : {
          id: makeId("salary"),
          workerId,
          monthKey,
          monthlySalary,
          paidOffAllowance,
          updatedAt: now,
        };

    const updated = upsertSalaryConfig(next);
    setSalaryConfigs(
      updated.salaryConfigs.filter((s) => s.workerId === workerId)
    );
  };

  const upsertWithStatus = (iso: string, status: ShiftStatus) => {
    if (!workerId) return;

    const existing = entriesByDate.get(iso);
    const now = Date.now();

    const next: ShiftEntry = existing
      ? { ...existing, status, updatedAt: now }
      : {
          id: makeId("entry"),
          workerId,
          dateISO: iso,
          status,
          createdAt: now,
          updatedAt: now,
        };

    const updated = upsertEntry(next);
    setEntries(updated.entries.filter((e) => e.workerId === workerId));
  };

  const openPicker = (iso: string, anchorEl: HTMLElement) => {
    const rect = anchorEl.getBoundingClientRect();

    const width = 260;
    const height = 260;

    const x = Math.min(
      Math.max(8, rect.left),
      Math.max(8, window.innerWidth - width - 8)
    );
    const y = Math.min(
      Math.max(8, rect.bottom + 8),
      Math.max(8, window.innerHeight - height - 8)
    );

    setPicker({ open: true, iso, x, y });
  };

  const handleDayTap = (iso: string, el: HTMLElement) => {
    const isFuture = iso > todayISO;
    if (isFuture) return;
    if (isMonthLocked) return;

    setSelectedISO(iso);

    if (!entriesByDate.get(iso)) {
      upsertWithStatus(iso, "WORKED");
    }

    openPicker(iso, el);
  };

  const updateSelected = (patch: Partial<ShiftEntry>) => {
    if (!selectedISO) return;
    if (isMonthLocked) return;

    const existing = entriesByDate.get(selectedISO);
    if (!existing) return;

    const next: ShiftEntry = { ...existing, ...patch, updatedAt: Date.now() };
    const updated = upsertEntry(next);
    setEntries(updated.entries.filter((e) => e.workerId === workerId));
  };

  if (!worker) return null;

  // ---------------------------
  // Render
  // ---------------------------

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 text-white">
      {/* Header */}
      <div className="rounded-[28px] bg-white/[0.03] backdrop-blur-xl shadow-[0_30px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/10 p-4 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          {/* Left */}
          <div className="min-w-0">
            {/* Top row */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Link
                  href="/workers"
                  className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-medium text-white/75 transition hover:bg-white/[0.06] hover:text-white"
                >
                  <span className="text-white/55 transition group-hover:text-white/80">
                    ←
                  </span>
                  Back to workers
                </Link>

                <span className="hidden sm:inline-flex items-center gap-2 rounded-full bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-white/60 ring-1 ring-white/10">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
                  Tracking enabled
                </span>
              </div>

              {/* MonthPicker for mobile sits under/back row by default; on sm+ it moves right */}
              <div className="sm:hidden">
                <MonthPicker month={month} onChange={setMonth} />
              </div>
            </div>

            {/* Title block */}
            <div className="mt-5 flex items-start gap-3 sm:gap-4">
              <div className="grid h-11 w-11 sm:h-12 sm:w-12 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-indigo-500/40 to-white/10 ring-1 ring-white/15">
                <span className="text-sm font-extrabold tracking-wide text-white">
                  {(worker.name || "W")
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((x) => x[0]!.toUpperCase())
                    .join("")}
                </span>
              </div>

              <div className="min-w-0">
                <h1 className="truncate text-2xl sm:text-3xl font-semibold tracking-tight text-white">
                  {worker.name}
                </h1>

                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="text-white/70">
                    Month{" "}
                    <span className="font-semibold text-white">
                      {monthLabel(month)}
                    </span>
                  </span>

                  {worker.defaultShiftLabel ? (
                    <>
                      <span className="text-white/20">•</span>
                      <span className="text-white/60">
                        Default{" "}
                        <span className="font-semibold text-white/80">
                          {worker.defaultShiftLabel}
                        </span>
                      </span>
                    </>
                  ) : null}
                </div>

                {/* On mobile, show the tracking badge here (since top row hides it) */}
                <div className="mt-2 sm:hidden">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-white/60 ring-1 ring-white/10">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
                    Tracking enabled
                  </span>
                </div>
              </div>
            </div>

            {/* Lock row */}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
              <span
                className={[
                  "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1",
                  isMonthLocked
                    ? "bg-rose-500/10 text-rose-100 ring-rose-400/20"
                    : "bg-emerald-500/10 text-emerald-100 ring-emerald-400/20",
                ].join(" ")}
              >
                <span
                  className={[
                    "h-2 w-2 rounded-full",
                    isMonthLocked ? "bg-rose-400" : "bg-emerald-400",
                  ].join(" ")}
                />
                {isMonthLocked ? "Month locked" : "Month unlocked"}
              </span>

              {/* Button group: full width on mobile, compact on sm+ */}
              <div className="inline-flex w-full sm:w-auto overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] ring-1 ring-white/5">
                <button
                  type="button"
                  onClick={() => setLocked(!isMonthLocked)}
                  className={[
                    "h-11 sm:h-10 w-full sm:w-auto rounded-xl px-4 text-sm font-semibold transition",
                    "border focus:outline-none focus:ring-4",
                    isMonthLocked
                      ? "border-white/15 bg-white/[0.06] text-white hover:bg-white/[0.12] focus:ring-white/15"
                      : "border-rose-400/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 focus:ring-rose-500/30",
                  ].join(" ")}
                >
                  {isMonthLocked ? "Unlock month" : "Lock month"}
                </button>

                <span className="hidden sm:inline-flex items-center px-3 text-xs text-white/50 whitespace-nowrap">
                  {isMonthLocked ? "View only" : "Editable"}
                </span>
              </div>

              <span className="text-xs text-white/45 sm:ml-1">
                {isMonthLocked
                  ? "Editing disabled for this month."
                  : "Tap a day to update status."}
              </span>
            </div>
          </div>

          {/* Right (desktop MonthPicker) */}
          <div className="hidden sm:block shrink-0">
            <MonthPicker month={month} onChange={setMonth} />
          </div>
        </div>
      </div>

      {/* Salary */}
      <div className="mt-6">
        <SalaryCard
          monthKey={monthKey}
          daysInMonth={daysInMonth}
          totals={{
            worked: totals.worked,
            half: totals.half,
            absent: totals.absent,
            off: totals.off,
          }}
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

      {/* Legend */}
      <div
        className={`mt-4 flex flex-wrap items-center gap-3 text-xs ${muted}`}
      >
        <div className="font-semibold text-white/70">Legend:</div>
        <div className="inline-flex items-center gap-2">
          <StatusDot status="WORKED" />{" "}
          <span className="text-white/70">Worked</span>
        </div>
        <div className="inline-flex items-center gap-2">
          <StatusDot status="ABSENT" />{" "}
          <span className="text-white/70">Absent</span>
        </div>
        <div className="inline-flex items-center gap-2">
          <StatusDot status="HALF" />{" "}
          <span className="text-white/70">Half</span>
        </div>
        <div className="inline-flex items-center gap-2">
          <StatusDot status="OFF" /> <span className="text-white/70">Off</span>
        </div>
      </div>

      {/* Calendar + right */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        {/* Calendar */}
        <div className={surface}>
          <div
            className={`${surfaceHeader} flex items-center justify-between gap-3 px-2 sm:px-6 py-5`}
          >
            <div className="text-sm font-semibold text-white/90">Calendar</div>
            <div className={`text-xs ${muted}`}>
              {isMonthLocked ? "Month is locked" : "Tap a day to pick status"}
            </div>
          </div>

          <div className="px-2 sm:px-6 pb-6 pt-4">
            <div className={`grid grid-cols-7 gap-2 text-xs ${muted}`}>
              {weekdayShort.map((w) => (
                <div
                  key={w}
                  className="text-center font-semibold text-white/70"
                >
                  {w}
                </div>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-7 gap-2">
              {Array.from({ length: firstDayOffset }).map((_, i) => (
                <div
                  key={`spacer_${i}`}
                  className="aspect-square rounded-xl border border-transparent"
                />
              ))}

              {monthDays.map((d) => {
                const iso = toISODate(d);
                const e = entriesByDate.get(iso);

                const isSelected = selectedISO === iso;
                const isToday = iso === todayISO;
                const isFuture = iso > todayISO;

                const disabled = isFuture || isMonthLocked;

                const base =
                  "aspect-square rounded-xl border p-2 text-left transition";
                const selected = isSelected
                  ? "border-indigo-500 ring-2 ring-indigo-500/25 bg-white/[0.08]"
                  : "border-white/10";

                // Stronger "today" styling (visibly different)
                const todayStrong =
                  "border-indigo-300/60 bg-white/[0.12] shadow-[0_0_0_1px_rgba(99,102,241,0.35),0_14px_35px_rgba(0,0,0,0.45)]";
                const todayTopBar =
                  "relative overflow-hidden before:content-[''] before:absolute before:left-0 before:top-0 before:h-[2px] before:w-full before:bg-indigo-300/90";

                return (
                  <button
                    type="button"
                    key={iso}
                    disabled={disabled}
                    onClick={(ev) => {
                      if (disabled) return;
                      handleDayTap(iso, ev.currentTarget);
                    }}
                    className={[
                      base,
                      selected,
                      disabled
                        ? "cursor-not-allowed bg-white/[0.03] opacity-40"
                        : "bg-white/[0.04] hover:bg-white/[0.07]",
                      isToday && !isSelected ? todayStrong : "",
                      isToday && !isSelected ? todayTopBar : "",
                    ].join(" ")}
                  >
                    <div className="flex h-full flex-col justify-between">
                      <div className="flex items-start justify-between">
                        <div
                          className={[
                            "text-xs font-bold",
                            isToday ? "text-white" : "text-white/90",
                          ].join(" ")}
                        >
                          {d.getDate()}
                        </div>

                        <div className="flex items-center gap-1">
                          {e ? (
                            <StatusDot
                              status={e.status}
                              size={isSelected ? "md" : "sm"}
                            />
                          ) : (
                            <span className="h-2 w-2 rounded-full bg-white/15 ring-2 ring-white/10" />
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-white/55">
                        <span className="truncate">
                          {e?.hours ? `${e.hours}h` : ""}
                        </span>
                        <span className="ml-2">{e?.note ? "•" : ""}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="grid gap-4">
          {/* Summary */}
          <div className={surface}>
            <div className={`${surfaceHeader} px-2 sm:px-6 py-5`}>
              <div className="text-sm font-semibold text-white/90">
                Summary <span className="text-white/45">({monthKey})</span>
              </div>
            </div>

            <div className="px-2 sm:px-6 py-6">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: "Worked", value: totals.worked },
                  { label: "Absent", value: totals.absent },
                  { label: "Half", value: totals.half },
                  { label: "Off", value: totals.off },
                ].map((x) => (
                  <div
                    key={x.label}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className={`text-xs ${muted}`}>{x.label}</div>
                    <div className="mt-1 text-2xl font-semibold text-white">
                      {x.value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className={`text-xs ${muted}`}>Total hours (manual)</div>
                <div className="mt-1 text-2xl font-semibold text-white">
                  {totals.hours}
                </div>
              </div>

              <div className={`mt-3 text-xs ${muted2}`}>
                {isMonthLocked
                  ? "Month is locked: view only."
                  : "Tap a day to update status."}
              </div>
            </div>
          </div>

          {/* Day Details */}
          <div className={surface}>
            <div
              className={`${surfaceHeader} flex items-center justify-between gap-3 px-2 sm:px-6 py-5`}
            >
              <div className="text-sm font-semibold text-white/90">
                Day Details
              </div>
              <div className={`text-xs ${muted}`}>
                {selectedISO ?? "Select a day"}
              </div>
            </div>

            <div className="px-2 sm:px-6 py-6">
              {!selectedISO ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">
                  Select any date to view details.
                </div>
              ) : !selectedEntry ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">
                  No entry for this date.
                </div>
              ) : (
                <div className="grid gap-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-white/85">
                      Status
                    </div>
                    <StatusPill status={selectedEntry.status} />
                  </div>

                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-white/80">
                      Hours <span className="text-white/40">(optional)</span>
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      disabled={isMonthLocked}
                      value={selectedEntry.hours ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const num = raw === "" ? undefined : Number(raw);
                        updateSelected({
                          hours: Number.isFinite(num) ? num : undefined,
                        });
                      }}
                      className={[
                        "h-11 rounded-xl border px-4 text-sm outline-none transition",
                        "border-white/10 bg-white/[0.03] text-white placeholder:text-white/30",
                        isMonthLocked
                          ? "opacity-60"
                          : "focus:border-indigo-400/50 focus:ring-4 focus:ring-indigo-500/15",
                      ].join(" ")}
                      placeholder="e.g., 8"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-white/80">
                      Note <span className="text-white/40">(optional)</span>
                    </span>
                    <textarea
                      disabled={isMonthLocked}
                      value={selectedEntry.note ?? ""}
                      onChange={(e) => updateSelected({ note: e.target.value })}
                      className={[
                        "min-h-[110px] rounded-xl border px-4 py-3 text-sm outline-none transition",
                        "border-white/10 bg-white/[0.03] text-white placeholder:text-white/30",
                        isMonthLocked
                          ? "opacity-60"
                          : "focus:border-indigo-400/50 focus:ring-4 focus:ring-indigo-500/15",
                      ].join(" ")}
                      placeholder="e.g., Came late / extra cleaning / festival leave"
                    />
                  </label>

                  <div className={`text-xs ${muted2}`}>
                    {isMonthLocked
                      ? "Unlock month to edit."
                      : "Use the calendar to set status."}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Status Picker Popover */}
      {picker.open && picker.iso ? (
        <div
          ref={popoverRef}
          className="fixed z-50 w-[260px] rounded-2xl border border-white/10 bg-[#0B1020] p-2 text-white shadow-[0_25px_70px_rgba(0,0,0,0.6)]"
          style={{ left: picker.x, top: picker.y }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-2 text-xs font-semibold text-white/80">
            {picker.iso}
          </div>

          <div className="grid gap-1 px-1 pb-1">
            {STATUSES.map((s) => {
              const active = pickerEntry?.status === s;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={isMonthLocked}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isMonthLocked) return;

                    upsertWithStatus(picker.iso!, s);
                    setPicker((p) => ({ ...p, open: false }));
                  }}
                  className={[
                    "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm transition",
                    active ? "bg-white/10" : "hover:bg-white/[0.06]",
                    isMonthLocked ? "cursor-not-allowed opacity-50" : "",
                  ].join(" ")}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <StatusDot status={s} size="md" />
                    <span className="truncate text-white/85">
                      {statusLabel[s]}
                    </span>
                  </div>

                  {active ? (
                    <span className="text-xs font-semibold text-white/80">
                      ✓
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-2 px-2 pb-2 text-[11px] text-white/45">
            Tip: press <span className="font-semibold text-white/70">Esc</span>{" "}
            to close.
          </div>
        </div>
      ) : null}
    </main>
  );
}
