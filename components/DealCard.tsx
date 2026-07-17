"use client";

import { useState } from "react";
import { labelForTag } from "@/lib/cuisines";
import { priceLabel } from "@/lib/geo";
import { fillTemplate, useDeals, useSettings } from "@/lib/store";
import { Deal, STAGES, Stage } from "@/lib/types";

interface Props {
  deal: Deal;
  store: ReturnType<typeof useDeals>;
  onDragStart: () => void;
  onDragEnd: () => void;
}

function stageIndex(stage: Stage): number {
  return STAGES.findIndex((s) => s.id === stage);
}

export function DealCard({ deal, store, onDragStart, onDragEnd }: Props) {
  const { updateDeal, removeDeal, addOfferedTime, removeOfferedTime } = store;
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [timeWhen, setTimeWhen] = useState("");
  const [timeNote, setTimeNote] = useState("");
  const [editingHandle, setEditingHandle] = useState(false);
  const [handleDraft, setHandleDraft] = useState(deal.instagramHandle ?? "");

  const idx = stageIndex(deal.stage);
  const prev = idx > 0 ? STAGES[idx - 1] : null;
  const next = idx < STAGES.length - 1 ? STAGES[idx + 1] : null;

  async function dm() {
    const message = fillTemplate(settings.template, deal.name);
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // clipboard can fail on http — the DM thread still opens
    }
    if (deal.instagramHandle) {
      window.open(`https://ig.me/m/${deal.instagramHandle}`, "_blank");
      if (deal.stage === "to_contact") updateDeal(deal.id, { stage: "contacted" });
    } else {
      setEditingHandle(true);
      setOpen(true);
    }
  }

  function saveHandle() {
    updateDeal(deal.id, {
      instagramHandle: handleDraft.trim().replace(/^@/, "") || undefined,
    });
    setEditingHandle(false);
  }

  function addTime() {
    if (!timeWhen.trim()) return;
    addOfferedTime(deal.id, timeWhen.trim(), timeNote.trim() || undefined);
    setTimeWhen("");
    setTimeNote("");
  }

  const showTimes =
    deal.stage === "responded" || deal.stage === "accepted" || deal.offeredTimes.length > 0;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="card cursor-grab space-y-2 p-3 text-sm shadow-sm active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-1">
        <button
          className="text-left font-semibold leading-tight hover:text-accent"
          onClick={() => setOpen((v) => !v)}
          title={open ? "Collapse" : "Expand"}
        >
          {deal.name}
        </button>
        {deal.priceLevel ? (
          <span className="text-xs font-bold text-muted">{priceLabel(deal.priceLevel)}</span>
        ) : null}
      </div>

      {deal.cuisines.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {deal.cuisines.slice(0, 4).map((c) => (
            <span key={c} className="tag">
              {labelForTag(c)}
            </span>
          ))}
        </div>
      )}

      {/* Offered times — always visible once they exist */}
      {deal.offeredTimes.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-accent-soft/60 p-2 text-xs">
          {deal.offeredTimes.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-1">
              <span>
                🗓️ <b>{t.when}</b>
                {t.note ? <span className="text-muted"> — {t.note}</span> : null}
              </span>
              <button
                className="text-muted hover:text-accent"
                onClick={() => removeOfferedTime(deal.id, t.id)}
                title="Remove time"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-1">
        <button className="btn btn-primary text-xs" onClick={dm}>
          {copied ? "Pitch copied ✓" : "💬 DM"}
        </button>
        {prev && (
          <button
            className="btn text-xs"
            onClick={() => updateDeal(deal.id, { stage: prev.id })}
            title={`Move back to ${prev.label}`}
          >
            ←
          </button>
        )}
        {next && (
          <button
            className="btn text-xs"
            onClick={() => updateDeal(deal.id, { stage: next.id })}
            title={`Move to ${next.label}`}
          >
            → {next.label}
          </button>
        )}
      </div>

      {open && (
        <div className="space-y-2 border-t border-border pt-2">
          {/* Instagram handle */}
          {editingHandle || !deal.instagramHandle ? (
            <div className="flex items-center gap-1">
              <input
                className="w-full text-xs"
                value={handleDraft}
                onChange={(e) => setHandleDraft(e.target.value)}
                placeholder="@instagramhandle"
                onKeyDown={(e) => e.key === "Enter" && saveHandle()}
              />
              <button className="btn text-xs" onClick={saveHandle}>
                Save
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs">
              <a
                href={`https://instagram.com/${deal.instagramHandle}`}
                target="_blank"
                rel="noreferrer"
                className="text-accent underline"
              >
                @{deal.instagramHandle}
              </a>
              <button
                className="btn btn-ghost text-xs text-muted"
                onClick={() => {
                  setHandleDraft(deal.instagramHandle ?? "");
                  setEditingHandle(true);
                }}
              >
                Edit
              </button>
            </div>
          )}

          {deal.address && <div className="text-xs text-muted">📍 {deal.address}</div>}
          {deal.website && (
            <a
              className="block text-xs text-accent underline"
              href={deal.website}
              target="_blank"
              rel="noreferrer"
            >
              Website ↗
            </a>
          )}

          {/* Price editor */}
          <label className="flex items-center gap-2 text-xs text-muted">
            Price
            <select
              value={deal.priceLevel ?? ""}
              onChange={(e) =>
                updateDeal(deal.id, {
                  priceLevel: e.target.value ? parseInt(e.target.value, 10) : undefined,
                })
              }
            >
              <option value="">unknown</option>
              <option value="1">$</option>
              <option value="2">$$</option>
              <option value="3">$$$</option>
              <option value="4">$$$$</option>
            </select>
          </label>

          {/* Offered times editor */}
          {showTimes && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted">Add an offered time</div>
              <input
                className="w-full text-xs"
                value={timeWhen}
                onChange={(e) => setTimeWhen(e.target.value)}
                placeholder='e.g. "Tue Jul 22, 7:30pm"'
              />
              <div className="flex gap-1">
                <input
                  className="w-full text-xs"
                  value={timeNote}
                  onChange={(e) => setTimeNote(e.target.value)}
                  placeholder="note (optional)"
                  onKeyDown={(e) => e.key === "Enter" && addTime()}
                />
                <button className="btn text-xs" onClick={addTime}>
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Notes */}
          <textarea
            className="w-full text-xs"
            rows={2}
            placeholder="Notes…"
            defaultValue={deal.notes ?? ""}
            onBlur={(e) => updateDeal(deal.id, { notes: e.target.value })}
          />

          <div className="flex justify-between text-[11px] text-muted">
            <span>
              {deal.contactedAt
                ? `Contacted ${new Date(deal.contactedAt).toLocaleDateString()}`
                : `Added ${new Date(deal.createdAt).toLocaleDateString()}`}
            </span>
            <button
              className="text-muted hover:text-accent"
              onClick={() => {
                if (confirm(`Remove ${deal.name} from your pipeline?`)) removeDeal(deal.id);
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
