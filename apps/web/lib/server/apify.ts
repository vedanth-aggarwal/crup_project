import "server-only";
import { requireEnv, env } from "./env";

const API = "https://api.apify.com/v2";
const actorPath = () => requireEnv("APIFY_ACTOR_ID").replace("/", "~");
const auth = () => ({ Authorization: `Bearer ${requireEnv("APIFY_API_TOKEN")}` });

/** Fields we use from apify/instagram-post-scraper output items. */
export type ApifyPost = {
  id?: string;
  shortCode?: string;
  url?: string;
  inputUrl?: string;
  caption?: string | null;
  timestamp?: string;
  type?: string; // "Image" | "Sidecar" | "Video"
  displayUrl?: string;
  images?: string[];
  childPosts?: { displayUrl?: string; type?: string }[];
  videoUrl?: string;
  ownerUsername?: string;
  ownerFullName?: string;
  isPinned?: boolean;
  alt?: string | null;
  // error items (shape undocumented; handled defensively)
  error?: string;
  errorDescription?: string;
};

/** Cost of one scraped result (USD), for the admin estimate. */
export const APIFY_COST_PER_RESULT = 0.0027;

/**
 * Start one scraper run for a batch of handles. Apify calls our webhook when
 * the run finishes; the secret header proves the call came from our run.
 */
export async function startScrape(opts: { handles: string[]; newerThan: string; resultsLimit: number; runDocId: string }) {
  const webhook = [
    {
      eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED", "ACTOR.RUN.TIMED_OUT", "ACTOR.RUN.ABORTED"],
      requestUrl: `${env.appUrl}/api/webhooks/apify?run=${encodeURIComponent(opts.runDocId)}`,
      headersTemplate: JSON.stringify({ "x-clubo-secret": requireEnv("APIFY_WEBHOOK_SECRET") }),
    },
  ];
  const qs = new URLSearchParams({ webhooks: Buffer.from(JSON.stringify(webhook)).toString("base64") });
  const res = await fetch(`${API}/acts/${actorPath()}/runs?${qs}`, {
    method: "POST",
    headers: { ...auth(), "content-type": "application/json" },
    body: JSON.stringify({
      username: opts.handles,
      resultsLimit: opts.resultsLimit,
      onlyPostsNewerThan: opts.newerThan,
      skipPinnedPosts: true,
      dataDetailLevel: "basicData",
    }),
  });
  if (!res.ok) throw new Error(`Apify run failed to start: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { data: { id: string; defaultDatasetId: string; status: string } };
  return body.data;
}

export async function getRun(runId: string) {
  const res = await fetch(`${API}/actor-runs/${runId}`, { headers: auth() });
  if (!res.ok) throw new Error(`Apify getRun ${res.status}`);
  return ((await res.json()) as { data: { id: string; status: string; defaultDatasetId: string } }).data;
}

export async function getDatasetItems(datasetId: string): Promise<ApifyPost[]> {
  const res = await fetch(`${API}/datasets/${datasetId}/items?clean=true&format=json`, { headers: auth() });
  if (!res.ok) throw new Error(`Apify dataset ${res.status}`);
  return (await res.json()) as ApifyPost[];
}
