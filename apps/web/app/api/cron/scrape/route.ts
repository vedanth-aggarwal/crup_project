import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/server/cron";
import { scheduleScrapes } from "@/lib/server/scrape";

export const maxDuration = 60;

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await scheduleScrapes({ trigger: "cron" });
  return NextResponse.json(result);
}
