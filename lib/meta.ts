/** Meta Graph API helpers — version is configurable, never hardcoded per-callsite. */

export function graphApiVersion(): string {
  return process.env.META_GRAPH_API_VERSION || "v23.0";
}

export function graphUrl(path: string): string {
  return `https://graph.instagram.com/${graphApiVersion()}/${path.replace(/^\//, "")}`;
}

export function metaWebhookConfigured(): boolean {
  return Boolean(process.env.META_WEBHOOK_VERIFY_TOKEN && process.env.META_APP_SECRET);
}

/**
 * Build a stable dedupe key for a webhook delivery so retries and duplicate
 * deliveries are idempotent. Prefers real message ids; falls back to a hash
 * of the entry payload.
 */
export function webhookDedupeKey(object: string, entry: Record<string, unknown>): string {
  const messaging = (entry as { messaging?: Array<Record<string, unknown>> }).messaging;
  const first = messaging?.[0] as
    | {
        message?: { mid?: string };
        read?: { mid?: string };
        reaction?: { mid?: string };
        timestamp?: number;
        sender?: { id?: string };
      }
    | undefined;
  const mid = first?.message?.mid ?? first?.read?.mid ?? first?.reaction?.mid;
  if (mid) {
    const kind = first?.message ? "msg" : first?.read ? "read" : "reaction";
    return `${object}:${kind}:${mid}`;
  }
  // stable fallback: hash of the serialized entry
  const s = JSON.stringify(entry);
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return `${object}:hash:${(entry as { id?: string }).id ?? "?"}:${(entry as { time?: number }).time ?? "?"}:${h}`;
}
