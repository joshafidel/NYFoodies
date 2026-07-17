"use client";

import { useState } from "react";
import { usePitches } from "@/lib/store";
import { Pitch } from "@/lib/types";

export default function PitchesPage() {
  const { pitches, loaded, addPitch, updatePitch, removePitch, setDefault } = usePitches();
  const [openId, setOpenId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const open = pitches.find((p) => p.id === openId) ?? null;

  async function copy(p: Pitch) {
    try {
      await navigator.clipboard.writeText(p.body);
      setCopiedId(p.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // clipboard unavailable — nothing to do
    }
  }

  // ── Editor view (like opening a note) ────────────────────────────────
  if (open) {
    return (
      <div className="flex h-[calc(100dvh-8.5rem)] flex-col gap-2">
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost text-sm text-accent" onClick={() => setOpenId(null)}>
            ‹ Pitches
          </button>
          <div className="ml-auto flex items-center gap-1">
            <button
              className={`btn text-xs ${open.isDefault ? "btn-primary" : ""}`}
              onClick={() => setDefault(open.id)}
              title="The default pitch is what the DM button copies"
            >
              {open.isDefault ? "★ Default" : "☆ Make default"}
            </button>
            <button className="btn text-xs" onClick={() => copy(open)}>
              {copiedId === open.id ? "Copied ✓" : "📋 Copy"}
            </button>
          </div>
        </div>
        <input
          className="w-full text-base font-bold"
          value={open.title}
          onChange={(e) => updatePitch(open.id, { title: e.target.value })}
          placeholder="Pitch title"
        />
        <textarea
          className="w-full flex-1 resize-none text-[15px] leading-relaxed"
          value={open.body}
          onChange={(e) => updatePitch(open.id, { body: e.target.value })}
          placeholder={`Write your pitch…\n\nTip: use {name} where the restaurant's name should go — the DM button fills it in automatically.`}
        />
        <div className="flex items-center justify-between text-[11px] text-muted">
          <span>
            Edited {new Date(open.updatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            {" · saves automatically"}
          </span>
          <button
            className="text-accent"
            onClick={() => {
              if (confirm(`Delete "${open.title}"?`)) {
                removePitch(open.id);
                setOpenId(null);
              }
            }}
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  // ── List view (like the notes list) ──────────────────────────────────
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-bold tracking-tight">Pitches</h1>
        <button
          className="btn btn-primary ml-auto text-xs"
          onClick={() => {
            const p = addPitch();
            setOpenId(p.id);
          }}
        >
          + New pitch
        </button>
      </div>
      <p className="px-1 text-xs text-muted">
        Keep every outreach message you use here, ready to copy into Instagram. The{" "}
        <b>★ default</b> pitch is what the DM button on pipeline cards copies —{" "}
        <code className="rounded bg-accent-soft px-1">{"{name}"}</code> gets replaced with
        the restaurant&apos;s name.
      </p>

      {loaded && pitches.length === 0 && (
        <div className="card p-8 text-center text-sm text-muted">
          No pitches yet — tap <b>+ New pitch</b> to write your first one.
        </div>
      )}

      <div className="space-y-2">
        {pitches.map((p) => (
          <div key={p.id} className="card flex items-center gap-2 p-3">
            <button className="min-w-0 flex-1 text-left" onClick={() => setOpenId(p.id)}>
              <div className="flex items-center gap-1.5">
                <span className="truncate font-semibold">{p.title || "Untitled"}</span>
                {p.isDefault && (
                  <span className="shrink-0 rounded-full bg-accent-soft px-2 text-[10px] font-bold text-accent">
                    ★ default
                  </span>
                )}
              </div>
              <div className="truncate text-xs text-muted">
                {p.body.replace(/\n/g, " ").slice(0, 90) || "Empty"}
              </div>
              <div className="mt-0.5 text-[10px] text-muted">
                {new Date(p.updatedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </div>
            </button>
            <button className="btn shrink-0 text-xs" onClick={() => copy(p)}>
              {copiedId === p.id ? "✓" : "📋 Copy"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
