export type ShiftStatus = "WORKED" | "ABSENT" | "HALF" | "OFF";

export type Worker = {
  id: string;
  name: string;
  defaultShiftLabel?: string;
  startDate?: string; // YYYY-MM-DD — the date this worker started

  archivedAt?: number;
  personId?: string; // shared ID across multiple workers who are the same physical person

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

  // Optional per-person rate mode: effective salary = perPersonRate × household person count
  perPersonRate?: number; // e.g. 2000 (₹ per person per month)

  updatedAt: number;
};

/**
 * ✅ Household person count change log
 * Tracks when the number of persons in the house changes, per month.
 * Used to calculate per-person salary for workers whose pay depends on household size.
 */
export type PersonCountEntry = {
  id: string;
  monthKey: string; // YYYY-MM
  fromDateISO: string; // YYYY-MM-DD — this count applies from this date onwards
  count: number; // number of persons from this date until next entry or end of month
  createdAt: number;
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
  personCountLog: PersonCountEntry[];
};

export type Draft = {
  name: string;
  defaultShiftLabel: string;
  startDate: string;
};
