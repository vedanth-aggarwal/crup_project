import { adminDb } from "@/lib/server/firebase-admin";
import { verifyUnsubscribe } from "@/lib/server/unsubscribe";
import { env } from "@/lib/server/env";

async function apply(url: URL) {
  const uid = url.searchParams.get("u") ?? "";
  const type = url.searchParams.get("t") ?? "";
  const sig = url.searchParams.get("s") ?? "";
  if (!uid || !verifyUnsubscribe(uid, type, sig)) return false;
  const ref = adminDb().collection("users").doc(uid);
  if (type === "all") {
    await ref.update({
      "notificationPrefs.reminders": false,
      "notificationPrefs.deadlines": false,
      "notificationPrefs.newFromFollowed": false,
      "notificationPrefs.weeklyDigest": false,
    });
  } else {
    await ref.update({ [`notificationPrefs.${type}`]: false });
  }
  return true;
}

/** One-click unsubscribe from mail clients (RFC 8058). */
export async function POST(req: Request) {
  const ok = await apply(new URL(req.url));
  return new Response(ok ? "Unsubscribed" : "Invalid link", { status: ok ? 200 : 400 });
}

/** Link clicked in the email footer: unsubscribe, then show a confirmation page. */
export async function GET(req: Request) {
  const ok = await apply(new URL(req.url));
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Clubo emails</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;background:#faf8f3;color:#14213d;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}main{max-width:420px;text-align:center}h1{font-family:Georgia,serif;font-weight:400;font-size:34px;margin:0 0 8px}p{color:#5b6478}a{color:#0b2545;font-weight:600}</style></head>
<body><main>${
    ok
      ? `<h1>You're unsubscribed</h1><p>We won't send those emails anymore. You can turn them back on any time in <a href="${env.appUrl}/settings">Settings</a>.</p>`
      : `<h1>That link didn't work</h1><p>Manage your emails in <a href="${env.appUrl}/settings">Settings</a> instead.</p>`
  }</main></body></html>`;
  return new Response(html, { status: ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8" } });
}
