"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  MonthLock,
  SalaryConfig,
  ShiftEntry,
  ShiftStatus,
  Worker,
} from "@/lib/storage/schema";

import {
  loadAppData,
  upsertEntry,
  upsertMonthLock,
  upsertSalaryConfig,
} from "@/lib/storage/localStore";

import { MonthPicker } from "@/components/MonthPicker";
import { StatusPill } from "@/components/StatusPill";
import { StatusDot } from "@/components/StatusDot";
import { SalaryCard } from "@/components/SalaryCard";

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

export default function WorkerTrackerPage() {
  const params = useParams<{ workerId?: string }>();
  const router = useRouter();
  const workerId = typeof params.workerId === "string" ? params.workerId : "";

  const [worker, setWorker] = useState<Worker | null>(null);
  const [month, setMonth] = useState<Date>(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  const [entries, setEntries] = useState<ShiftEntry[]>([]);
  const [monthLocks, setMonthLocks] = useState<MonthLock[]>([]);
  const [salaryConfigs, setSalaryConfigs] = useState<SalaryConfig[]>([]);
  const [selectedISO, setSelectedISO] = useState<string | null>(null);

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
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const todayISO = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return toISODate(t);
  }, []);

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

  const monthDays = useMemo(() => getMonthDays(month), [month]);

  const monthKey = useMemo(() => {
    return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
  }, [month]);

  const daysInMonth = monthDays.length;

  const entriesByDate = useMemo(() => {
    const map = new Map<string, ShiftEntry>();
    for (const e of entries) map.set(e.dateISO, e);
    return map;
  }, [entries]);

  const selectedEntry = useMemo(() => {
    if (!selectedISO) return null;
    return entriesByDate.get(selectedISO) ?? null;
  }, [selectedISO, entriesByDate]);

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

  // Hydrate salary drafts for active month
  useEffect(() => {
    if (!currentSalaryConfig) {
      setSalaryDraft("");
      setPaidOffDraft("0");
      return;
    }
    setSalaryDraft(String(currentSalaryConfig.monthlySalary ?? 0));
    setPaidOffDraft(String(currentSalaryConfig.paidOffAllowance ?? 0));
  }, [currentSalaryConfig, monthKey]);

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
    // eslint-disable-next-line react-hooks/purity
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
    const x = Math.min(rect.left, window.innerWidth - 260);
    const y = Math.min(rect.bottom + 8, window.innerHeight - 260);
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

  const pickerEntry =
    picker.iso && entriesByDate.get(picker.iso)
      ? entriesByDate.get(picker.iso)!
      : null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/workers"
              className="text-sm text-slate-600 hover:underline"
            >
              ← Workers
            </Link>
          </div>

          <h1 className="mt-2 text-2xl font-extrabold tracking-tight">
            {worker.name}
          </h1>

          <p className="mt-1 text-sm text-slate-600">
            Month: <span className="font-semibold">{monthLabel(month)}</span>{" "}
            {worker.defaultShiftLabel
              ? `• Default: ${worker.defaultShiftLabel}`
              : ""}
          </p>

          {/* Lock controls */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={[
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
                isMonthLocked ? "bg-slate-100" : "bg-white",
              ].join(" ")}
            >
              <span
                className={isMonthLocked ? "text-slate-900" : "text-slate-700"}
              >
                {isMonthLocked ? "🔒 Month locked" : "🔓 Month unlocked"}
              </span>
            </span>

            <button
              type="button"
              onClick={() => setLocked(!isMonthLocked)}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              {isMonthLocked ? "Unlock month" : "Lock month"}
            </button>

            <span className="text-xs text-slate-500">
              {isMonthLocked
                ? "Editing disabled for this month."
                : "You can edit days normally."}
            </span>
          </div>
        </div>

        <MonthPicker month={month} onChange={setMonth} />
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
        />
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-600">
        <div className="font-semibold">Legend:</div>
        <div className="inline-flex items-center gap-2">
          <StatusDot status="WORKED" /> Worked
        </div>
        <div className="inline-flex items-center gap-2">
          <StatusDot status="ABSENT" /> Absent
        </div>
        <div className="inline-flex items-center gap-2">
          <StatusDot status="HALF" /> Half
        </div>
        <div className="inline-flex items-center gap-2">
          <StatusDot status="OFF" /> Off
        </div>
      </div>

      {/* Calendar + right */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        {/* Calendar */}
        <div className="rounded-2xl border bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">Calendar</div>
            <div className="text-xs text-slate-600">
              {isMonthLocked ? "Month is locked" : "Tap a day to pick status"}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-2 text-xs text-slate-600">
            {weekdayShort.map((w) => (
              <div key={w} className="text-center font-semibold">
                {w}
              </div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-2">
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
                ? "border-slate-900 ring-2 ring-slate-100"
                : "border-slate-200";
              const todayRing = isToday ? "ring-2 ring-slate-900/40" : "";

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
                    todayRing,
                    disabled
                      ? "cursor-not-allowed bg-slate-50 opacity-40"
                      : "hover:bg-slate-50",
                  ].join(" ")}
                >
                  <div className="flex h-full flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <div className="text-xs font-bold">{d.getDate()}</div>

                      <div className="flex items-center gap-1">
                        {e ? (
                          <StatusDot
                            status={e.status}
                            size={isSelected ? "md" : "sm"}
                          />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-slate-200 ring-2 ring-white" />
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500">
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

        {/* Right Panel */}
        <div className="grid gap-4">
          <div className="rounded-2xl border bg-white p-4">
            <div className="text-sm font-semibold">Summary ({monthKey})</div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-600">Worked</div>
                <div className="text-lg font-bold">{totals.worked}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-600">Absent</div>
                <div className="text-lg font-bold">{totals.absent}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-600">Half</div>
                <div className="text-lg font-bold">{totals.half}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-600">Off</div>
                <div className="text-lg font-bold">{totals.off}</div>
              </div>
            </div>

            <div className="mt-3 rounded-xl border p-3">
              <div className="text-xs text-slate-600">Total hours (manual)</div>
              <div className="text-lg font-bold">{totals.hours}</div>
            </div>

            <div className="mt-3 text-xs text-slate-500">
              {isMonthLocked
                ? "Month is locked: view only."
                : "Tap a day to update status."}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">Day Details</div>
              <div className="text-xs text-slate-600">
                {selectedISO ?? "Select a day"}
              </div>
            </div>

            {!selectedISO ? (
              <div className="mt-3 rounded-xl border bg-slate-50 p-3 text-sm text-slate-700">
                Select any date to view details.
              </div>
            ) : !selectedEntry ? (
              <div className="mt-3 rounded-xl border bg-slate-50 p-3 text-sm text-slate-700">
                No entry for this date.
              </div>
            ) : (
              <div className="mt-3 grid gap-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Status</div>
                  <StatusPill status={selectedEntry.status} />
                </div>

                <label className="grid gap-1">
                  <span className="text-sm font-medium">Hours (optional)</span>
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
                      "rounded-md border px-3 py-2 text-sm outline-none",
                      isMonthLocked
                        ? "bg-slate-50 text-slate-500"
                        : "focus:ring-2 focus:ring-slate-200",
                    ].join(" ")}
                    placeholder="e.g., 8"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-sm font-medium">Note (optional)</span>
                  <textarea
                    disabled={isMonthLocked}
                    value={selectedEntry.note ?? ""}
                    onChange={(e) => updateSelected({ note: e.target.value })}
                    className={[
                      "min-h-[90px] rounded-md border px-3 py-2 text-sm outline-none",
                      isMonthLocked
                        ? "bg-slate-50 text-slate-500"
                        : "focus:ring-2 focus:ring-slate-200",
                    ].join(" ")}
                    placeholder="e.g., Came late / extra cleaning / festival leave"
                  />
                </label>

                <div className="text-xs text-slate-500">
                  {isMonthLocked
                    ? "Unlock month to edit."
                    : "Use the calendar to set status."}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Picker Popover */}
      {picker.open && picker.iso ? (
        <div
          ref={popoverRef}
          className="fixed z-50 w-[260px] rounded-2xl border bg-white p-2 shadow-xl"
          style={{ left: picker.x, top: picker.y }}
        >
          <div className="px-2 py-1 text-xs font-semibold text-slate-700">
            {picker.iso}
          </div>

          <div className="mt-1 grid gap-1">
            {STATUSES.map((s) => {
              const active = pickerEntry?.status === s;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={isMonthLocked}
                  onClick={() => {
                    upsertWithStatus(picker.iso!, s);
                    setPicker((p) => ({ ...p, open: false }));
                  }}
                  className={[
                    "flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm",
                    active ? "bg-slate-100" : "hover:bg-slate-50",
                    isMonthLocked ? "cursor-not-allowed opacity-50" : "",
                  ].join(" ")}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <StatusDot status={s} size="md" />
                    <span className="truncate">{statusLabel[s]}</span>
                  </div>

                  {active ? (
                    <span className="text-xs font-semibold text-slate-700">
                      ✓
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-2 px-2 pb-1 text-[11px] text-slate-500">
            Tip: press <span className="font-semibold">Esc</span> to close.
          </div>
        </div>
      ) : null}
    </main>
  );
}
