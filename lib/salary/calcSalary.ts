import type { Deduction } from "@/lib/storage/schema";

export type SalaryBreakdown = {
  worked: number;
  half: number;
  absent: number;
  off: number;
};

export type SalaryResult = {
  perDay: number;
  halfDay: number;

  paidOffCount: number;
  unpaidOffCount: number;

  workedAmt: number;
  halfAmt: number;
  offAmt: number;

  grossPayable: number;
  deductionsTotal: number;
  netPayable: number;
};

const clampInt = (n: number, min: number, max: number) => {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
};

// monthKey: "YYYY-MM"
export const daysInMonthFromKey = (monthKey: string): number => {
  const [yRaw, mRaw] = monthKey.split("-");
  const y = Number(yRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return 30;
  return new Date(y, m, 0).getDate();
};

export function calculateSalary(params: {
  monthKey: string;
  totals: SalaryBreakdown;
  savedMonthlySalary: number;
  savedPaidOffAllowance: number;
  deductions: Deduction[];
}): SalaryResult {
  const {
    monthKey,
    totals,
    savedMonthlySalary,
    savedPaidOffAllowance,
    deductions,
  } = params;

  const daysInMonth = daysInMonthFromKey(monthKey);

  const monthlySalary = clampInt(savedMonthlySalary ?? 0, 0, 1_000_000_000);
  const paidOffAllowance = clampInt(savedPaidOffAllowance ?? 0, 0, 366);

  const perDay = daysInMonth > 0 ? monthlySalary / daysInMonth : 0;
  const halfDay = perDay / 2;

  const paidOffCount = Math.min(totals.off, paidOffAllowance);
  const unpaidOffCount = Math.max(0, totals.off - paidOffAllowance);

  const workedAmt = totals.worked * perDay;
  const halfAmt = totals.half * halfDay;
  const offAmt = paidOffCount * perDay;

  const grossPayable = workedAmt + halfAmt + offAmt;

  let deductionsTotal = 0;
  for (const d of deductions) {
    const amt = Number(d.amount);
    if (Number.isFinite(amt) && amt > 0) deductionsTotal += amt;
  }

  const netPayable = Math.max(0, grossPayable - deductionsTotal);

  return {
    perDay,
    halfDay,
    paidOffCount,
    unpaidOffCount,
    workedAmt,
    halfAmt,
    offAmt,
    grossPayable,
    deductionsTotal,
    netPayable,
  };
}
