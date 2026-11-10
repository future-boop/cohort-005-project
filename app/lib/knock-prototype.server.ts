// PROTOTYPE — throwaway. Talks to the real Knock Development environment for the
// "What does the Notification Feed look like in Cadence?" wayfinder ticket.
// Not production code: no retries, no caching, env loaded ad hoc.
import { createSign } from "node:crypto";

try {
  process.loadEnvFile(".env");
} catch {}

const API = "https://api.knock.app/v1";

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`PROTOTYPE: ${name} missing from .env`);
  return v;
}

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");

// RS256 JWT, the shape Knock expects for enhanced security mode.
export function signUserToken(userId: string) {
  const pem = Buffer.from(env("KNOCK_SIGNING_KEY"), "base64").toString("utf8");
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({ sub: userId, iat: now, exp: now + 3600 })
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  return `${header}.${payload}.${b64url(signer.sign(pem))}`;
}

// Calls made "as the user": public key + signed user token, like the browser would.
function userHeaders(userId: string) {
  return {
    Authorization: `Bearer ${env("KNOCK_PUBLIC_API_KEY")}`,
    "X-Knock-User-Token": signUserToken(userId),
    "Content-Type": "application/json",
  };
}

export type FeedItem = {
  id: string;
  inserted_at: string;
  seen_at: string | null;
  read_at: string | null;
  archived_at: string | null;
  data: {
    kind?: string;
    title?: string;
    body?: string;
    url?: string;
    actor?: string;
  } | null;
};

export type Feed = {
  entries: FeedItem[];
  meta: { unread_count: number; unseen_count: number; total_count: number };
  error?: string;
};

export async function getFeed(userId: number): Promise<Feed> {
  const empty = { entries: [], meta: { unread_count: 0, unseen_count: 0, total_count: 0 } };
  try {
    const res = await fetch(
      `${API}/users/${userId}/feeds/${env("KNOCK_FEED_CHANNEL_ID")}?page_size=30&archived=exclude`,
      { headers: userHeaders(String(userId)) }
    );
    if (!res.ok) return { ...empty, error: `Knock ${res.status}: ${await res.text()}` };
    const json = await res.json();
    return { entries: json.entries, meta: json.meta };
  } catch (e) {
    return { ...empty, error: String(e) };
  }
}

export type Status = "seen" | "read" | "unread" | "archived";

export async function setStatus(userId: number, status: Status, ids: string[]) {
  if (ids.length === 0) return;
  const res = await fetch(`${API}/messages/batch/${status}`, {
    method: "POST",
    headers: userHeaders(String(userId)),
    body: JSON.stringify({ message_ids: ids }),
  });
  if (!res.ok) throw new Error(`Knock ${res.status}: ${await res.text()}`);
}
