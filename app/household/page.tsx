"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { PersonCountEntry } from "@/lib/storage/schema";
import {
  deletePersonCountEntry,
  loadAppData,
  saveAppData,
  upsertPersonCountEntry,
} from "@/lib/storage/localStore";
import { MonthPicker } from "@/components/MonthPicker";
import { daysInMonthFromKey } from "@/lib/salary/calcSalary";
import { makeId } from "@/lib/utils/id";
import { getAppData, syncAppData } from "@/app/workers/action";

const money = (n: number) => Math.round(n).toLocaleString("en-IN");

function toMonthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function HouseholdPage() {
  const [month, setMonth] = useState<Date>(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });

  const monthKey = useMemo(() => toMonthKey(month), [month]);
  const currentMonthStart = useMemo(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); }, []);

  const [entries, setEntries] = useState<PersonCountEntry[]>([]);
  const [fromDateDraft, setFromDateDraft] = useState("");
  const [countDraft, setCountDraft] = useState("3");
  const [error, setError] = useState<string | null>(null);
  const [, startSync] = useTransition();

  const syncToCloud = () => {
    startSync(async () => {
      await syncAppData(loadAppData());
    });
  };

  const refreshEntries = (key: string) => {
    const data = loadAppData();
    return (data.personCountLog ?? [])
      .filter((p) => p.monthKey === key)
      .sort((a, b) => a.fromDateISO.localeCompare(b.fromDateISO));
  };

  // On mount, pull from Supabase so we have the latest cloud data before showing entries
  useEffect(() => {
    (async () => {
      try {
        const remote = await getAppData();
        if (remote?.data) {
          saveAppData(remote.data, { silent: true });
        }
      } catch {
        // fall through — show local data
      }
      setEntries(refreshEntries(monthKey));
      setFromDateDraft(`${monthKey}-01`);
      setCountDraft("3");
      setError(null);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload entries when month changes (after initial mount)
  useEffect(() => {
    setEntries(refreshEntries(monthKey));
    setFromDateDraft(`${monthKey}-01`);
    setCountDraft("3");
    setError(null);
  }, [monthKey]);

  const totalDays = daysInMonthFromKey(monthKey);
  const monthMin = `${monthKey}-01`;
  const monthMax = `${monthKey}-${String(totalDays).padStart(2, "0")}`;

  const handleAdd = () => {
    setError(null);
    const count = Math.round(Number(countDraft));
    if (!countDraft || !Number.isFinite(count) || count < 1) {
      setError("Person count must be at least 1.");
      return;
    }
    if (!fromDateDraft || fromDateDraft < monthMin || fromDateDraft > monthMax) {
      setError(`Date must be within ${monthKey}.`);
      return;
    }
    // Check for duplicate fromDate
    if (entries.some((e) => e.fromDateISO === fromDateDraft)) {
      setError("An entry for this date already exists. Delete it first.");
      return;
    }
    const now = Date.now();
    const next: PersonCountEntry = {
      id: makeId("pcount"),
      monthKey,
      fromDateISO: fromDateDraft,
      count,
      createdAt: now,
      updatedAt: now,
    };
    upsertPersonCountEntry(next);
    setEntries(refreshEntries(monthKey));
    setCountDraft("3");
    setFromDateDraft(`${monthKey}-01`);
    syncToCloud();
  };

  const handleDelete = (id: string) => {
    deletePersonCountEntry(id);
    setEntries(refreshEntries(monthKey));
    syncToCloud();
  };

  // Compute a preview of effective daily rates for display
  const segments = useMemo(() => {
    if (entries.length === 0) return [];
    return entries.map((e, i) => {
      const from = e.fromDateISO;
      const to =
        i + 1 < entries.length
          ? (() => {
              const [y, m, d] = entries[i + 1]!.fromDateISO.split("-").map(Number) as [number, number, number];
              const prev = new Date(y, m - 1, d);
              prev.setDate(prev.getDate() - 1);
              return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-${String(prev.getDate()).padStart(2, "0")}`;
            })()
          : monthMax;
      const [fy, fm, fd] = from.split("-").map(Number) as [number, number, number];
      const [ty, tm, td] = to.split("-").map(Number) as [number, number, number];
      const days = Math.round((new Date(ty, tm - 1, td).getTime() - new Date(fy, fm - 1, fd).getTime()) / 86400000) + 1;
      return { from, to, count: e.count, days, id: e.id };
    });
  }, [entries, monthMax]);

  return (
    <main className="px-4 pt-6 pb-20 text-slate-900 dark:text-white">

      {/* ── Header ── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Household</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-white/45">
            Track person count changes for per-person salary workers
          </p>
        </div>
        <MonthPicker month={month} onChange={setMonth} max={currentMonthStart} />
      </div>

      {/* ── Info card ── */}
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/6 px-5 py-4 dark:bg-indigo-500/5">
        <svg className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        <div className="text-xs text-indigo-700 dark:text-indigo-300/80">
          <p className="font-semibold">How person count works</p>
          <p className="mt-1 text-indigo-600/80 dark:text-indigo-300/60">
            Workers set to <strong>Per person</strong> salary mode have their monthly salary calculated as{" "}
            <em>rate × person count</em>. When the count changes mid-month, salary is prorated accurately per segment.
            Add one entry per change — the count applies from that date until the next entry or end of month.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">

        {/* ── Left: Timeline ── */}
        <div className="rounded-2xl border border-slate-200 bg-white dark:border-white/7 dark:bg-white/2.5">
          <div className="border-b border-slate-100 px-5 py-4 dark:border-white/7">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-800 dark:text-white/85">Person count — {monthKey}</div>
              {entries.length > 0 && (
                <span className="text-xs text-slate-400 dark:text-white/35">{totalDays} days total</span>
              )}
            </div>
          </div>

          {entries.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl dark:bg-white/6">👥</div>
              <div>
                <div className="text-sm font-medium text-slate-600 dark:text-white/60">No person count set for {monthKey}</div>
                <div className="mt-1 text-xs text-slate-400 dark:text-white/30">Add an entry to enable per-person salary calculation.</div>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {segments.map((seg, i) => (
                <div
                  key={seg.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-white/6 dark:bg-white/2.5"
                >
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center gap-0.5 self-stretch">
                    <div className="h-2 w-2 rounded-full bg-violet-400 ring-2 ring-violet-400/20 mt-1" />
                    {i < segments.length - 1 && <div className="w-px flex-1 bg-slate-200 dark:bg-white/10 my-0.5" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800 dark:text-white/85">
                        {seg.count} {seg.count === 1 ? "person" : "persons"}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-white/30">
                        {formatDate(seg.from)}
                        {seg.from !== seg.to && <> – {formatDate(seg.to)}</>}
                        {" "}· {seg.days} {seg.days === 1 ? "day" : "days"}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(seg.id)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition dark:text-white/25 dark:hover:bg-rose-500/15 dark:hover:text-rose-400"
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Add form ── */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/7 dark:bg-white/2.5">
            <div className="mb-4 text-sm font-semibold text-slate-800 dark:text-white/85">Add person count change</div>

            <div className="space-y-3">
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35">
                  From date
                </span>
                <input
                  type="date"
                  value={fromDateDraft}
                  min={monthMin}
                  max={monthMax}
                  onChange={(e) => { setFromDateDraft(e.target.value); setError(null); }}
                  className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-white/4 dark:text-white dark:scheme-dark"
                />
                <span className="text-[11px] text-slate-400 dark:text-white/30">
                  This count applies from this date until the next entry or end of month.
                </span>
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35">
                  Number of persons
                </span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={countDraft}
                  onChange={(e) => { setCountDraft(e.target.value); setError(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                  placeholder="e.g. 4"
                  className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-white/4 dark:text-white"
                />
              </label>

              {error && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/8 px-3 py-2.5 text-xs text-rose-600 dark:text-rose-300/80">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleAdd}
                disabled={!countDraft}
                className={`h-10 w-full rounded-xl text-sm font-semibold transition ${
                  countDraft
                    ? "bg-indigo-500 text-white hover:bg-indigo-400 shadow-[0_4px_14px_rgba(99,102,241,0.3)]"
                    : "bg-slate-100 text-slate-300 dark:bg-white/6 dark:text-white/25"
                }`}
              >
                Add entry
              </button>
            </div>
          </div>

          {/* ── Workers using per-person salary ── */}
          <WorkersUsingPerPerson monthKey={monthKey} />
        </div>
      </div>
    </main>
  );
}

function WorkersUsingPerPerson({ monthKey }: { monthKey: string }) {
  const [workers, setWorkers] = useState<{ name: string; rate: number }[]>([]);

  useEffect(() => {
    const data = loadAppData();
    const active = data.workers.filter((w) => !w.archivedAt);
    const result: { name: string; rate: number }[] = [];
    for (const w of active) {
      const cfg = data.salaryConfigs.find(
        (s) => s.workerId === w.id && s.monthKey === monthKey,
      );
      if (cfg?.perPersonRate && cfg.perPersonRate > 0) {
        result.push({ name: w.name, rate: cfg.perPersonRate });
      }
    }
    setWorkers(result);
  }, [monthKey]);

  if (workers.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/7 dark:bg-white/2.5">
      <div className="mb-3 text-sm font-semibold text-slate-800 dark:text-white/85">Workers on per-person salary</div>
      <div className="space-y-1.5">
        {workers.map((w) => (
          <div key={w.name} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 dark:border-white/6 dark:bg-white/2.5">
            <span className="text-sm text-slate-700 dark:text-white/75">{w.name}</span>
            <span className="text-xs font-semibold text-violet-600 dark:text-violet-400">₹{money(w.rate)}/person</span>
          </div>
        ))}
      </div>
    </div>
  );
}
