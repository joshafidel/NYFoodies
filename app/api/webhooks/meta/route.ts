import { NextRequest, NextResponse } from "next/server";
import { verifyMetaSignature } from "@/lib/crypto";
import { db, dbConfigured } from "@/lib/db";
import { metaWebhookConfigured, webhookDedupeKey } from "@/lib/meta";

export const runtime = "nodejs";

/**
 * Meta webhook verification handshake.
 * Meta calls GET with hub.mode=subscribe, hub.verify_token, hub.challenge.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (!metaWebhookConfigured()) {
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });
  }
  if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  console.warn("[meta-webhook] verification failed", { mode, tokenPresent: Boolean(token) });
  return NextResponse.json({ error: "verification_failed" }, { status: 403 });
}

/** Strip anything token-shaped out of stored payloads (defense in depth). */
function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[/token|secret|password/i.test(k) ? `${k}__redacted` : k] = /token|secret|password/i.test(k)
        ? "[redacted]"
        : redact(v);
    }
    return out;
  }
  return value;
}

/**
 * Webhook receiver: verify signature, store the event fast (DB-backed queue),
 * return 200. Processing happens asynchronously — see lib/webhook-processor.
 * Idempotent via WebhookEvent.dedupeKey.
 */
export async function POST(req: NextRequest) {
  if (!metaWebhookConfigured()) {
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  if (!verifyMetaSignature(rawBody, signature, process.env.META_APP_SECRET!)) {
    console.warn("[meta-webhook] invalid signature", {
      hasSignature: Boolean(signature),
      bodyLength: rawBody.length,
    });
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let body: { object?: string; entry?: Array<Record<string, unknown>> };
  try {
    body = JSON.parse(rawBody);
  } catch {
    // acknowledge malformed-but-authentic payloads so Meta doesn't retry forever
    console.warn("[meta-webhook] unparseable payload");
    return NextResponse.json({ received: true });
  }

  const object = body.object ?? "unknown";
  const entries = Array.isArray(body.entry) ? body.entry : [];

  if (!dbConfigured()) {
    // Signature was valid but there's nowhere durable to store events yet.
    // Acknowledge (Meta would disable the subscription on repeated failures)
    // and log loudly so the operator notices.
    console.error(
      "[meta-webhook] event received but DATABASE_URL is not configured — event dropped",
      { object, entries: entries.length }
    );
    return NextResponse.json({ received: true, stored: false });
  }

  let stored = 0;
  let duplicates = 0;
  for (const entry of entries) {
    const dedupeKey = webhookDedupeKey(object, entry);
    const field =
      (entry as { changes?: Array<{ field?: string }> }).changes?.[0]?.field ??
      ((entry as { messaging?: unknown[] }).messaging ? "messages" : undefined);
    try {
      await db().webhookEvent.create({
        data: {
          dedupeKey,
          object,
          field,
          payload: redact(entry) as object,
        },
      });
      stored++;
    } catch (e) {
      // unique-constraint violation = duplicate delivery — expected, skip
      if ((e as { code?: string }).code === "P2002") {
        duplicates++;
      } else {
        console.error("[meta-webhook] failed to store event", {
          dedupeKey,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  console.log("[meta-webhook] received", { object, entries: entries.length, stored, duplicates });
  return NextResponse.json({ received: true, stored, duplicates });
}
