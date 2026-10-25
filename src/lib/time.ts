import { env } from "@/lib/env";

const tz = () => env.timezone;
const MINUTE = 60_000;

/** Offset (ms) of the app timezone from UTC at the given instant. */
function tzOffset(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz(),
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** "2026-10-27T10:00" (wall time in app timezone) → Date */
export function fromLocalInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const offset = tzOffset(new Date(guess));
  return new Date(guess - offset);
}

/** "2026-10-27" → last minute of that day in app timezone */
export function endOfLocalDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  const d = fromLocalInput(`${value.trim()}T23:59`);
  return d ? new Date(d.getTime() + 59_000) : null;
}

/** Date → "2026-10-27T10:00" in app timezone, for <input type="datetime-local"> */
export function toLocalInput(date: Date): string {
  const local = new Date(date.getTime() + tzOffset(date));
  return local.toISOString().slice(0, 16);
}

export function toLocalDateInput(date: Date): string {
  return toLocalInput(date).slice(0, 10);
}

function fmt(date: Date, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: tz(), ...opts }).format(date);
}

export const formatTime = (d: Date) => fmt(d, { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
export const formatDate = (d: Date) => fmt(d, { weekday: "short", day: "numeric", month: "short" });
export const formatDateLong = (d: Date) => fmt(d, { weekday: "long", day: "numeric", month: "long" });
export const formatDay = (d: Date) => fmt(d, { day: "numeric" });
export const formatMonth = (d: Date) => fmt(d, { month: "short" });
export const formatWeekday = (d: Date) => fmt(d, { weekday: "long" });
export const formatDateTime = (d: Date) => `${formatDate(d)}, ${formatTime(d)}`;

export function formatRelative(date: Date, now = new Date()): string {
  const diff = date.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const future = diff > 0;
  let label: string;
  if (abs < MINUTE) return future ? "in under a minute" : "just now";
  if (abs < 60 * MINUTE) label = `${Math.round(abs / MINUTE)} min`;
  else if (abs < 24 * 60 * MINUTE) {
    const h = Math.floor(abs / (60 * MINUTE));
    const m = Math.round((abs % (60 * MINUTE)) / MINUTE);
    label = m && h < 6 ? `${h} h ${m} min` : `${h} h`;
  } else label = `${Math.round(abs / (24 * 60 * MINUTE))} days`;
  return future ? `in ${label}` : `${label} ago`;
}

export function greeting(now = new Date()): string {
  const hour = Number(fmt(now, { hour: "numeric", hourCycle: "h23" }));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function timezoneLabel(): string {
  const offset = tzOffset(new Date()) / MINUTE;
  const sign = offset >= 0 ? "+" : "-";
  const h = Math.floor(Math.abs(offset) / 60);
  const m = Math.abs(offset) % 60;
  return `${tz()} (UTC${sign}${h}:${String(m).padStart(2, "0")})`;
}
