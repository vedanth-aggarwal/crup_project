import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/server/cron";
import { runNotifications } from "@/lib/server/notify";
import { emailConfigured } from "@/lib/server/email";

export const maxDuration = 300;

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!emailConfigured()) return NextResponse.json({ skipped: "SMTP_USER / SMTP_PASS not set" });
  return NextResponse.json(await runNotifications());
}
