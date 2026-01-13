import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  AppData,
  Deduction,
  SalaryConfig,
  ShiftEntry,
} from "@/lib/storage/schema";
import {
  calculateSalary,
  daysInMonthFromKey,
  type SalaryBreakdown,
} from "@/lib/salary/calcSalary";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ month?: string; lang?: string; debug?: string }>;
};

type Lang = "hi" | "en";

/* ---------------- helpers ---------------- */

const money = (n: number): string =>
  String(Math.round(Number.isFinite(n) ? n : 0));

const isMonthKey = (v: string | undefined): v is string =>
  !!v && /^\d{4}-\d{2}$/.test(v);

const monthKeyNow = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtMonthLabel(monthKey: string, lang: Lang): string {
  const [y, m] = monthKey.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", {
    month: "long",
    year: "numeric",
  });
}

function fmtDateISO(dateISO: string, lang: Lang): string {
  const d = new Date(`${dateISO}T00:00:00`);
  return d.toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/* ---------------- entry parsing ---------------- */

function getEntryMonthKey(e: ShiftEntry): string | null {
  const anyE = e as any;
  if (typeof anyE.monthKey === "string") return anyE.monthKey;

  const iso = anyE.dateISO || anyE.dayISO || anyE.isoDate || anyE.date || null;

  if (typeof iso === "string" && iso.length >= 7) return iso.slice(0, 7);

  if (typeof iso === "number") {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  return null;
}

function getEntryDateISO(e: ShiftEntry): string | null {
  const anyE = e as any;
  const iso = anyE.dateISO || anyE.dayISO || anyE.isoDate || anyE.date || null;

  if (typeof iso === "string" && /^\d{4}-\d{2}-\d{2}/.test(iso))
    return iso.slice(0, 10);

  if (typeof iso === "number") {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return null;
}

function normalizeStatus(
  raw: unknown
): "worked" | "half" | "off" | "absent" | null {
  if (typeof raw !== "string") return null;
  const s = raw.toLowerCase();
  if (["worked", "work", "present", "p", "full"].includes(s)) return "worked";
  if (["half", "halfday", "h"].includes(s)) return "half";
  if (["off", "leave", "holiday"].includes(s)) return "off";
  if (["absent", "a"].includes(s)) return "absent";
  return null;
}

type MonthStatusDates = {
  totals: SalaryBreakdown;
  dates: Record<"worked" | "half" | "off" | "absent", string[]>;
};

function countTotalsAndDatesForMonth(
  entries: ShiftEntry[],
  monthKey: string
): MonthStatusDates {
  const totals: SalaryBreakdown = { worked: 0, half: 0, off: 0, absent: 0 };
  const dates = {
    worked: [],
    half: [],
    off: [],
    absent: [],
  } as MonthStatusDates["dates"];

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

function pickNumber(obj: unknown, keys: string[], fallback = 0): number {
  if (!obj || typeof obj !== "object") return fallback;
  for (const k of keys) {
    const v = (obj as any)[k];
    if (typeof v === "number") return v;
    if (typeof v === "string" && !isNaN(Number(v))) return Number(v);
  }
  return fallback;
}

/* ---------------- i18n ---------------- */

function T(lang: Lang) {
  return lang === "hi"
    ? {
        readOnly: "सिर्फ देखने के लिए",
        salarySlip: "वेतन पर्ची",
        youWillGet: "आपको मिलेगा",
        days: "दिन",
        attendance: "हाज़िरी",
        worked: "काम किया",
        half: "आधा दिन",
        off: "छुट्टी",
        absent: "ग़ैरहाज़िर",
        breakdown: "हिसाब",
        gross: "कुल",
        deductions: "एडवांस/कटौती",
        net: "कुल वेतन",
        upto: "जानकारी (कल तक)",
        datesTitle: "तारीखें",
        none: "कोई नहीं",
        halfDates: "आधा दिन",
        offDates: "छुट्टी",
        absentDates: "ग़ैरहाज़िर",
        howCalcTitle: "वेतन कैसे निकला",
        howCalcLine1: "1 दिन का वेतन = मासिक वेतन ÷ महीने के कुल दिन",
        howCalcLine2: "आधा दिन = 1 दिन के वेतन का 50%",
        howCalcLine3: "छुट्टी = निर्धारित भुगतान सीमा तक भुगतान, उसके बाद ₹0",
        howCalcLine4: "एडवांस / कटौती = कुल वेतन से घटाई जाती है",
        noDeductions: "इस महीने कोई कटौती नहीं है",
      }
    : {
        readOnly: "Read-only",
        salarySlip: "Salary Slip",
        youWillGet: "You will get",
        days: "days",
        attendance: "Attendance",
        worked: "Worked",
        half: "Half day",
        off: "OFF",
        absent: "Absent",
        breakdown: "Breakdown",
        gross: "Gross",
        deductions: "Deductions",
        net: "Net Pay",
        upto: "Details till yesterday",
        datesTitle: "Dates",
        none: "None",
        halfDates: "Half day",
        offDates: "OFF",
        absentDates: "Absent",
        howCalcTitle: "How salary is calculated",
        howCalcLine1:
          "Per-day salary = Monthly salary ÷ total days in the month",
        howCalcLine2: "Half day = 50% of per-day salary",
        howCalcLine3: "OFF = Paid up to allowed limit, after that ₹0",
        howCalcLine4: "Advance / deductions are subtracted from total salary",
        noDeductions: "No deductions for this month",
      };
}

/* ================= COMPONENT ================= */

export default async function ShareWorkerPage({
  params,
  searchParams,
}: PageProps) {
  const { token } = await params;
  const sp = searchParams ? await searchParams : {};
  const lang: Lang = sp.lang === "en" ? "en" : "hi";
  const t = T(lang);

  const monthKey = isMonthKey(sp.month) ? sp.month : monthKeyNow();
  const uptoLabel = fmtDateISO(yesterdayISO(), lang);

  const { data: link } = await supabaseAdmin
    .from("worker_share_links")
    .select("owner_key, worker_id")
    .eq("token", token)
    .maybeSingle();
  if (!link) return null;

  const { data: blob } = await supabaseAdmin
    .from("app_blobs")
    .select("data")
    .eq("key", link.owner_key)
    .maybeSingle();
  if (!blob?.data) return null;

  const app = blob.data as AppData;
  const worker = app.workers.find((w) => w.id === link.worker_id);
  if (!worker) return null;

  const entries = app.entries.filter((e) => e.workerId === worker.id);
  const cfg = app.salaryConfigs.find(
    (s) => s.workerId === worker.id && s.monthKey === monthKey
  ) as SalaryConfig | undefined;

  const savedMonthlySalary = pickNumber(cfg, ["monthlySalary", "salary"], 0);
  const monthData = countTotalsAndDatesForMonth(entries, monthKey);
  const savedPaidOffAllowance = pickNumber(
    cfg,
    ["paidOffAllowance", "paidOff", "offAllowance", "paidOffDays"],
    0
  );
  const deductions = app.deductions.filter(
    (d) => d.workerId === worker.id && d.monthKey === monthKey
  );
  const salary = calculateSalary({
    monthKey,
    totals: monthData.totals,
    savedMonthlySalary,
    savedPaidOffAllowance,
    deductions: deductions as Deduction[],
  });

  const daysInMonth = daysInMonthFromKey(monthKey);
  const monthLabel = fmtMonthLabel(monthKey, lang);

  return (
    <main className="min-h-screen bg-[#070A14] text-white">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div
          className="rounded-3xl border border-white/10 
          bg-gradient-to-br from-white/[0.06] via-white/[0.03] to-black/20
          p-5 sm:p-6 backdrop-blur"
        >
          {/* Header */}
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-xs text-white/55">{t.salarySlip}</div>
              <h1 className="mt-1 text-2xl font-semibold">{worker.name}</h1>

              <div className="mt-1 text-sm text-white/60">
                <span className="font-semibold text-white">{monthLabel}</span>
                <span className="mx-2 text-white/30">•</span>
                {daysInMonth} {t.days}
              </div>

              <div className="mt-1 inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-200">
                {t.upto} {uptoLabel}
              </div>
            </div>

            {/* Net Pay */}
            <div
              className="rounded-2xl border border-emerald-400/30 
              bg-gradient-to-br from-emerald-500/10 to-black/30
              px-5 py-3 shadow-[0_0_30px_-12px_rgba(16,185,129,0.6)]"
            >
              <div className="text-xs text-white/60">{t.youWillGet}</div>
              <div className="mt-1 text-3xl font-extrabold text-emerald-300">
                ₹{money(salary.netPayable)}
              </div>
              <div className="mt-1 text-[11px] text-white/50">
                {t.gross} ₹{money(salary.grossPayable)} • {t.deductions} ₹
                {money(salary.deductionsTotal)}
              </div>
            </div>
          </div>

          <div className="my-6 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          {/* Attendance */}
          <div>
            <div className="font-semibold text-white/85">{t.attendance}</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <Stat
                label={t.worked}
                value={monthData.totals.worked}
                tone="green"
              />
              <Stat
                label={t.half}
                value={monthData.totals.half}
                tone="yellow"
              />
              <Stat label={t.off} value={monthData.totals.off} tone="blue" />
              <Stat
                label={t.absent}
                value={monthData.totals.absent}
                tone="red"
              />
            </div>
          </div>

          <div className="my-6 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          {/* Dates */}
          <div>
            <div className="font-semibold text-white/85">{t.datesTitle}</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <DatesCard
                title={t.halfDates}
                dates={monthData.dates.half}
                lang={lang}
              />
              <DatesCard
                title={t.offDates}
                dates={monthData.dates.off}
                lang={lang}
              />
              <DatesCard
                title={t.absentDates}
                dates={monthData.dates.absent}
                lang={lang}
              />
            </div>
          </div>

          <div className="my-6 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          {/* How salary is calculated */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-sm font-semibold text-white/85">
              {t.howCalcTitle}
            </div>

            <ul className="mt-2 space-y-1 text-sm text-white/70 list-disc list-inside">
              <li>{t.howCalcLine1}</li>
              <li>{t.howCalcLine2}</li>
              <li>{t.howCalcLine3}</li>
              <li>{t.howCalcLine4}</li>
            </ul>

            {/* Numeric clarity (trust builder) */}
            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
              <div className="flex items-center justify-between text-white/70">
                <span>{t.gross}</span>
                <span className="font-semibold text-white">
                  ₹{money(salary.grossPayable)}
                </span>
              </div>

              <div className="mt-1 flex items-center justify-between text-white/70">
                <span>{t.deductions}</span>
                <span className="font-semibold text-white">
                  − ₹{money(salary.deductionsTotal)}
                </span>
              </div>

              {/* Deduction details */}
              <div className="mt-2">
                {deductions.length === 0 ? (
                  <div className="text-xs text-white/50">{t.noDeductions}</div>
                ) : (
                  <div className="mt-1 divide-y divide-white/10 rounded-lg border border-white/10 bg-white/[0.02]">
                    {deductions
                      .slice()
                      .sort((a, b) => (a.dateISO > b.dateISO ? -1 : 1))
                      .map((d) => (
                        <div
                          key={d.id}
                          className="flex items-center justify-between px-3 py-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-white/80">
                              {d.note || t.deductions}
                            </div>
                            <div className="text-white/40">
                              {fmtDateISO(d.dateISO, lang)}
                            </div>
                          </div>
                          <div className="font-semibold text-rose-300">
                            − ₹{money(d.amount)}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
              <div className="mt-2 h-px bg-white/10" />

              <div className="mt-2 flex items-center justify-between text-white">
                <span className="font-semibold">{t.net}</span>
                <span className="text-lg font-extrabold text-emerald-300">
                  ₹{money(salary.netPayable)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ---------------- UI helpers ---------------- */

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "yellow" | "blue" | "red";
}) {
  const tones = {
    green: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    yellow: "border-amber-400/30 bg-amber-500/10 text-amber-200",
    blue: "border-sky-400/30 bg-sky-500/10 text-sky-200",
    red: "border-rose-400/30 bg-rose-500/10 text-rose-200",
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="text-xs opacity-80">{label}</div>
      <div className="mt-1 text-lg font-bold">{value}</div>
    </div>
  );
}

function DatesCard({
  title,
  dates,
  lang,
}: {
  title: string;
  dates: string[];
  lang: Lang;
}) {
  const t = T(lang);
  const MAX = 8;
  const shown = dates.slice(0, MAX);
  const rest = dates.slice(MAX);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-xs text-white/55">{title}</div>

      {dates.length === 0 ? (
        <div className="mt-2 text-sm font-semibold text-white/70">{t.none}</div>
      ) : rest.length === 0 ? (
        <div className="mt-2 text-sm font-semibold">
          {shown.map((d) => fmtDateISO(d, lang)).join(", ")}
        </div>
      ) : (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-semibold text-sky-300">
            {shown.map((d) => fmtDateISO(d, lang)).join(", ")}{" "}
            <span className="text-xs opacity-70">+{rest.length}</span>
          </summary>
          <div className="mt-2 text-sm font-semibold text-white/85">
            {dates.map((d) => fmtDateISO(d, lang)).join(", ")}
          </div>
        </details>
      )}
    </div>
  );
}
