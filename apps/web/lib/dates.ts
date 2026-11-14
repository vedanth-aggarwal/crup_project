import { CAMPUS_TIMEZONE } from "@clubo/shared";

const TZ = CAMPUS_TIMEZONE;
const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...opts });

const dayKeyFmt = fmt({ year: "numeric", month: "2-digit", day: "2-digit" });
/** "2026-11-14" in Pacific time. */
export const ptDayKey = (d: Date) => {
  const p = Object.fromEntries(dayKeyFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
};

/** Pacific day of week, 0 = Sunday. */
export const ptWeekday = (d: Date) =>
  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(fmt({ weekday: "short" }).format(d));

const dayDiff = (a: Date, b: Date) =>
  Math.round((Date.parse(ptDayKey(a)) - Date.parse(ptDayKey(b))) / 86_400_000);

const timeFmt = fmt({ hour: "numeric", minute: "2-digit" });
const shortTime = (d: Date) => timeFmt.format(d).replace(":00", "").replace(" ", " ");
const dateFmt = fmt({ weekday: "short", month: "short", day: "numeric" });

/** "7–9 PM", "11 AM–1 PM", "7:30 PM". */
export function timeRange(start: Date, end: Date | null) {
  const s = shortTime(start);
  if (!end || end <= start) return s;
  const e = shortTime(end);
  const sm = s.slice(-2), em = e.slice(-2);
  return sm === em ? `${s.slice(0, -3)}–${e}` : `${s}–${e}`;
}

/** "Fri, Nov 14 · 7–9 PM". Dates are always shown as text (a11y, §13.6). */
export function formatWhen(startIso: string | null, endIso: string | null, allDay: boolean) {
  if (!startIso) return "Date TBA";
  const s = new Date(startIso);
  const e = endIso ? new Date(endIso) : null;
  const day = dateFmt.format(s);
  if (allDay) {
    if (e && ptDayKey(e) !== ptDayKey(s)) return `${day} – ${dateFmt.format(e)}`;
    return `${day} · All day`;
  }
  if (e && ptDayKey(e) !== ptDayKey(s)) return `${day}, ${shortTime(s)} – ${dateFmt.format(e)}, ${shortTime(e)}`;
  return `${day} · ${timeRange(s, e)}`;
}

/** "Today", "Tomorrow", "Fri", or "Nov 14". */
export function relativeDay(iso: string, now = new Date()) {
  const d = new Date(iso);
  const diff = dayDiff(d, now);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff < 7) return fmt({ weekday: "long" }).format(d);
  return fmt({ month: "short", day: "numeric" }).format(d);
}

/** Corner badge on cards: { dow: "FRI", day: "14", month: "NOV" }. */
export function dateBadge(iso: string) {
  const d = new Date(iso);
  return {
    dow: fmt({ weekday: "short" }).format(d).toUpperCase(),
    day: fmt({ day: "numeric" }).format(d),
    month: fmt({ month: "short" }).format(d).toUpperCase(),
  };
}

export type TimeGroup = "now" | "today" | "week" | "later";
export const GROUP_LABELS: Record<TimeGroup, string> = {
  now: "Happening now",
  today: "Later today",
  week: "This week",
  later: "Coming up",
};

export function timeGroup(startIso: string, endIso: string | null, now = new Date()): TimeGroup {
  const s = new Date(startIso);
  const e = endIso ? new Date(endIso) : new Date(s.getTime() + 2 * 3600_000);
  if (s <= now && e > now) return "now";
  const diff = dayDiff(s, now);
  if (diff <= 0) return "today";
  if (diff < 7) return "week";
  return "later";
}

export const isLive = (startIso: string | null, endIso: string | null, now = new Date()) =>
  startIso ? timeGroup(startIso, endIso, now) === "now" : false;

/** Deadline urgency: "Closes in 18h", "Closes in 3 days", "Closed". */
export function countdown(iso: string, now = new Date()) {
  const ms = new Date(iso).getTime() - now.getTime();
  if (ms <= 0) return { label: "Closed", level: "closed" as const };
  const h = Math.floor(ms / 3600_000);
  if (h < 1) return { label: `Closes in ${Math.max(1, Math.round(ms / 60_000))}m`, level: "today" as const };
  if (h < 24) return { label: `Closes in ${h}h`, level: "today" as const };
  const days = Math.round(h / 24);
  return { label: `Closes in ${days} day${days === 1 ? "" : "s"}`, level: days <= 3 ? ("soon" as const) : ("later" as const) };
}

export const fullDate = (iso: string) => fmt({ weekday: "long", month: "long", day: "numeric" }).format(new Date(iso));
export const longDateTime = (iso: string) =>
  fmt({ weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

/** Start of the Pacific day containing `d` as an absolute Date. */
export function startOfPtDay(d: Date) {
  const key = ptDayKey(d);
  // Try both PST/PDT offsets and keep the one that lands on the same PT day at 00:00.
  for (const off of ["-08:00", "-07:00"]) {
    const c = new Date(`${key}T00:00:00${off}`);
    if (ptDayKey(c) === key && shortTime(c) === "12 AM") return c;
  }
  return new Date(`${key}T00:00:00-08:00`);
}

/** ISO → "YYYY-MM-DDTHH:mm" in Pacific time, for <input type="datetime-local">. */
export function isoToPtLocal(iso: string | null) {
  if (!iso) return "";
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
}

/** "YYYY-MM-DDTHH:mm" interpreted as Pacific time → ISO. */
export function ptLocalToIso(local: string) {
  if (!local) return null;
  for (const off of ["-07:00", "-08:00"]) {
    const d = new Date(`${local}:00${off}`);
    if (!Number.isNaN(d.getTime()) && isoToPtLocal(d.toISOString()) === local) return d.toISOString();
  }
  return null;
}
