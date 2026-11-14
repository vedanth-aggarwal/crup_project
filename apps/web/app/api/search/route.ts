import { NextResponse } from "next/server";
import { listClubs, listUpcomingEvents } from "@/lib/server/data";
import { matchesText } from "@/lib/filters";

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  const [events, clubs] = await Promise.all([listUpcomingEvents(), listClubs()]);
  const ev = (q ? events.filter((e) => matchesText(e, q)) : events).slice(0, 6);
  const lq = q.toLowerCase();
  const cl = q ? clubs.filter((c) => c.name.toLowerCase().includes(lq) || c.igHandle.includes(lq)).slice(0, 5) : [];
  return NextResponse.json({
    events: ev.map(({ id, title, clubName, startAt, endAt, allDay }) => ({ id, title, clubName, startAt, endAt, allDay })),
    clubs: cl.map(({ id, name, igHandle }) => ({ id, name, igHandle })),
  });
}
