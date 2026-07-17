"use client";

import { useState } from "react";
import { labelForTag } from "@/lib/cuisines";
import { priceLabel } from "@/lib/geo";
import { useDeals, useSettings } from "@/lib/store";
import { OutreachModal } from "./OutreachModal";
import {
  CONTACT_STATUS_LABELS,
  DEFAULT_FOLLOW_UP_DAYS,
  Deal,
  STAGES,
  Stage,
} from "@/lib/types";

interface Props {
  deal: Deal;
  store: ReturnType<typeof useDeals>;
  onDragStart: () => void;
  onDragEnd: () => void;
}

function stageIndex(stage: Stage): number {
  return STAGES.findIndex((s) => s.id === stage);
}

const DAY = 24 * 60 * 60 * 1000;

function toDateInput(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function DealCard({ deal, store, onDragStart, onDragEnd }: Props) {
  const { updateDeal, removeDeal, addOfferedTime, removeOfferedTime } = store;
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const [showOutreach, setShowOutreach] = useState(false);
  const [timeWhen, setTimeWhen] = useState("");
  const [timeNote, setTimeNote] = useState("");
  const [editingHandle, setEditingHandle] = useState(false);
  const [handleDraft, setHandleDraft] = useState(deal.instagramHandle ?? "");

  const idx = stageIndex(deal.stage);
  const prev = idx > 0 ? STAGES[idx - 1] : null;
  const next = idx < STAGES.length - 1 ? STAGES[idx + 1] : null;

  const status = deal.contactStatus ?? "not_contacted";
  const followUpDays = settings.profile?.followUpDays ?? DEFAULT_FOLLOW_UP_DAYS;
  const followUpOverdue = deal.followUpAt != null && deal.followUpAt <= Date.now();

  function confirmSent() {
    updateDeal(deal.id, {
      stage: deal.stage === "to_contact" ? "contacted" : deal.stage,
      contactStatus: "confirmed_manual",
      contactedAt: deal.contactedAt ?? Date.now(),
      followUpAt: Date.now() + followUpDays * DAY,
      pendingOutreach: undefined,
    });
  }

  function cancelOutreach() {
    updateDeal(deal.id, { contactStatus: "not_contacted", pendingOutreach: undefined });
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

  const statusBadge =
    status !== "not_contacted" ? (
      <span
        className={`tag ${status === "waiting_instagram" ? "" : "tag-green"}`}
        title="Outreach status"
      >
        {CONTACT_STATUS_LABELS[status]}
      </span>
    ) : null;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="card cursor-grab space-y-2 p-3 text-sm active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-1">
        <button
          className="text-left font-bold leading-tight hover:text-accent"
          onClick={() => setOpen((v) => !v)}
          title={open ? "Collapse" : "Expand"}
        >
          {deal.name}
        </button>
        {deal.priceLevel ? (
          <span className="text-xs font-bold text-muted">{priceLabel(deal.priceLevel)}</span>
        ) : null}
      </div>

      {(deal.cuisines.length > 0 || statusBadge) && (
        <div className="flex flex-wrap items-center gap-1">
          {statusBadge}
          {deal.cuisines.slice(0, 3).map((c) => (
            <span key={c} className="tag">
              {labelForTag(c)}
            </span>
          ))}
        </div>
      )}

      {/* Follow-up badge */}
      {deal.followUpAt != null && status !== "waiting_instagram" && (
        <div
          className={`rounded-xl px-2 py-1 text-[11px] font-bold ${
            followUpOverdue ? "bg-accent text-white" : "bg-accent-soft/60 text-muted"
          }`}
        >
          {followUpOverdue ? "⏰ Follow up now!" : `📅 Follow up ${new Date(deal.followUpAt).toLocaleDateString()}`}
        </div>
      )}

      {/* Offered times */}
      {deal.offeredTimes.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-accent-soft/60 p-2 text-xs">
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

      {/* Waiting-for-confirmation state */}
      {status === "waiting_instagram" ? (
        <div className="space-y-1.5 rounded-xl border-2 border-dashed border-accent/40 p-2">
          <div className="text-xs font-bold">Did you send the message?</div>
          <div className="flex gap-1.5">
            <button className="btn btn-primary flex-1 justify-center text-xs" onClick={confirmSent}>
              ✓ I sent it
            </button>
            <button className="btn flex-1 justify-center text-xs" onClick={cancelOutreach}>
              Not yet
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">
          <button className="btn btn-primary text-xs" onClick={() => setShowOutreach(true)}>
            ✉️ Prepare DM
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
              → {next.label.split(" ")[0]}
            </button>
          )}
        </div>
      )}

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

          {deal.email && <div className="text-xs text-muted">📧 {deal.email}</div>}
          {deal.address && <div className="text-xs text-muted">📍 {deal.address}</div>}
          {deal.website && (
            <a
              className="block text-xs text-accent underline"
              href={deal.website}
              target="_blank"
              rel="noreferrer"
            >
              🌐 Website
            </a>
          )}

          {/* Follow-up date */}
          <label className="flex items-center gap-2 text-xs text-muted">
            Follow up
            <input
              type="date"
              className="text-xs"
              value={deal.followUpAt ? toDateInput(deal.followUpAt) : ""}
              onChange={(e) =>
                updateDeal(deal.id, {
                  followUpAt: e.target.value
                    ? new Date(`${e.target.value}T09:00:00`).getTime()
                    : undefined,
                })
              }
            />
            {deal.followUpAt != null && (
              <button
                className="btn btn-ghost text-xs text-muted"
                onClick={() => updateDeal(deal.id, { followUpAt: undefined })}
              >
                Clear
              </button>
            )}
          </label>

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
              <div className="text-xs font-bold text-muted">Add an offered time</div>
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

      {showOutreach && (
        <OutreachModal deal={deal} store={store} onClose={() => setShowOutreach(false)} />
      )}
    </div>
  );
}
