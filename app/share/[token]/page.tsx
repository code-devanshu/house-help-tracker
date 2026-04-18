import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AppData, Deduction, SalaryConfig, ShiftEntry } from "@/lib/storage/schema";
import { calculateSalary, daysInMonthFromKey, type SalaryBreakdown } from "@/lib/salary/calcSalary";
import { LangToggle } from "./LangToggle";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ month?: string; lang?: string }>;
};

type Lang = "hi" | "en";

/* ── helpers ── */

const money = (n: number) =>
  Number.isFinite(n) ? Math.round(n).toLocaleString("en-IN") : "0";

const isMonthKey = (v: string | undefined): v is string =>
  !!v && /^\d{4}-\d{2}$/.test(v);

const monthKeyNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const yesterdayISO = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const fmtMonthLabel = (monthKey: string, lang: Lang) => {
  const [y, m] = monthKey.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(
    lang === "hi" ? "hi-IN" : "en-IN",
    { month: "long", year: "numeric" }
  );
};

const fmtDate = (iso: string, lang: Lang) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(
    lang === "hi" ? "hi-IN" : "en-IN",
    { day: "2-digit", month: "short" }
  );

/* ── entry helpers ── */

function getEntryMonthKey(e: ShiftEntry): string | null {
  const a = e as any;
  if (typeof a.monthKey === "string") return a.monthKey;
  const iso = a.dateISO || a.dayISO || a.isoDate || a.date || null;
  if (typeof iso === "string" && iso.length >= 7) return iso.slice(0, 7);
  if (typeof iso === "number") {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  return null;
}

function getEntryDateISO(e: ShiftEntry): string | null {
  const a = e as any;
  const iso = a.dateISO || a.dayISO || a.isoDate || a.date || null;
  if (typeof iso === "string" && /^\d{4}-\d{2}-\d{2}/.test(iso)) return iso.slice(0, 10);
  if (typeof iso === "number") {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return null;
}

function normalizeStatus(raw: unknown): "worked" | "half" | "off" | "absent" | null {
  if (typeof raw !== "string") return null;
  const s = raw.toLowerCase();
  if (["worked", "work", "present", "p", "full"].includes(s)) return "worked";
  if (["half", "halfday", "h"].includes(s)) return "half";
  if (["off", "leave", "holiday"].includes(s)) return "off";
  if (["absent", "a"].includes(s)) return "absent";
  return null;
}

type MonthData = {
  totals: SalaryBreakdown;
  dates: Record<"worked" | "half" | "off" | "absent", string[]>;
};

function buildMonthData(entries: ShiftEntry[], monthKey: string): MonthData {
  const totals: SalaryBreakdown = { worked: 0, half: 0, off: 0, absent: 0 };
  const dates = { worked: [] as string[], half: [] as string[], off: [] as string[], absent: [] as string[] };
  for (const e of entries) {
    if (getEntryMonthKey(e) !== monthKey) continue;
    const st = normalizeStatus((e as any).status);
    if (!st) continue;
    totals[st]++;
    const d = getEntryDateISO(e);
    if (d) dates[st].push(d);
  }
  Object.values(dates).forEach((a) => a.sort());
  return { totals, dates };
}

function pickNum(obj: unknown, keys: string[], fallback = 0): number {
  if (!obj || typeof obj !== "object") return fallback;
  for (const k of keys) {
    const v = (obj as any)[k];
    if (typeof v === "number") return v;
    if (typeof v === "string" && !isNaN(Number(v))) return Number(v);
  }
  return fallback;
}

/* ── i18n ── */

const strings = {
  hi: {
    salarySlip: "वेतन पर्ची", readOnly: "सिर्फ देखने के लिए",
    asOf: "कल तक की जानकारी", days: "दिन", youWillGet: "आपको मिलेगा",
    worked: "काम किया", half: "आधा दिन", off: "छुट्टी", absent: "ग़ैरहाज़िर",
    attendance: "हाज़िरी", breakdown: "हिसाब", gross: "कुल वेतन",
    deductions: "कटौती / एडवांस", net: "कुल देय",
    dates: "तारीखें", none: "कोई नहीं",
    halfDates: "आधा दिन", offDates: "छुट्टी", absentDates: "ग़ैरहाज़िर",
    howCalc: "वेतन कैसे निकला",
    calc1: "1 दिन = मासिक वेतन ÷ महीने के कुल दिन",
    calc2: "आधा दिन = 1 दिन का 50%",
    calc3: "छुट्टी = सीमा तक भुगतान, उसके बाद ₹0",
    calc4: "कटौती = कुल वेतन से घटाई जाती है",
    noDeductions: "कोई कटौती नहीं",
  },
  en: {
    salarySlip: "Salary Slip", readOnly: "Read-only",
    asOf: "Data as of yesterday", days: "days", youWillGet: "You will receive",
    worked: "Worked", half: "Half day", off: "Off", absent: "Absent",
    attendance: "Attendance", breakdown: "Breakdown", gross: "Gross pay",
    deductions: "Deductions", net: "Net pay",
    dates: "Date details", none: "None",
    halfDates: "Half days", offDates: "Off days", absentDates: "Absent days",
    howCalc: "How salary is calculated",
    calc1: "Per-day = Monthly salary ÷ days in month",
    calc2: "Half day = 50% of per-day rate",
    calc3: "Off days = Paid up to allowed limit, then ₹0",
    calc4: "Deductions are subtracted from gross pay",
    noDeductions: "No deductions this month",
  },
};

/* ── error page ── */

function ErrorPage({ lang, reason }: { lang: Lang; reason: "expired" | "notfound" }) {
  const isHi = lang === "hi";
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#060912] px-4 text-white">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.04] p-10 text-center backdrop-blur-xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-3xl ring-1 ring-rose-500/20">
          🔗
        </div>
        <h1 className="text-lg font-semibold text-white">
          {reason === "expired"
            ? (isHi ? "लिंक समाप्त हो गया" : "Link expired or invalid")
            : (isHi ? "कर्मचारी नहीं मिला" : "Worker not found")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-white/45">
          {reason === "expired"
            ? (isHi ? "यह शेयर लिंक अब मान्य नहीं है। एक नया लिंक माँगें।" : "This share link is no longer valid. Ask the owner to generate a new one.")
            : (isHi ? "इस लिंक का डेटा उपलब्ध नहीं है।" : "The data for this link is no longer available.")}
        </p>
      </div>
    </main>
  );
}

/* ═══════════════════════════════════════
   PAGE
═══════════════════════════════════════ */

export default async function ShareWorkerPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const sp = searchParams ? await searchParams : {};
  const lang: Lang = sp.lang === "en" ? "en" : "hi";
  const t = strings[lang];
  const monthKey = isMonthKey(sp.month) ? sp.month : monthKeyNow();

  /* ── DB fetches ── */
  const { data: link } = await supabaseAdmin
    .from("worker_share_links")
    .select("owner_key, worker_id")
    .eq("token", token)
    .maybeSingle();
  if (!link) return <ErrorPage lang={lang} reason="expired" />;

  const { data: blob } = await supabaseAdmin
    .from("app_blobs")
    .select("data")
    .eq("key", link.owner_key)
    .maybeSingle();
  if (!blob?.data) return <ErrorPage lang={lang} reason="expired" />;

  const app = blob.data as AppData;
  const worker = app.workers.find((w) => w.id === link.worker_id);
  if (!worker) return <ErrorPage lang={lang} reason="notfound" />;

  /* ── Data ── */
  const entries = app.entries.filter((e) => e.workerId === worker.id);
  const cfg = app.salaryConfigs.find((s) => s.workerId === worker.id && s.monthKey === monthKey) as SalaryConfig | undefined;
  const savedMonthlySalary = pickNum(cfg, ["monthlySalary", "salary"], 0);
  const savedPaidOffAllowance = pickNum(cfg, ["paidOffAllowance", "paidOff", "offAllowance", "paidOffDays"], 0);
  const deductions = app.deductions.filter((d) => d.workerId === worker.id && d.monthKey === monthKey);
  const monthData = buildMonthData(entries, monthKey);
  const salary = calculateSalary({ monthKey, totals: monthData.totals, savedMonthlySalary, savedPaidOffAllowance, deductions: deductions as Deduction[] });
  const daysInMonth = daysInMonthFromKey(monthKey);
  const perDay = daysInMonth > 0 ? savedMonthlySalary / daysInMonth : 0;

  /* ── Avatar color ── */
  const hue = worker.name.charCodeAt(0) % 6;
  const avatarColors = ["from-indigo-500 to-violet-500","from-emerald-500 to-teal-500","from-amber-500 to-orange-500","from-rose-500 to-pink-500","from-cyan-500 to-sky-500","from-violet-500 to-purple-500"];
  const initials = worker.name.split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]!.toUpperCase()).join("");

  return (
    <main className="min-h-screen bg-[#060912] px-4 py-8 text-white">
      <div className="mx-auto max-w-lg space-y-4">

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-white/50">
            <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
            {t.readOnly}
          </span>
          <LangToggle token={token} monthKey={monthKey} lang={lang} />
        </div>

        {/* ── Worker + Net Pay hero card ── */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            {/* Identity */}
            <div className="flex items-center gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${avatarColors[hue]} shadow-lg`}>
                <span className="text-sm font-bold text-white">{initials}</span>
              </div>
              <div>
                <div className="text-xs font-medium text-white/40">{t.salarySlip}</div>
                <div className="text-lg font-semibold text-white">{worker.name}</div>
                <div className="mt-0.5 text-xs text-white/40">
                  {fmtMonthLabel(monthKey, lang)} · {daysInMonth} {t.days}
                </div>
              </div>
            </div>
          </div>

          {/* Net pay display */}
          <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] p-4">
            <div className="text-xs font-medium text-emerald-400/70">{t.youWillGet}</div>
            <div className="mt-1 text-4xl font-bold tracking-tight text-emerald-300">
              ₹{money(salary.netPayable)}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/40">
              <span>{t.gross} ₹{money(salary.grossPayable)}</span>
              {salary.deductionsTotal > 0 && (
                <>
                  <span>·</span>
                  <span className="text-rose-400/70">{t.deductions} −₹{money(salary.deductionsTotal)}</span>
                </>
              )}
            </div>
          </div>

          {/* As-of badge */}
          <div className="mt-3 flex items-center gap-1.5 text-xs text-white/30">
            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M6 3.5V6l1.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            {t.asOf} · {fmtDate(yesterdayISO(), lang)}
          </div>
        </div>

        {/* ── Attendance stats ── */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/35">{t.attendance}</div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: t.worked, value: monthData.totals.worked, cls: "text-emerald-300", bg: "bg-emerald-500/10 border-emerald-500/20" },
              { label: t.half,   value: monthData.totals.half,   cls: "text-amber-300",   bg: "bg-amber-500/10 border-amber-500/20" },
              { label: t.off,    value: monthData.totals.off,    cls: "text-sky-300",     bg: "bg-sky-500/10 border-sky-500/20" },
              { label: t.absent, value: monthData.totals.absent, cls: "text-rose-300",    bg: "bg-rose-500/10 border-rose-500/20" },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl border p-3 text-center ${s.bg}`}>
                <div className={`text-2xl font-bold ${s.cls}`}>{s.value}</div>
                <div className="mt-1 text-[10px] font-medium text-white/40 leading-tight">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Salary breakdown ── */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/35">{t.breakdown}</div>
          <div className="space-y-2">
            {[
              { label: `${t.worked} (${monthData.totals.worked} × ₹${money(perDay)})`, value: salary.grossPayable - monthData.totals.half * (perDay / 2) - Math.min(monthData.totals.off, savedPaidOffAllowance) * perDay, show: monthData.totals.worked > 0 },
              { label: `${t.half} (${monthData.totals.half} × ₹${money(perDay / 2)})`, value: monthData.totals.half * (perDay / 2), show: monthData.totals.half > 0 },
              { label: `${t.off} (${Math.min(monthData.totals.off, savedPaidOffAllowance)} paid)`, value: Math.min(monthData.totals.off, savedPaidOffAllowance) * perDay, show: monthData.totals.off > 0 },
            ].filter((r) => r.show).map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-4 py-2.5">
                <span className="text-sm text-white/60">{r.label}</span>
                <span className="text-sm font-semibold text-white">₹{money(r.value)}</span>
              </div>
            ))}

            {/* Deductions */}
            {deductions.length > 0 && (
              <>
                <div className="my-1 h-px bg-white/[0.06]" />
                {deductions.sort((a, b) => a.dateISO > b.dateISO ? -1 : 1).map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/10 bg-rose-500/[0.05] px-4 py-2.5">
                    <div className="min-w-0">
                      <span className="text-sm text-white/55">{d.note || t.deductions}</span>
                      <span className="ml-2 text-xs text-white/25">{fmtDate(d.dateISO, lang)}</span>
                    </div>
                    <span className="text-sm font-semibold text-rose-300">−₹{money(d.amount)}</span>
                  </div>
                ))}
              </>
            )}

            {/* Net total */}
            <div className="mt-1 flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-3">
              <span className="text-sm font-semibold text-white">{t.net}</span>
              <span className="text-xl font-bold text-emerald-300">₹{money(salary.netPayable)}</span>
            </div>
          </div>
        </div>

        {/* ── Date details ── */}
        {(monthData.dates.half.length > 0 || monthData.dates.off.length > 0 || monthData.dates.absent.length > 0) && (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/35">{t.dates}</div>
            <div className="space-y-3">
              {[
                { label: t.halfDates, dates: monthData.dates.half, chipCls: "bg-amber-500/15 text-amber-300 border-amber-500/20" },
                { label: t.offDates,  dates: monthData.dates.off,  chipCls: "bg-sky-500/15 text-sky-300 border-sky-500/20" },
                { label: t.absentDates, dates: monthData.dates.absent, chipCls: "bg-rose-500/15 text-rose-300 border-rose-500/20" },
              ].filter((r) => r.dates.length > 0).map((r) => (
                <div key={r.label}>
                  <div className="mb-1.5 text-xs font-medium text-white/35">{r.label}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {r.dates.map((d) => (
                      <span key={d} className={`rounded-lg border px-2 py-1 text-xs font-medium ${r.chipCls}`}>
                        {fmtDate(d, lang)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── How calculated ── */}
        <details className="group rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-medium text-white/45 hover:text-white/60 transition">
            <span>{t.howCalc}</span>
            <svg className="h-3.5 w-3.5 transition-transform group-open:rotate-180" viewBox="0 0 14 14" fill="none">
              <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </summary>
          <div className="border-t border-white/[0.06] px-5 py-4 space-y-2">
            {[t.calc1, t.calc2, t.calc3, t.calc4].map((line) => (
              <div key={line} className="flex items-start gap-2.5 text-xs text-white/40">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400/50" />
                {line}
              </div>
            ))}
          </div>
        </details>

        {/* ── Footer ── */}
        <div className="pb-4 text-center text-[11px] text-white/20">
          Generated by House Help Tracker
        </div>
      </div>
    </main>
  );
}
