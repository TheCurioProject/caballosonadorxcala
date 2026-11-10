export type DateInterval = { startDate: Date; endDate: Date };

// Both endpoints represent inclusive instants, as stored by manual calendar blocks.
export function subtractInterval(original: DateInterval, removal: DateInterval): DateInterval[] {
  if (removal.endDate < original.startDate || removal.startDate > original.endDate) return [original];
  const remaining: DateInterval[] = [];
  if (original.startDate < removal.startDate) remaining.push({ startDate: original.startDate, endDate: new Date(removal.startDate.getTime() - 1) });
  if (original.endDate > removal.endDate) remaining.push({ startDate: new Date(removal.endDate.getTime() + 1), endDate: original.endDate });
  return remaining;
}

export function calendarDayInterval(date: Date): DateInterval {
  // Dates selected in the browser carry its local day; use local parts at the call site.
  const startDate = new Date(date);
  startDate.setUTCHours(0, 0, 0, 0);
  return { startDate, endDate: new Date(startDate.getTime() + 86400000 - 1) };
}

// Database booking dates represent calendar days in UTC. Render that day in the
// visitor's calendar without shifting it backwards in American time zones.
export function calendarDateToLocal(value: Date | string) {
  const date = new Date(value);
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
