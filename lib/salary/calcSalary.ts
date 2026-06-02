import type { Deduction, PersonCountEntry, ShiftEntry } from "@/lib/storage/schema";

export type SalaryBreakdown = {
  worked: number;
  half: number;
  absent: number;
  off: number;
};

export type PersonSegment = {
  fromDateISO: string;
  toDateISO: string;
  count: number;
  worked: number;
  half: number;
  absent: number;
  off: number;
  daysInSegment: number;
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

function prevDayISO(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function daysBetweenISO(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = to.split("-").map(Number) as [number, number, number];
  const fromDate = new Date(fy, fm - 1, fd);
  const toDate = new Date(ty, tm - 1, td);
  return Math.round((toDate.getTime() - fromDate.getTime()) / 86400000);
}

/**
 * Build person-count segments for a month from a list of PersonCountEntry and ShiftEntry.
 * Each segment has the worked/half/absent/off counts for the days in that range.
 */
export function buildPersonSegments(
  monthKey: string,
  personCountEntries: PersonCountEntry[],
  shiftEntries: ShiftEntry[]
): PersonSegment[] {
  if (personCountEntries.length === 0) return [];

  const totalDays = daysInMonthFromKey(monthKey);
  const monthStartISO = `${monthKey}-01`;
  const monthEndISO = `${monthKey}-${String(totalDays).padStart(2, "0")}`;

  // Keep only entries for this month or entries whose fromDate is before the month start
  // (carrying over from previous), sort ascending by date
  const sorted = [...personCountEntries]
    .filter((e) => e.monthKey === monthKey)
    .sort((a, b) => a.fromDateISO.localeCompare(b.fromDateISO));

  if (sorted.length === 0) return [];

  const segments: PersonSegment[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i]!;
    const fromDateISO = entry.fromDateISO < monthStartISO ? monthStartISO : entry.fromDateISO;
    const toDateISO =
      i + 1 < sorted.length ? prevDayISO(sorted[i + 1]!.fromDateISO) : monthEndISO;

    if (fromDateISO > monthEndISO || toDateISO < monthStartISO || toDateISO < fromDateISO)
      continue;

    let worked = 0, half = 0, absent = 0, off = 0;
    for (const e of shiftEntries) {
      if (e.dateISO >= fromDateISO && e.dateISO <= toDateISO) {
        if (e.status === "WORKED") worked++;
        else if (e.status === "HALF") half++;
        else if (e.status === "ABSENT") absent++;
        else if (e.status === "OFF") off++;
      }
    }

    const daysInSegment = daysBetweenISO(fromDateISO, toDateISO) + 1;
    segments.push({ fromDateISO, toDateISO, count: entry.count, worked, half, absent, off, daysInSegment });
  }

  return segments;
}

export function calculateSalary(params: {
  monthKey: string;
  totals: SalaryBreakdown;
  savedMonthlySalary: number;
  savedPaidOffAllowance: number;
  deductions: Deduction[];
  perPersonRate?: number;
  personSegments?: PersonSegment[];
}): SalaryResult {
  const {
    monthKey,
    totals,
    savedMonthlySalary,
    savedPaidOffAllowance,
    deductions,
    perPersonRate,
    personSegments,
  } = params;

  const daysInMonth = daysInMonthFromKey(monthKey);
  const paidOffAllowance = clampInt(savedPaidOffAllowance ?? 0, 0, 366);

  let perDay: number;
  let halfDay: number;
  let workedAmt: number;
  let halfAmt: number;
  let offAmt: number;
  let grossPayable: number;
  let paidOffCount: number;
  let unpaidOffCount: number;

  if (perPersonRate && perPersonRate > 0 && personSegments && personSegments.length > 0) {
    // Per-person rate mode: compute per segment for accuracy
    let segWorkedAmt = 0;
    let segHalfAmt = 0;
    let segOffAmt = 0;
    let remainingAllowance = paidOffAllowance;
    let weightedRateSum = 0;

    for (const seg of personSegments) {
      const segDailyRate = perPersonRate * seg.count / daysInMonth;
      segWorkedAmt += seg.worked * segDailyRate;
      segHalfAmt += seg.half * (segDailyRate / 2);
      weightedRateSum += segDailyRate * seg.daysInSegment;

      // Distribute off allowance greedily across segments (earliest first)
      const segShortfall = seg.absent + seg.half * 0.5 + seg.off;
      const segCovered = Math.min(segShortfall, remainingAllowance);
      remainingAllowance = Math.max(0, remainingAllowance - segCovered);
      segOffAmt += segCovered * segDailyRate;
    }

    // Blended average daily rate for display purposes
    perDay = daysInMonth > 0 ? weightedRateSum / daysInMonth : 0;
    halfDay = perDay / 2;
    workedAmt = segWorkedAmt;
    halfAmt = segHalfAmt;
    offAmt = segOffAmt;
    grossPayable = workedAmt + halfAmt + offAmt;

    const totalShortfall = totals.absent + totals.half * 0.5 + totals.off;
    const coveredByAllowance = Math.min(totalShortfall, paidOffAllowance);
    paidOffCount = coveredByAllowance;
    unpaidOffCount = Math.max(0, totals.off - Math.min(totals.off, paidOffAllowance));
  } else {
    // Fixed monthly salary mode (original logic)
    const monthlySalary = clampInt(savedMonthlySalary ?? 0, 0, 1_000_000_000);
    perDay = daysInMonth > 0 ? monthlySalary / daysInMonth : 0;
    halfDay = perDay / 2;

    const totalShortfall = totals.absent + totals.half * 0.5 + totals.off;
    const coveredByAllowance = Math.min(totalShortfall, paidOffAllowance);
    paidOffCount = coveredByAllowance;
    unpaidOffCount = Math.max(0, totals.off - Math.min(totals.off, paidOffAllowance));

    workedAmt = totals.worked * perDay;
    halfAmt = totals.half * halfDay;
    offAmt = coveredByAllowance * perDay;
    grossPayable = workedAmt + halfAmt + offAmt;
  }

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
