import { NextRequest, NextResponse } from "next/server";
import { classifyReply, llmConfigured, routerModel } from "@/lib/llm";

export const runtime = "nodejs";

/**
 * Classify a restaurant's DM reply via the Perplexity Router API and
 * suggest a pipeline stage. Body: { name: string, reply: string }.
 */
export async function POST(req: NextRequest) {
  if (!llmConfigured()) {
    return NextResponse.json(
      {
        error: "not_configured",
        message:
          "AI isn't set up — set PERPLEXITY_API_KEY (create one at console.perplexity.ai).",
      },
      { status: 503 }
    );
  }

  let body: { name?: string; reply?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const name = body.name?.trim();
  const reply = body.reply?.trim();
  if (!name || !reply) {
    return NextResponse.json({ error: "name and reply are required" }, { status: 400 });
  }

  try {
    const analysis = await classifyReply(name, reply);
    return NextResponse.json({ ...analysis, model: routerModel() });
  } catch (err) {
    const status = (err as { status?: number }).status;
    // never log the key; err.message from the SDK doesn't contain it
    console.error("[ai/classify-reply] failed", {
      status,
      message: err instanceof Error ? err.message : String(err),
    });
    const friendly: Record<number, string> = {
      400: `The model "${routerModel()}" isn't in this key's Router catalog — check GET /router/v1/models or unset PERPLEXITY_ROUTER_MODEL.`,
      401: "Perplexity rejected the API key — check PERPLEXITY_API_KEY (and that your key has Router API preview access).",
      402: "This model is excluded for your Perplexity usage tier — pick another from the catalog.",
      429: "Perplexity is rate-limiting or the model is briefly overloaded — try again in a moment.",
    };
    return NextResponse.json(
      { error: "llm_failed", message: friendly[status ?? 0] ?? "AI request failed — try again." },
      { status: status && status >= 400 && status < 500 ? status : 502 }
    );
  }
}
