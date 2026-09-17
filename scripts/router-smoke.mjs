// Smoke-test the Perplexity Router API wiring. Prints statuses/shapes only —
// never the key. Usage: node scripts/router-smoke.mjs
const BASE = "https://api.perplexity.ai/router/v1";
const key = process.env.PERPLEXITY_API_KEY;

if (!key) {
  console.log("PERPLEXITY_API_KEY is not set.");
  console.log("→ Create one at https://console.perplexity.ai, request Router API");
  console.log("  preview access (api@perplexity.ai), then: export PERPLEXITY_API_KEY=...");
  // still verify the endpoint is reachable & auth is enforced
  const res = await fetch(`${BASE}/models`);
  console.log(`Unauthenticated GET /models → HTTP ${res.status} (expected 401)`);
  process.exit(res.status === 401 ? 0 : 1);
}

const auth = { Authorization: `Bearer ${key}` };

const models = await fetch(`${BASE}/models`, { headers: auth });
console.log(`GET /models → HTTP ${models.status}`);
if (!models.ok) {
  console.log(models.status === 401
    ? "401: key rejected — check the key / Router preview access, or rotate it in the console."
    : "Unexpected status; see docs.perplexity.ai/docs/router/quickstart");
  process.exit(1);
}
const catalog = (await models.json()).data.map((m) => m.id).sort();
console.log(`Catalog (${catalog.length} models): ${catalog.join(", ")}`);

const model = process.env.PERPLEXITY_ROUTER_MODEL || "perplexity/deepseek-v4-flash-0731";
const chat = await fetch(`${BASE}/chat/completions`, {
  method: "POST",
  headers: { ...auth, "Content-Type": "application/json" },
  body: JSON.stringify({
    model,
    max_tokens: 32,
    messages: [{ role: "user", content: "Reply with the single word: ok" }],
  }),
});
console.log(`POST /chat/completions (${model}) → HTTP ${chat.status}`);
if (chat.status === 429) console.log(`Retry-After: ${chat.headers.get("retry-after") ?? "n/a"}s`);
if (chat.ok) {
  const j = await chat.json();
  console.log(`Response shape: choices=${j.choices?.length}, usage.prompt_tokens=${j.usage?.prompt_tokens}, usage.completion_tokens=${j.usage?.completion_tokens}`);
}
process.exit(chat.ok ? 0 : 1);
