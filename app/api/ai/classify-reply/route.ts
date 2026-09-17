import { NextRequest, NextResponse } from "next/server";
import { classifyReply, heuristicClassify, llmConfigured, routerModel } from "@/lib/llm";

export const runtime = "nodejs";

/**
 * Classify a restaurant's DM reply and suggest a pipeline stage.
 * Body: { name: string, reply: string }.
 * Works with zero setup (keyword rules); upgrades automatically to the
 * Perplexity Router API when PERPLEXITY_API_KEY is set.
 */
export async function POST(req: NextRequest) {
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

  if (!llmConfigured()) {
    return NextResponse.json({ ...heuristicClassify(reply), engine: "rules" });
  }

  try {
    const analysis = await classifyReply(name, reply);
    return NextResponse.json({ ...analysis, engine: "ai", model: routerModel() });
  } catch (err) {
    // never log the key; err.message from the SDK doesn't contain it
    console.error("[ai/classify-reply] LLM failed, falling back to rules", {
      status: (err as { status?: number }).status,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ...heuristicClassify(reply), engine: "rules" });
  }
}
