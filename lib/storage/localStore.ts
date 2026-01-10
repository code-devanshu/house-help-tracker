import type {
  AppData,
  MonthLock,
  SalaryConfig,
  ShiftEntry,
  Worker,
} from "@/lib/storage/schema";

const STORAGE_KEY = "house_help_tracker_appdata";
const CURRENT_VERSION = 2;

const nowMs = (): number => Date.now();

let onDataChanged: ((data: AppData) => void) | null = null;

export const setOnDataChanged = (cb: ((data: AppData) => void) | null) => {
  onDataChanged = cb;
};

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
});

const normalizeData = (input: unknown): AppData => {
  const base = emptyData();

  if (!input || typeof input !== "object") return base;

  const obj = input as Partial<AppData>;

  return {
    version: CURRENT_VERSION,
    workers: Array.isArray(obj.workers) ? (obj.workers as Worker[]) : [],
    entries: Array.isArray(obj.entries) ? (obj.entries as ShiftEntry[]) : [],
    monthLocks: Array.isArray(obj.monthLocks)
      ? (obj.monthLocks as MonthLock[])
      : [],
    salaryConfigs: Array.isArray(obj.salaryConfigs)
      ? (obj.salaryConfigs as SalaryConfig[])
      : [],
  };
};

const writeData = (data: AppData): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const loadAppData = (): AppData => {
  if (typeof window === "undefined") return emptyData();

  const raw = window.localStorage.getItem(STORAGE_KEY);
  const parsed = safeParseJSON(raw);
  const normalized = normalizeData(parsed);

  // persist normalized/migrated shape
  writeData(normalized);
  return normalized;
};

export const saveAppData = (data: AppData): AppData => {
  const normalized = normalizeData(data);
  writeData(normalized);
  onDataChanged?.(normalized);
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

  return saveAppData({
    ...data,
    workers: nextWorkers,
    entries: nextEntries,
    monthLocks: nextLocks,
    salaryConfigs: nextSalary,
  });
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

export const msNow = nowMs;
