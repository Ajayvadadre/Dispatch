import type { Article, Recurrence } from "@/lib/db/schema";
import { formatDate, formatDateTime, formatTime, formatWeekday } from "@/lib/time";

const DAY = 24 * 60 * 60 * 1000;

type Pattern = Pick<Article, "recurrence" | "startAt" | "endAt">;

/** The occurrence after `from`, or null once the schedule is exhausted. */
export function nextOccurrence(a: Pattern, from: Date): Date | null {
  if (a.recurrence === "once") return null;
  const step = a.recurrence === "daily" ? DAY : 7 * DAY;
  const next = new Date(from.getTime() + step);
  if (a.endAt && next > a.endAt) return null;
  return next;
}

/**
 * First occurrence of the pattern at or after `now` (used on create, edit and resume),
 * skipping anything at or before `after` — the last occurrence that already went out.
 */
export function firstOccurrenceFrom(a: Pattern, now: Date, after: Date | null = null): Date | null {
  let at: Date | null = a.startAt;
  // Small tolerance so a time a few seconds in the past (form submit lag) still counts.
  const floor = Math.max(now.getTime() - 60_000, after ? after.getTime() + 1 : 0);
  while (at && at.getTime() < floor) at = nextOccurrence(a, at);
  return at;
}

export function describeSchedule(a: Pattern): string {
  const time = formatTime(a.startAt);
  const until = a.endAt ? ` · until ${formatDate(a.endAt)}` : "";
  switch (a.recurrence) {
    case "once":
      return `Once · ${formatDateTime(a.startAt)}`;
    case "daily":
      return `Daily at ${time}${until}`;
    case "weekly":
      return `Every ${formatWeekday(a.startAt)} at ${time}${until}`;
  }
}

export const recurrenceLabel: Record<Recurrence, string> = {
  once: "One time",
  daily: "Daily",
  weekly: "Weekly",
};
