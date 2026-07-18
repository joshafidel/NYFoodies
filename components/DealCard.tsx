"use client";

import { useState } from "react";
import { PRICE_RANGE_BY_LEVEL, labelForTag } from "@/lib/cuisines";
import { priceLabel } from "@/lib/geo";
import { DAY_NAMES, parseOpeningHours, todayHours } from "@/lib/hours";
import { useDeals, useSettings } from "@/lib/store";
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
  const [hoursOpen, setHoursOpen] = useState(false);
  const [timeWhen, setTimeWhen] = useState("");
  const [timeNote, setTimeNote] = useState("");
  const [imgBroken, setImgBroken] = useState(false);

  const idx = stageIndex(deal.stage);
  const prev = idx > 0 ? STAGES[idx - 1] : null;
  const next = idx < STAGES.length - 1 ? STAGES[idx + 1] : null;

  const status = deal.contactStatus ?? "not_contacted";
  const followUpDays = settings.profile?.followUpDays ?? DEFAULT_FOLLOW_UP_DAYS;
  const followUpOverdue = deal.followUpAt != null && deal.followUpAt <= Date.now();
  const today = deal.openingHours ? todayHours(deal.openingHours) : null;
  const allDays = deal.openingHours ? parseOpeningHours(deal.openingHours) : null;

  /** Straight to their page — and arm the "did you send it?" prompt. */
  function openInstagram() {
    if (!deal.instagramHandle) return;
    window.open(`https://instagram.com/${deal.instagramHandle}`, "_blank");
    if (status === "not_contacted") {
      updateDeal(deal.id, {
        contactStatus: "waiting_instagram",
        pendingOutreach: { message: "", openedAt: Date.now() },
      });
    }
  }

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
      className="card relative cursor-grab space-y-2 overflow-hidden p-3 text-sm active:cursor-grabbing"
    >
      {/* one-tap remove */}
      <button
        className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/35 text-xs font-bold text-white"
        title="Remove from pipeline"
        onClick={() => removeDeal(deal.id)}
      >
        ✕
      </button>

      {deal.imageUrl && !imgBroken && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={deal.imageUrl}
          alt={deal.name}
          className="-mx-3 -mt-3 mb-1 h-28 w-[calc(100%+1.5rem)] max-w-none object-cover"
          onError={() => setImgBroken(true)}
        />
      )}

      <div className="flex items-start justify-between gap-1 pr-6">
        <button
          className="text-left font-bold leading-tight hover:text-accent"
          onClick={() => setOpen((v) => !v)}
          title={open ? "Collapse" : "Expand"}
        >
          {deal.name}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {deal.priceLevel ? (
          <span className="tag" title="Estimated per-person spend">
            {priceLabel(deal.priceLevel)} · {PRICE_RANGE_BY_LEVEL[deal.priceLevel] ?? ""}
          </span>
        ) : null}
        {status !== "not_contacted" && (
          <span className={`tag ${status === "waiting_instagram" ? "" : "tag-green"}`}>
            {CONTACT_STATUS_LABELS[status]}
          </span>
        )}
        {deal.cuisines.slice(0, 3).map((c) => (
          <span key={c} className="tag">
            {labelForTag(c)}
          </span>
        ))}
      </div>

      {today && (
        <div className="text-[11px] text-muted">
          <button
            className="font-semibold"
            onClick={() => setHoursOpen((v) => !v)}
          >
            {today} {allDays ? (hoursOpen ? "▾" : "▸") : ""}
          </button>
          {hoursOpen && allDays && (
            <div className="mt-1 space-y-0.5 rounded-xl bg-accent-soft/40 p-2">
              {allDays.map((text, i) => (
                <div key={i} className="flex justify-between gap-3">
                  <span className="font-semibold">{DAY_NAMES[i]}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Follow-up badge */}
      {deal.followUpAt != null && status !== "waiting_instagram" && (
        <div
          className={`rounded-xl px-2 py-1 text-[11px] font-bold ${
            followUpOverdue ? "bg-accent text-white" : "bg-accent-soft/60 text-muted"
          }`}
        >
          {followUpOverdue
            ? "Follow up now!"
            : `Follow up ${new Date(deal.followUpAt).toLocaleDateString()}`}
        </div>
      )}

      {/* Offered times */}
      {deal.offeredTimes.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-accent-soft/60 p-2 text-xs">
          {deal.offeredTimes.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-1">
              <span>
                <b>{t.when}</b>
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
          <div className="text-xs font-bold">Did you send the DM?</div>
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
        <div className="space-y-1">
          <div className="flex flex-wrap gap-1">
            {deal.instagramHandle ? (
              <button className="btn text-xs" onClick={openInstagram}>
                Instagram ↗
              </button>
            ) : (
              <span className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted">
                No Instagram found
              </span>
            )}
            {deal.website && (
              <a className="btn text-xs" href={deal.website} target="_blank" rel="noreferrer">
                Website ↗
              </a>
            )}
          </div>
          {/* stage arrows: their own line, side by side */}
          <div className="flex gap-1">
            <button
              className="btn flex-1 justify-center text-xs"
              onClick={() => prev && updateDeal(deal.id, { stage: prev.id })}
              disabled={!prev}
              title={prev ? `Move back to ${prev.label}` : "First stage"}
            >
              ← {prev ? prev.label.split(" ")[0] : ""}
            </button>
            <button
              className="btn flex-1 justify-center text-xs"
              onClick={() => next && updateDeal(deal.id, { stage: next.id })}
              disabled={!next}
              title={next ? `Move to ${next.label}` : "Last stage"}
            >
              {next ? next.label.split(" ")[0] : ""} →
            </button>
          </div>
        </div>
      )}

      {open && (
        <div className="space-y-2 border-t border-border pt-2">
          {deal.email && <div className="text-xs text-muted">Email: {deal.email}</div>}
          {deal.address && <div className="text-xs text-muted">{deal.address}</div>}

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
              <option value="1">$ · 20–40pp</option>
              <option value="2">$$ · 40–70pp</option>
              <option value="3">$$$ · 70–100pp</option>
              <option value="4">$$$$ · 100+pp</option>
            </select>
          </label>

          {/* Instagram handle editor */}
          <label className="flex items-center gap-2 text-xs text-muted">
            IG handle
            <input
              className="min-w-0 flex-1 text-xs"
              defaultValue={deal.instagramHandle ?? ""}
              placeholder="@handle"
              onBlur={(e) =>
                updateDeal(deal.id, {
                  instagramHandle: e.target.value.trim().replace(/^@/, "") || undefined,
                })
              }
            />
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

          <div className="text-[11px] text-muted">
            {deal.contactedAt
              ? `Contacted ${new Date(deal.contactedAt).toLocaleDateString()}`
              : `Added ${new Date(deal.createdAt).toLocaleDateString()}`}
          </div>
        </div>
      )}
    </div>
  );
}
