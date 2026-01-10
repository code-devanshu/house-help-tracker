export const makeId = (prefix: string = "id"): string => {
  // stable enough for local utility app
  const rand = Math.random().toString(16).slice(2);
  const time = Date.now().toString(16);
  return `${prefix}_${time}_${rand}`;
};
