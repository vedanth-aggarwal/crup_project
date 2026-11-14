import type { EventView } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");
const utcStamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
const dateStamp = (iso: string) => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date(iso));
  return p.replaceAll("-", "");
};

function span(e: EventView) {
  const startIso = e.kind === "deadline" ? e.deadlineAt : e.startAt;
  if (!startIso) return null;
  const start = new Date(startIso);
  const end = e.endAt ? new Date(e.endAt) : new Date(start.getTime() + (e.kind === "deadline" ? 30 : 90) * 60_000);
  return { start, end, startIso };
}

function locationText(e: EventView) {
  return [e.location?.name, e.location?.address].filter(Boolean).join(", ") || (e.location?.isOnline ? "Online" : "");
}

export function googleCalendarUrl(e: EventView, eventUrl: string) {
  const s = span(e);
  if (!s) return null;
  const dates = e.allDay
    ? `${dateStamp(s.startIso)}/${dateStamp(new Date(s.start.getTime() + 86_400_000).toISOString())}`
    : `${utcStamp(s.start)}/${utcStamp(s.end)}`;
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: e.kind === "deadline" ? `Deadline: ${e.title}` : e.title,
    dates,
    details: `${e.summary}\n\nHosted by ${e.clubName}\n${eventUrl}`,
    location: locationText(e),
    ctz: "America/Los_Angeles",
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
/** RFC 5545 line folding at 75 octets. */
const fold = (line: string) => line.match(/.{1,74}/g)?.join("\r\n ") ?? line;

export function icsFile(e: EventView, eventUrl: string) {
  const s = span(e);
  if (!s) return null;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Clubo//Berkeley Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.id}@clubo`,
    `DTSTAMP:${utcStamp(new Date())}`,
    e.allDay ? `DTSTART;VALUE=DATE:${dateStamp(s.startIso)}` : `DTSTART:${utcStamp(s.start)}`,
    e.allDay ? `DTEND;VALUE=DATE:${dateStamp(new Date(s.start.getTime() + 86_400_000).toISOString())}` : `DTEND:${utcStamp(s.end)}`,
    `SUMMARY:${esc(e.kind === "deadline" ? `Deadline: ${e.title}` : e.title)}`,
    `DESCRIPTION:${esc(`${e.summary}\n\nHosted by ${e.clubName}\n${eventUrl}`)}`,
    `LOCATION:${esc(locationText(e))}`,
    `URL:${eventUrl}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(e.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
