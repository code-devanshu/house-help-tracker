export const makeId = (prefix: string = "id"): string => {
  // stable enough for local utility app
  const rand = Math.random().toString(16).slice(2);
  const time = Date.now().toString(16);
  return `${prefix}_${time}_${rand}`;
};

export const timeAgo = (ts: number) => {
  const diff = Date.now() - ts;
  const sec = Math.max(1, Math.floor(diff / 1000));
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (day > 0) return `${day}d ago`;
  if (hr > 0) return `${hr}h ago`;
  if (min > 0) return `${min}m ago`;
  return "just now";
};
