import OpenAI from "openai";

/**
 * Perplexity Router API client — unified access to open-weight models
 * through the OpenAI Chat Completions schema.
 *
 * Base URL per https://docs.perplexity.ai/docs/router/quickstart:
 *   https://api.perplexity.ai/router/v1
 * Model ids are `creator/model-name` slugs; GET /router/v1/models is both
 * the catalog and the allowlist for the key in use (400 = unknown slug,
 * 402 = model excluded for the org's usage tier). Note the Router API is
 * in private preview — access is requested via api@perplexity.ai.
 *
 * The app works fully without this; AI features report "not configured"
 * until PERPLEXITY_API_KEY is set (create one at https://console.perplexity.ai).
 */

export const ROUTER_BASE_URL = "https://api.perplexity.ai/router/v1";

/** Cheap, fast catalog model — fine for classification. Override via env. */
const DEFAULT_MODEL = "perplexity/deepseek-v4-flash-0731";

export function llmConfigured(): boolean {
  return Boolean(process.env.PERPLEXITY_API_KEY);
}

export function routerModel(): string {
  return process.env.PERPLEXITY_ROUTER_MODEL || DEFAULT_MODEL;
}

let cached: OpenAI | null = null;

export function routerClient(): OpenAI {
  if (!llmConfigured()) {
    throw new Error(
      "PERPLEXITY_API_KEY is not set — create a key at https://console.perplexity.ai and export it"
    );
  }
  if (!cached) {
    cached = new OpenAI({
      apiKey: process.env.PERPLEXITY_API_KEY,
      baseURL: ROUTER_BASE_URL,
      maxRetries: 0, // we handle 429/Retry-After ourselves below
    });
  }
  return cached;
}

/** The key's live model catalog (also its allowlist). */
export async function listRouterModels(): Promise<string[]> {
  const res = await routerClient().models.list();
  return res.data.map((m) => m.id).sort();
}

/**
 * Pull the first JSON object out of a model reply, tolerating code fences
 * and surrounding prose. Returns null when nothing parseable is found.
 */
export function extractJson<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [fenced?.[1], text, text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)];
  for (const c of candidates) {
    if (!c) continue;
    try {
      return JSON.parse(c.trim()) as T;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

export type ReplyVerdict = "accepted" | "declined" | "negotiating" | "question" | "other";

export interface ReplyAnalysis {
  verdict: ReplyVerdict;
  offeredTimes: string[];
  summary: string;
}

/**
 * Zero-setup fallback classifier — keyword rules, no API key, no network.
 * Used whenever the Router API isn't configured or errors, so the
 * "Analyze reply" feature always works.
 */
export function heuristicClassify(replyText: string): ReplyAnalysis {
  const t = replyText.toLowerCase();

  // "Tuesday", "tues 7:30pm", "7pm", "sat around 6"
  const timeRe =
    /\b(?:mon|tues?|wed(?:nes)?|thur?s?|fri|satur?|sun)(?:day)?s?\b(?:[^.,;!?\n]{0,25}?\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?|\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi;
  const offeredTimes = [...new Set((replyText.match(timeRe) ?? []).map((s) => s.trim()))]
    .filter((s) => s.length > 2)
    .slice(0, 5);

  const declined =
    /(not interested|no thanks?|unfortunately|can'?t (?:do|host|accommodate)|pass on this|not (?:a good|the right) fit|we'?ll pass|don'?t do collab|no longer|decline)/;
  const accepted =
    /(sounds (?:good|great|fun|perfect|awesome)|let'?s do it|would love to host|we'?d love|come (?:by|in|on in|through)|works for us|see you (?:then|there)|you'?re welcome to|absolutely|for sure|happy to host|yes,? (?:that|we|let))/;
  const negotiating =
    /(instead|how about|could (?:we|you) do|would.*work\?|prefer|only if|depends|what if|another (?:day|time)|reschedule)/;
  const question =
    /(how many follower|what (?:do you|would you|are your)|which|rates?|price|cost|what'?s your|can you (?:send|share)|more (?:info|details))/;

  let verdict: ReplyVerdict;
  if (declined.test(t)) verdict = "declined";
  else if (accepted.test(t)) verdict = "accepted";
  else if (negotiating.test(t) || (offeredTimes.length > 0 && /\?/.test(t))) verdict = "negotiating";
  else if (question.test(t) || /\?/.test(t)) verdict = "question";
  else if (offeredTimes.length > 0) verdict = "accepted";
  else verdict = "other";

  return { verdict, offeredTimes, summary: "" };
}

/** Which pipeline stage a verdict suggests. Any reply is at least Responded. */
export function stageForVerdict(verdict: ReplyVerdict): "accepted" | "declined" | "responded" {
  if (verdict === "accepted") return "accepted";
  if (verdict === "declined") return "declined";
  return "responded";
}

const CLASSIFY_SYSTEM = `You classify Instagram DM replies that restaurants send to a food influencer's collaboration pitch.
Respond with ONLY a JSON object, no prose, shaped exactly like:
{"verdict":"accepted|declined|negotiating|question|other","offered_times":["Tue 7:30pm"],"summary":"one short sentence"}
- "accepted": they agree to host/collaborate.
- "declined": they say no or aren't interested.
- "negotiating": interested but discussing terms, dates, or details.
- "question": they're asking for more info before deciding.
- "other": anything else (greetings, automated replies, off-topic).
- offered_times: any visit dates/times they proposed, verbatim-ish, else [].`;

interface RetryableError {
  status?: number;
  headers?: { get?: (k: string) => string | null } | Record<string, string>;
}

function retryAfterSeconds(err: RetryableError): number {
  const h = err.headers;
  const raw =
    typeof (h as { get?: unknown })?.get === "function"
      ? (h as { get: (k: string) => string | null }).get("retry-after")
      : ((h as Record<string, string> | undefined)?.["retry-after"] ?? null);
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), 10) : 2;
}

/** Classify a restaurant's DM reply; honors Retry-After on 429 once. */
export async function classifyReply(
  restaurantName: string,
  replyText: string
): Promise<ReplyAnalysis> {
  const request = () =>
    routerClient().chat.completions.create({
      model: routerModel(),
      max_tokens: 300,
      temperature: 0,
      messages: [
        { role: "system", content: CLASSIFY_SYSTEM },
        {
          role: "user",
          content: `Restaurant: ${restaurantName}\nTheir reply:\n"""${replyText.slice(0, 4000)}"""`,
        },
      ],
    });

  let response;
  try {
    response = await request();
  } catch (err) {
    // 429 = rate limit or temporary model overload — honor Retry-After once
    if ((err as RetryableError).status === 429) {
      const wait = retryAfterSeconds(err as RetryableError);
      await new Promise((r) => setTimeout(r, wait * 1000));
      response = await request();
    } else {
      throw err;
    }
  }

  const content = response.choices[0]?.message?.content ?? "";
  const parsed = extractJson<{
    verdict?: string;
    offered_times?: unknown;
    summary?: string;
  }>(content);

  const verdict: ReplyVerdict = (
    ["accepted", "declined", "negotiating", "question", "other"] as const
  ).includes(parsed?.verdict as ReplyVerdict)
    ? (parsed!.verdict as ReplyVerdict)
    : "other";

  return {
    verdict,
    offeredTimes: Array.isArray(parsed?.offered_times)
      ? parsed.offered_times.filter((t): t is string => typeof t === "string").slice(0, 10)
      : [],
    summary: typeof parsed?.summary === "string" ? parsed.summary : "",
  };
}
