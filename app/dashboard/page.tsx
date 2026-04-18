"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { MonthPicker } from "@/components/MonthPicker";
import { showToast } from "@/components/Toast";
import { loadAppData, saveAppData } from "@/lib/storage/localStore";
import type { AppData } from "@/lib/storage/schema";
import { addMonths, daysInMonth, monthLabel } from "@/lib/utils/date";
import { getAppData, syncAppData } from "../workers/action";

// ── Helpers ───────────────────────────────────────────────────────────────────

const money = (n: number) => Math.round(n).toLocaleString("en-IN");

function mkKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shortMonth(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number) as [number, number];
  return new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "short" });
}

function workerActiveInMonth(w: { startDate?: string; archivedAt?: number }, monthKey: string) {
  if (w.startDate && monthKey < w.startDate.slice(0, 7)) return false;
  if (w.archivedAt) {
    const archivedMonth = new Date(w.archivedAt).toISOString().slice(0, 7);
    if (monthKey > archivedMonth) return false;
  }
  return true;
}

function computeWorkerPay(workerId: string, monthKey: string, appData: AppData) {
  const cfg = appData.salaryConfigs.find(
    (s) => s.workerId === workerId && s.monthKey === monthKey,
  );
  const [y, m] = monthKey.split("-").map(Number) as [number, number];
  const days = daysInMonth(new Date(y, m - 1, 1));
  const entries = appData.entries.filter(
    (e) => e.workerId === workerId && e.dateISO.startsWith(monthKey),
  );
  const totals = { worked: 0, half: 0, absent: 0, off: 0 };
  for (const e of entries) {
    if (e.status === "WORKED") totals.worked++;
    else if (e.status === "HALF") totals.half++;
    else if (e.status === "ABSENT") totals.absent++;
    else if (e.status === "OFF") totals.off++;
  }
  if (!cfg) return { ...totals, net: 0, gross: 0, deductionsTotal: 0, hasSalary: false };
  const perDay = days > 0 ? cfg.monthlySalary / days : 0;
  const paidOff = Math.min(totals.off, cfg.paidOffAllowance);
  const gross =
    totals.worked * perDay + totals.half * (perDay / 2) + paidOff * perDay;
  const deductionsTotal = appData.deductions
    .filter((d) => d.workerId === workerId && d.monthKey === monthKey)
    .reduce(
      (s, d) => s + (Number.isFinite(d.amount) && d.amount > 0 ? d.amount : 0),
      0,
    );
  return {
    ...totals,
    net: Math.max(0, gross - deductionsTotal),
    gross,
    deductionsTotal,
    hasSalary: true,
  };
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 shadow-xl">
      <div className="mb-0.5 text-xs text-white/45">{label}</div>
      <div className="text-sm font-bold text-emerald-300">₹{money(payload[0]!.value)}</div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [, startTransition] = useTransition();
  const [initialLoading, setInitialLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [appData, setAppData] = useState<AppData>(() => {
    if (typeof window !== "undefined") return loadAppData();
    return {
      version: 3,
      workers: [],
      entries: [],
      monthLocks: [],
      salaryConfigs: [],
      deductions: [],
    };
  });

  useEffect(() => {
    setMounted(true);
    startTransition(async () => {
      try {
        const remote = await getAppData();
        if (remote?.data) {
          saveAppData(remote.data, { silent: true });
          setAppData(remote.data);
        } else {
          const local = loadAppData();
          setAppData(local);
          await syncAppData(local);
        }
      } catch {
        showToast("Could not load cloud data. Showing local data.", "error");
      } finally {
        setInitialLoading(false);
      }
    });
  }, []);

  const currentMonthStart = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  }, []);

  const activeWorkers = useMemo(
    () => appData.workers.filter((w) => !w.archivedAt),
    [appData.workers],
  );

  // All workers (including archived) used for pay calculations so history is complete
  const allWorkers = appData.workers;

  const monthKey = mkKey(selectedMonth);

  // Earliest worker start date across all workers → minimum MonthPicker boundary
  const earliestStart = useMemo(() => {
    const starts = allWorkers
      .filter((w) => !!w.startDate)
      .map((w) => w.startDate!.slice(0, 7));
    // (no monthKey filter here — we want the absolute earliest)
    if (!starts.length) return undefined;
    const earliest = starts.sort()[0]!;
    const [ey, em] = earliest.split("-").map(Number) as [number, number];
    return new Date(ey, em - 1, 1);
  }, [allWorkers]);

  // Per-worker breakdown for selected month (all workers active in that month)
  const workerBreakdown = useMemo(
    () =>
      allWorkers
        .filter((w) => workerActiveInMonth(w, monthKey))
        .map((w) => ({ worker: w, ...computeWorkerPay(w.id, monthKey, appData) }))
        .sort((a, b) => b.net - a.net),
    [allWorkers, monthKey, appData],
  );

  const totalNet = workerBreakdown.reduce((s, r) => s + r.net, 0);
  const avgNet = workerBreakdown.length > 0 ? totalNet / workerBreakdown.length : 0;
  const maxNet = workerBreakdown[0]?.net ?? 1;

  // Last 6 months bar chart data (all workers)
  const trendData = useMemo(() => {
    const months: Date[] = [];
    for (let i = 5; i >= 0; i--) months.push(addMonths(currentMonthStart, -i));
    return months.map((d) => {
      const mk = mkKey(d);
      const total = allWorkers
        .filter((w) => workerActiveInMonth(w, mk))
        .reduce((sum, w) => sum + computeWorkerPay(w.id, mk, appData).net, 0);
      return { label: shortMonth(mk), monthKey: mk, total };
    });
  }, [allWorkers, currentMonthStart, appData]);

  const totalLast6 = trendData.reduce((s, d) => s + d.total, 0);

  // ── Skeleton ────────────────────────────────────────────────────────────────
  if (initialLoading) {
    return (
      <main className="px-4 pt-8 pb-16">
        <div className="mb-8 h-8 w-48 animate-pulse rounded-lg bg-white/6" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/4 border border-white/6" />
          ))}
        </div>
        <div className="mt-6 h-56 animate-pulse rounded-2xl bg-white/4 border border-white/6" />
        <div className="mt-6 h-48 animate-pulse rounded-2xl bg-white/4 border border-white/6" />
      </main>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (allWorkers.length === 0) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-3xl">📊</div>
        <div>
          <div className="text-base font-semibold text-white/70">No data yet</div>
          <div className="mt-1 text-sm text-white/35">Add workers and mark attendance to see your dashboard.</div>
        </div>
        <Link
          href="/workers"
          className="mt-2 inline-flex h-9 items-center gap-2 rounded-xl bg-indigo-500 px-4 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(99,102,241,0.35)] hover:bg-indigo-400 transition"
        >
          Go to Workers →
        </Link>
      </main>
    );
  }

  return (
    <main className="px-4 pt-8 pb-16 text-slate-100">
      {/* ── Header ── */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Dashboard</h1>
          <p className="mt-0.5 text-sm text-white/40">
            {activeWorkers.length} active
            {allWorkers.length > activeWorkers.length && (
              <span className="text-white/25"> · {allWorkers.length - activeWorkers.length} archived</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <MonthPicker
            month={selectedMonth}
            onChange={setSelectedMonth}
            min={earliestStart}
            max={currentMonthStart}
          />
          <Link
            href="/workers"
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            Manage Workers
            <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none">
              <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label={`Payable · ${monthLabel(selectedMonth)}`}
          value={`₹${money(totalNet)}`}
          sub={workerBreakdown.length === 0 ? "No workers started yet" : `${workerBreakdown.length} worker${workerBreakdown.length !== 1 ? "s" : ""}`}
          accent="emerald"
        />
        <StatCard
          label="Avg per worker"
          value={avgNet > 0 ? `₹${money(avgNet)}` : "—"}
          sub="This month"
          accent="indigo"
        />
        <StatCard
          label="Total · Last 6 months"
          value={totalLast6 > 0 ? `₹${money(totalLast6)}` : "—"}
          sub="All workers combined"
          accent="violet"
        />
      </div>

      {/* ── Monthly trend ── */}
      <section className="mt-5 rounded-2xl border border-white/[0.07] bg-white/2.5 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-white/80">Monthly spend</div>
            <div className="mt-0.5 text-xs text-white/35">Last 6 months · all workers</div>
          </div>
        </div>

        {mounted && (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={trendData} barSize={32} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="label"
                tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                }
                width={36}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                {trendData.map((entry) => (
                  <Cell
                    key={entry.monthKey}
                    fill={
                      entry.monthKey === mkKey(currentMonthStart)
                        ? "rgba(99,102,241,0.85)"
                        : "rgba(99,102,241,0.35)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* ── Per-worker breakdown ── */}
      <section className="mt-5 rounded-2xl border border-white/[0.07] bg-white/2.5 shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-white/80">Worker breakdown</div>
            <div className="mt-0.5 text-xs text-white/35">{monthLabel(selectedMonth)}</div>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5">
            <span className="text-xs text-emerald-400/70">Total </span>
            <span className="text-sm font-bold text-emerald-300">₹{money(totalNet)}</span>
          </div>
        </div>

        {workerBreakdown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <div className="text-xl opacity-30">📅</div>
            <div className="text-sm text-white/40">No workers had started by this month</div>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {workerBreakdown.map(({ worker, net, gross, deductionsTotal, hasSalary, worked, half, absent }) => (
              <Link
                key={worker.id}
                href={`/workers/${worker.id}`}
                className="group flex items-center gap-3 px-5 py-3.5 transition hover:bg-white/2.5"
              >
                <WorkerAvatar name={worker.name} />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`truncate text-sm font-semibold ${worker.archivedAt ? "text-white/45" : "text-white/85"}`}>{worker.name}</span>
                    {worker.archivedAt && (
                      <span className="shrink-0 rounded-full border border-white/10 px-1.5 py-0.5 text-[10px] text-white/30">archived</span>
                    )}
                  </div>
                  {hasSalary ? (
                    <div className="mt-0.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
                        <div
                          className="h-full rounded-full bg-linear-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                          style={{ width: maxNet > 0 ? `${(net / maxNet) * 100}%` : "0%" }}
                        />
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-white/30">
                        {worked > 0 && <span className="text-emerald-400/70">{worked}W</span>}
                        {half > 0 && <span className="text-amber-400/70">{half}H</span>}
                        {absent > 0 && <span className="text-rose-400/60">{absent}A</span>}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-0.5 text-xs text-white/25">No salary configured</div>
                  )}
                </div>

                <div className="shrink-0 text-right">
                  {hasSalary ? (
                    <>
                      <div className="text-sm font-bold text-emerald-300">₹{money(net)}</div>
                      {gross !== net && deductionsTotal > 0 && (
                        <div className="text-[11px] text-white/25">−₹{money(deductionsTotal)}</div>
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-white/25">—</span>
                  )}
                  <div className="mt-0.5 hidden text-[10px] text-indigo-400/60 group-hover:block">Open →</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: "emerald" | "indigo" | "violet";
}) {
  const colors = {
    emerald: "from-emerald-500/10 to-emerald-500/5 border-emerald-500/15 text-emerald-300",
    indigo: "from-indigo-500/10 to-indigo-500/5 border-indigo-500/15 text-indigo-300",
    violet: "from-violet-500/10 to-violet-500/5 border-violet-500/15 text-violet-300",
  };
  return (
    <div
      className={`rounded-2xl border bg-linear-to-br px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.3)] ${colors[accent]}`}
    >
      <div className="text-xs text-white/40">{label}</div>
      <div className={`mt-2 text-2xl font-bold ${colors[accent].split(" ").pop()}`}>{value}</div>
      <div className="mt-1 text-xs text-white/30">{sub}</div>
    </div>
  );
}

function WorkerAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]!.toUpperCase())
    .join("");
  const hue = name.charCodeAt(0) % 6;
  const colors = [
    "from-indigo-500/50 to-violet-500/50",
    "from-emerald-500/50 to-teal-500/50",
    "from-amber-500/50 to-orange-500/50",
    "from-rose-500/50 to-pink-500/50",
    "from-cyan-500/50 to-sky-500/50",
    "from-violet-500/50 to-purple-500/50",
  ];
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br ${colors[hue]}`}
    >
      <span className="text-xs font-bold text-white">{initials}</span>
    </div>
  );
}
