import type {
  AppData,
  Deduction,
  MonthLock,
  SalaryConfig,
  ShiftEntry,
  Worker,
} from "@/lib/storage/schema";

type SaveOptions = {
  silent?: boolean;
};

const STORAGE_KEY = "house_help_tracker_appdata";
const CURRENT_VERSION = 3;

const nowMs = (): number => Date.now();

const safeParseJSON = (raw: string | null): unknown => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
};

const emptyData = (): AppData => ({
  version: CURRENT_VERSION,
  workers: [],
  entries: [],
  monthLocks: [],
  salaryConfigs: [],
  deductions: [],
});

const normalizeData = (input: unknown): AppData => {
  const base = emptyData();
  if (!input || typeof input !== "object") return base;

  const obj = input as Partial<AppData> & {
    deductions?: unknown;
  };

  return {
    version: CURRENT_VERSION,

    workers: Array.isArray(obj.workers) ? obj.workers : [],

    entries: Array.isArray(obj.entries) ? obj.entries : [],

    monthLocks: Array.isArray(obj.monthLocks) ? obj.monthLocks : [],

    salaryConfigs: Array.isArray(obj.salaryConfigs) ? obj.salaryConfigs : [],

    deductions: Array.isArray(obj.deductions)
      ? (obj.deductions as Deduction[])
      : [],
  };
};

const writeData = (data: AppData, options?: SaveOptions): void => {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

  // 🔕 silent write = do NOT trigger sync
  if (options?.silent) return;

  window.dispatchEvent(
    new CustomEvent("house_help_appdata_changed", {
      detail: { key: STORAGE_KEY, ts: Date.now() },
    })
  );
};

export const loadAppData = (): AppData => {
  if (typeof window === "undefined") return emptyData();

  const raw = window.localStorage.getItem(STORAGE_KEY);
  const parsed = safeParseJSON(raw);
  const normalized = normalizeData(parsed);

  // persist normalized/migrated shape
  writeData(normalized, { silent: true });
  return normalized;
};

export const saveAppData = (data: AppData, options?: SaveOptions): AppData => {
  const normalized = normalizeData(data);
  writeData(normalized, options);
  return normalized;
};

// -------------------------
// Worker
// -------------------------
export const upsertWorker = (worker: Worker): AppData => {
  const data = loadAppData();
  const idx = data.workers.findIndex((w) => w.id === worker.id);

  const nextWorkers =
    idx >= 0
      ? data.workers.map((w) => (w.id === worker.id ? worker : w))
      : [worker, ...data.workers];

  return saveAppData({ ...data, workers: nextWorkers });
};

export const deleteWorker = (workerId: string): AppData => {
  const data = loadAppData();

  const nextWorkers = data.workers.filter((w) => w.id !== workerId);
  const nextEntries = data.entries.filter((e) => e.workerId !== workerId);
  const nextLocks = data.monthLocks.filter((m) => m.workerId !== workerId);
  const nextSalary = data.salaryConfigs.filter((s) => s.workerId !== workerId);
  const nextDeductions = data.deductions.filter((d) => d.workerId !== workerId);

  return saveAppData({
    ...data,
    workers: nextWorkers,
    entries: nextEntries,
    monthLocks: nextLocks,
    salaryConfigs: nextSalary,
    deductions: nextDeductions,
  });
};

// -------------------------
// Month lock
// -------------------------
export const upsertMonthLock = (lock: MonthLock): AppData => {
  const data = loadAppData();

  const idx = data.monthLocks.findIndex(
    (m) => m.workerId === lock.workerId && m.monthKey === lock.monthKey
  );

  const nextLocks =
    idx >= 0
      ? data.monthLocks.map((m, i) => (i === idx ? lock : m))
      : [lock, ...data.monthLocks];

  return saveAppData({ ...data, monthLocks: nextLocks });
};

// -------------------------
// Entries
// -------------------------
export const upsertEntry = (entry: ShiftEntry): AppData => {
  const data = loadAppData();
  const idx = data.entries.findIndex((e) => e.id === entry.id);

  const nextEntries =
    idx >= 0
      ? data.entries.map((e) => (e.id === entry.id ? entry : e))
      : [entry, ...data.entries];

  return saveAppData({ ...data, entries: nextEntries });
};

// -------------------------
// Salary config
// -------------------------
export const upsertSalaryConfig = (cfg: SalaryConfig): AppData => {
  const data = loadAppData();

  const idx = data.salaryConfigs.findIndex(
    (s) => s.workerId === cfg.workerId && s.monthKey === cfg.monthKey
  );

  const nextSalary =
    idx >= 0
      ? data.salaryConfigs.map((s, i) => (i === idx ? cfg : s))
      : [cfg, ...data.salaryConfigs];

  return saveAppData({ ...data, salaryConfigs: nextSalary });
};

// -------------------------
// Deductions
// -------------------------
export const upsertDeduction = (d: Deduction): AppData => {
  const data = loadAppData();

  const idx = data.deductions.findIndex((x) => x.id === d.id);

  const next =
    idx >= 0
      ? data.deductions.map((x, i) => (i === idx ? d : x))
      : [d, ...data.deductions];

  return saveAppData({ ...data, deductions: next });
};

export const deleteDeduction = (deductionId: string): AppData => {
  const data = loadAppData();
  return saveAppData({
    ...data,
    deductions: data.deductions.filter((d) => d.id !== deductionId),
  });
};

// Utility helpers (optional but handy)
export const getSalaryConfig = (
  workerId: string,
  monthKey: string
): SalaryConfig | null => {
  const data = loadAppData();
  return (
    data.salaryConfigs.find(
      (s) => s.workerId === workerId && s.monthKey === monthKey
    ) ?? null
  );
};

export const getMonthLock = (
  workerId: string,
  monthKey: string
): MonthLock | null => {
  const data = loadAppData();
  return (
    data.monthLocks.find(
      (m) => m.workerId === workerId && m.monthKey === monthKey
    ) ?? null
  );
};

export const getMonthDeductions = (
  workerId: string,
  monthKey: string
): Deduction[] => {
  const data = loadAppData();
  return data.deductions.filter(
    (d) => d.workerId === workerId && d.monthKey === monthKey
  );
};

export const msNow = nowMs;
