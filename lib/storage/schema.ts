export type ShiftStatus = "WORKED" | "ABSENT" | "HALF" | "OFF";

export type Worker = {
  id: string;
  name: string;
  defaultShiftLabel?: string;

  createdAt: number;
  updatedAt: number;
};

export type ShiftEntry = {
  id: string;
  workerId: string;
  dateISO: string; // YYYY-MM-DD
  status: ShiftStatus;

  hours?: number;
  note?: string;

  createdAt: number;
  updatedAt: number;
};

export type MonthLock = {
  id: string;
  workerId: string;
  monthKey: string; // YYYY-MM
  locked: boolean;

  lockedAt?: number;
  lockedBy?: string; // later: userId/email
};

/**
 * ✅ Month salary config per worker
 * Monthly salary is split across actual month days.
 * OFF is paid only up to `paidOffAllowance` days.
 */
export type SalaryConfig = {
  id: string;
  workerId: string;
  monthKey: string; // YYYY-MM

  monthlySalary: number; // e.g. 12000
  paidOffAllowance: number; // e.g. 4 (paid OFF days allowed in this month)

  updatedAt: number;
};

/**
 * ✅ Deduction: money taken/advance to be deducted from payable
 * Stored per worker per month, with a date reference.
 */
export type Deduction = {
  id: string;
  workerId: string;
  monthKey: string; // YYYY-MM
  dateISO: string; // YYYY-MM-DD (any date inside that month usually)
  amount: number; // positive number (we deduct it)
  note?: string;

  createdAt: number;
  updatedAt: number;
};

export type AppData = {
  version: number;
  workers: Worker[];
  entries: ShiftEntry[];

  monthLocks: MonthLock[];
  salaryConfigs: SalaryConfig[];

  deductions: Deduction[];
};

export type Draft = {
  name: string;
  defaultShiftLabel: string;
};
