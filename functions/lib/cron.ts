// Minimal 5-field cron matcher ("minute hour day month weekday"), evaluated
// against a given UTC Date. Supports *, comma lists, ranges (a-b), and step
// values (*/n) — enough for the common schedules this app needs, without
// pulling in a cron-parsing dependency.
function matchesField(field: string, value: number, max: number): boolean {
  return field.split(",").some((part) => {
    if (part === "*") return true;
    const [range, stepStr] = part.split("/");
    const step = stepStr ? parseInt(stepStr, 10) : 1;
    let lo = 0;
    let hi = max;
    if (range !== "*") {
      const [a, b] = range.split("-").map((n) => parseInt(n, 10));
      lo = a;
      hi = b === undefined ? a : b;
    }
    if (value < lo || value > hi) return false;
    return (value - lo) % step === 0;
  });
}

export function cronMatches(cronExpr: string, date: Date): boolean {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [min, hour, dom, month, dow] = parts;
  return (
    matchesField(min, date.getUTCMinutes(), 59) &&
    matchesField(hour, date.getUTCHours(), 23) &&
    matchesField(dom, date.getUTCDate(), 31) &&
    matchesField(month, date.getUTCMonth() + 1, 12) &&
    matchesField(dow, date.getUTCDay(), 6)
  );
}
