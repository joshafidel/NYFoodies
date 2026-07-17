"use client";

import { useEffect, useMemo, useState } from "react";
import { parseHandle, renderPitch } from "@/lib/pitches";
import { defaultPitch, useDeals, usePitches, useSettings } from "@/lib/store";
import { Deal } from "@/lib/types";

interface Props {
  deal: Deal;
  store: ReturnType<typeof useDeals>;
  onClose: () => void;
}

export function OutreachModal({ deal, store, onClose }: Props) {
  const { updateDeal } = store;
  const { pitches } = usePitches();
  const { settings } = useSettings();

  const [pitchId, setPitchId] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState("");
  const [handleInput, setHandleInput] = useState("");
  const [handleError, setHandleError] = useState("");
  const [useEmail, setUseEmail] = useState(false);
  const [emailInput, setEmailInput] = useState(deal.email ?? "");
  const [copied, setCopied] = useState(false);

  const activePitch = useMemo(
    () => pitches.find((p) => p.id === pitchId) ?? defaultPitch(pitches),
    [pitches, pitchId]
  );

  // (re)render the message whenever the chosen pitch changes
  useEffect(() => {
    if (activePitch) {
      setMessage(renderPitch(activePitch.body, deal, settings.profile));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePitch?.id, settings.profile]);

  const hasHandle = Boolean(deal.instagramHandle);

  function saveHandle() {
    const h = parseHandle(handleInput);
    if (!h) {
      setHandleError("That doesn't look like a handle or Instagram URL.");
      return;
    }
    setHandleError("");
    updateDeal(deal.id, { instagramHandle: h });
  }

  async function copyOnly() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  async function copyAndOpen() {
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      // profile still opens; user can copy manually
    }
    updateDeal(deal.id, {
      contactStatus: "waiting_instagram",
      pendingOutreach: { pitchId: activePitch?.id, message, openedAt: Date.now() },
    });
    window.open(`https://instagram.com/${deal.instagramHandle}`, "_blank");
    onClose();
  }

  function emailAndTrack() {
    const email = emailInput.trim();
    if (!email.includes("@")) return;
    updateDeal(deal.id, {
      email,
      contactStatus: "waiting_instagram",
      pendingOutreach: { pitchId: activePitch?.id, message, openedAt: Date.now() },
    });
    const subject = encodeURIComponent(`Collab idea for ${deal.name}`);
    window.open(`mailto:${email}?subject=${subject}&body=${encodeURIComponent(message)}`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card p-4 shadow-xl sm:rounded-3xl">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <div className="text-lg font-extrabold">{deal.name}</div>
            <div className="text-xs text-muted">
              {hasHandle ? (
                <a
                  className="text-accent underline"
                  href={`https://instagram.com/${deal.instagramHandle}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  @{deal.instagramHandle}
                </a>
              ) : (
                "No Instagram handle yet"
              )}
            </div>
          </div>
          <button className="btn btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Handle setup when missing */}
        {!hasHandle && !useEmail && (
          <div className="mb-3 space-y-2 rounded-2xl bg-accent-soft/50 p-3">
            <div className="text-xs font-bold">First, find their Instagram:</div>
            <a
              className="btn w-full justify-center text-xs"
              href={`https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(deal.name)}`}
              target="_blank"
              rel="noreferrer"
            >
              🔍 Search Instagram for &ldquo;{deal.name}&rdquo;
            </a>
            <div className="flex gap-1.5">
              <input
                className="min-w-0 flex-1 text-sm"
                value={handleInput}
                onChange={(e) => setHandleInput(e.target.value)}
                placeholder="@handle or paste their profile URL"
                onKeyDown={(e) => e.key === "Enter" && saveHandle()}
              />
              <button className="btn shrink-0 text-xs" onClick={saveHandle}>
                Save
              </button>
            </div>
            {handleError && <div className="text-xs text-accent">{handleError}</div>}
            <button
              className="btn btn-ghost w-full justify-center text-xs text-muted"
              onClick={() => setUseEmail(true)}
            >
              ✉️ No Instagram? Add an email instead
            </button>
          </div>
        )}

        {useEmail && (
          <div className="mb-3 space-y-2 rounded-2xl bg-accent-soft/50 p-3">
            <div className="text-xs font-bold">Email outreach</div>
            <input
              className="w-full text-sm"
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="contact@restaurant.com"
            />
            {!hasHandle && (
              <button
                className="btn btn-ghost w-full justify-center text-xs text-muted"
                onClick={() => setUseEmail(false)}
              >
                ← Back to Instagram options
              </button>
            )}
          </div>
        )}

        {/* Pitch selection */}
        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">
          Pitch
        </label>
        <select
          className="mb-2 w-full text-sm"
          value={activePitch?.id ?? ""}
          onChange={(e) => setPitchId(e.target.value)}
        >
          {pitches.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
              {p.isDefault ? " ★" : ""}
            </option>
          ))}
        </select>

        {/* Message preview (editable) */}
        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">
          Your message — edit freely
        </label>
        <textarea
          className="mb-3 w-full text-sm leading-relaxed"
          rows={7}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        <div className="space-y-2">
          {useEmail ? (
            <button
              className="btn btn-primary w-full justify-center"
              onClick={emailAndTrack}
              disabled={!emailInput.includes("@")}
            >
              📧 Open email draft
            </button>
          ) : (
            <button
              className="btn btn-primary w-full justify-center"
              onClick={copyAndOpen}
              disabled={!hasHandle}
            >
              📋 Copy &amp; open Instagram
            </button>
          )}
          <div className="flex gap-2">
            <button className="btn flex-1 justify-center text-xs" onClick={copyOnly}>
              {copied ? "Copied ✓" : "Copy message only"}
            </button>
            <button className="btn flex-1 justify-center text-xs" onClick={onClose}>
              Cancel
            </button>
          </div>
          <p className="text-center text-[11px] text-muted">
            Opening Instagram doesn&apos;t mark them contacted — you&apos;ll confirm
            after you actually send it.
          </p>
        </div>
      </div>
    </div>
  );
}
