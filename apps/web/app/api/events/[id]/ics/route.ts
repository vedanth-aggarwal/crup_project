import { getEvent } from "@/lib/server/data";
import { icsFile } from "@/lib/calendar";
import { env } from "@/lib/server/env";

export async function GET(_req: Request, ctx: RouteContext<"/api/events/[id]/ics">) {
  const { id } = await ctx.params;
  const e = await getEvent(id);
  if (!e || e.status !== "published") return new Response("Not found", { status: 404 });
  const body = icsFile(e, `${env.appUrl}/events/${e.id}`);
  if (!body) return new Response("This event has no date yet", { status: 422 });
  const name = e.title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "event";
  return new Response(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${name}.ics"`,
    },
  });
}
