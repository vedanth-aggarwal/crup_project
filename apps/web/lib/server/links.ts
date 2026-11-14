import "server-only";

export type ResolvedLink = { url: string; title: string | null; desc: string | null };

const URL_RE = /\b((?:https?:\/\/)?(?:[a-z0-9-]+\.)+(?:com|org|net|edu|io|ee|ly|gl|co|me|app|link|bio|gg|page|site|events?|to)(?:\/[^\s)\]}>"'，。]*)?)/gi;

/** Pull links out of a caption (handles bare "linktr.ee/club" style links). */
export function extractLinks(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(URL_RE)) {
    let u = m[1]!.replace(/[.,!?;:]+$/, "");
    if (/^[^/]*@/.test(u)) continue; // emails
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
    try {
      const parsed = new URL(u);
      if (/(^|\.)instagram\.com$/i.test(parsed.hostname)) continue;
      found.add(parsed.toString());
    } catch {
      /* not a URL */
    }
  }
  return [...found].slice(0, 6);
}

/** Basic SSRF guard: only public hostnames over http(s). */
function isPublicUrl(u: URL) {
  if (!/^https?:$/.test(u.protocol)) return false;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return false;
  if (/^(\d+\.){3}\d+$/.test(h)) return false; // raw IPs
  if (h.includes(":") || h.startsWith("[")) return false; // IPv6 literals
  return h.includes(".");
}

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

function meta(html: string, name: string) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`, "i");
  const m = html.match(re);
  return m ? decode(m[1] ?? m[2] ?? "") : null;
}

/** Follow redirects (bit.ly, Linktree…) and read the page title/description. */
export async function resolveLink(raw: string): Promise<ResolvedLink | null> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!isPublicUrl(url)) return null;
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
      headers: { "user-agent": "Mozilla/5.0 (compatible; CluboBot/1.0)", accept: "text/html" },
    });
    const finalUrl = new URL(res.url || url.toString());
    if (!isPublicUrl(finalUrl)) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.includes("html")) return { url: finalUrl.toString(), title: null, desc: null };
    const html = (await res.text()).slice(0, 300_000);
    const title = meta(html, "og:title") ?? (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ? decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)![1]!) : null);
    const desc = meta(html, "og:description") ?? meta(html, "description");
    // Linktree-style pages: include the visible link labels so "link in bio" resolves.
    const labels = /linktr\.ee|beacons\.ai|lnk\.bio|campsite\.bio/.test(finalUrl.hostname)
      ? [...html.matchAll(/<a[^>]+href=["'](https?:[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
          .map((m) => `${decode(m[2]!.replace(/<[^>]+>/g, ""))} → ${m[1]}`)
          .filter((s) => s.length > 4 && s.length < 200)
          .slice(0, 15)
          .join("\n")
      : "";
    return {
      url: finalUrl.toString(),
      title: title?.slice(0, 200) ?? null,
      desc: [desc?.slice(0, 400), labels].filter(Boolean).join("\n") || null,
    };
  } catch {
    return { url: url.toString(), title: null, desc: null };
  }
}

export async function resolveLinks(urls: string[]) {
  const out = await Promise.all(urls.map(resolveLink));
  return out.filter((x): x is ResolvedLink => !!x);
}
