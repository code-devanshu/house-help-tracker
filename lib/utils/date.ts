export const pad2 = (n: number): string => String(n).padStart(2, "0");

export const toISODate = (d: Date): string => {
  // local timezone date (not UTC)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

export const startOfMonth = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), 1);

export const endOfMonth = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth() + 1, 0);

export const addMonths = (d: Date, delta: number): Date =>
  new Date(d.getFullYear(), d.getMonth() + delta, 1);

export const monthLabel = (d: Date): string => {
  const fmt = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  });
  return fmt.format(d);
};

export const daysInMonth = (d: Date): number => endOfMonth(d).getDate();

export const getMonthDays = (month: Date): Date[] => {
  const total = daysInMonth(month);
  const arr: Date[] = [];
  for (let day = 1; day <= total; day += 1) {
    arr.push(new Date(month.getFullYear(), month.getMonth(), day));
  }
  return arr;
};

export const getWeekdayIndexMon0 = (d: Date): number => {
  // Make Monday=0 ... Sunday=6
  const js = d.getDay(); // Sunday=0 ... Saturday=6
  return (js + 6) % 7;
};

export const weekdayShort = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
