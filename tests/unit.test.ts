import { beforeAll, describe, expect, it } from "vitest";
import { createHmac } from "crypto";
import { decryptToken, encryptToken, verifyMetaSignature } from "../lib/crypto";
import { webhookDedupeKey } from "../lib/meta";
import { normalizeMessage, parseHandle, renderPitch } from "../lib/pitches";

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = "a".repeat(64);
});

describe("token encryption", () => {
  it("round-trips a token", () => {
    const token = "IGQVJXtest-token-1234567890";
    const enc = encryptToken(token);
    expect(enc).not.toContain(token);
    expect(decryptToken(enc)).toBe(token);
  });

  it("produces different ciphertexts per call (random IV)", () => {
    expect(encryptToken("same")).not.toBe(encryptToken("same"));
  });

  it("rejects tampered ciphertext", () => {
    const enc = encryptToken("secret");
    const parts = enc.split(".");
    parts[1] = parts[1].slice(0, -2) + "AA";
    expect(() => decryptToken(parts.join("."))).toThrow();
  });
});

describe("meta webhook signature", () => {
  const secret = "app-secret";
  const body = JSON.stringify({ object: "instagram", entry: [] });
  const sig = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

  it("accepts a valid signature", () => {
    expect(verifyMetaSignature(body, sig, secret)).toBe(true);
  });

  it("rejects a wrong signature", () => {
    expect(verifyMetaSignature(body, "sha256=" + "0".repeat(64), secret)).toBe(false);
  });

  it("rejects missing/malformed headers", () => {
    expect(verifyMetaSignature(body, null, secret)).toBe(false);
    expect(verifyMetaSignature(body, "md5=abc", secret)).toBe(false);
    expect(verifyMetaSignature(body, "sha256=nothex", secret)).toBe(false);
  });

  it("rejects a signature for a different body (retry with altered payload)", () => {
    expect(verifyMetaSignature(body + " ", sig, secret)).toBe(false);
  });
});

describe("webhook dedupe keys", () => {
  it("uses the message id when present, so duplicate deliveries collide", () => {
    const entry = {
      id: "123",
      messaging: [{ sender: { id: "9" }, message: { mid: "mid.ABC" } }],
    };
    const a = webhookDedupeKey("instagram", entry);
    const b = webhookDedupeKey("instagram", JSON.parse(JSON.stringify(entry)));
    expect(a).toBe(b);
    expect(a).toContain("mid.ABC");
  });

  it("distinguishes read receipts from messages with the same mid", () => {
    const msg = webhookDedupeKey("instagram", { messaging: [{ message: { mid: "m1" } }] });
    const read = webhookDedupeKey("instagram", { messaging: [{ read: { mid: "m1" } }] });
    expect(msg).not.toBe(read);
  });

  it("falls back to a stable hash for unknown shapes", () => {
    const entry = { id: "x", time: 1, weird: true };
    expect(webhookDedupeKey("instagram", entry)).toBe(webhookDedupeKey("instagram", { ...entry }));
  });
});

describe("pitch rendering", () => {
  const deal = {
    name: "Taverna Kyclades",
    cuisines: ["greek", "seafood"],
    address: "33-07 Ditmars Blvd, Astoria",
  };
  const profile = {
    creatorName: "Josh",
    creatorHandle: "@nyfoodies",
    audienceSize: "25k followers",
    mediaKitUrl: "https://kit.example.com",
    deliverables: "a reel + 3 stories",
  };

  it("fills every variable", () => {
    const out = renderPitch(
      "{restaurant}|{name}|{cuisine}|{neighborhood}|{creator_name}|{creator_handle}|{audience_size}|{media_kit}|{deliverables}",
      deal,
      profile
    );
    expect(out).toBe(
      "Taverna Kyclades|Taverna Kyclades|greek & seafood|Astoria|Josh|@nyfoodies|25k followers|https://kit.example.com|a reel + 3 stories"
    );
  });

  it("uses neutral fallbacks when profile is empty", () => {
    const out = renderPitch("{creator_name} / {creator_handle} / {audience_size}", deal, undefined);
    expect(out).not.toContain("{");
    expect(out).toContain("my page");
  });
});

describe("message normalization (outgoing-DM matching)", () => {
  it("ignores whitespace, punctuation, emoji and case", () => {
    expect(normalizeMessage("Hey  Joe's Pizza!!  👋\nLove your pies…")).toBe(
      normalizeMessage("hey joes pizza love your pies")
    );
  });

  it("does not equate substantially different messages", () => {
    expect(normalizeMessage("totally different message")).not.toBe(
      normalizeMessage("hey joes pizza love your pies")
    );
  });
});

describe("instagram handle parsing", () => {
  it("parses @handles, bare handles, and profile URLs", () => {
    expect(parseHandle("@joespizza")).toBe("joespizza");
    expect(parseHandle("joespizza")).toBe("joespizza");
    expect(parseHandle("https://www.instagram.com/joespizza/")).toBe("joespizza");
    expect(parseHandle("https://instagram.com/joes.pizza_nyc?igsh=x")).toBe("joes.pizza_nyc");
  });

  it("rejects junk", () => {
    expect(parseHandle("")).toBeNull();
    expect(parseHandle("not a handle!!")).toBeNull();
    expect(parseHandle("https://example.com/whatever")).toBeNull();
  });
});
