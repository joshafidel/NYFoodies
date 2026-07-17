"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DealCard } from "@/components/DealCard";
import { useDeals } from "@/lib/store";
import { Deal, STAGES, Stage } from "@/lib/types";

export default function PipelinePage() {
  const store = useDeals();
  const { deals, loaded, updateDeal, addDeal } = store;
  const [query, setQuery] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<Stage | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualHandle, setManualHandle] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return deals;
    return deals.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.instagramHandle?.toLowerCase().includes(q) ||
        d.cuisines.some((c) => c.includes(q))
    );
  }, [deals, query]);

  const byStage = useMemo(() => {
    const map = new Map<Stage, Deal[]>();
    for (const s of STAGES) map.set(s.id, []);
    for (const d of filtered) map.get(d.stage)?.push(d);
    for (const list of map.values()) list.sort((a, b) => b.updatedAt - a.updatedAt);
    return map;
  }, [filtered]);

  function onDrop(stage: Stage) {
    if (dragId) updateDeal(dragId, { stage });
    setDragId(null);
    setDragOver(null);
  }

  function addManual() {
    if (!manualName.trim()) return;
    addDeal({
      name: manualName.trim(),
      instagramHandle: manualHandle.trim().replace(/^@/, "") || undefined,
      cuisines: [],
    });
    setManualName("");
    setManualHandle("");
    setShowAdd(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold tracking-tight">Pipeline</h1>
        <span className="text-sm text-muted">
          {loaded ? `${deals.length} place${deals.length === 1 ? "" : "s"}` : ""}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name, @handle, cuisine…"
            className="w-64"
          />
          <button className="btn" onClick={() => setShowAdd((v) => !v)}>
            + Add manually
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="card flex flex-wrap items-end gap-2 p-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            Place name
            <input
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="Lucali"
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            Instagram handle (optional)
            <input
              value={manualHandle}
              onChange={(e) => setManualHandle(e.target.value)}
              placeholder="@lucali_bk"
              onKeyDown={(e) => e.key === "Enter" && addManual()}
            />
          </label>
          <button className="btn btn-primary" onClick={addManual}>
            Add
          </button>
        </div>
      )}

      {loaded && deals.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">
          Your pipeline is empty.{" "}
          <Link href="/search" className="text-accent underline">
            Search for places
          </Link>{" "}
          and add the ones you want to pitch — they&apos;ll show up here as cards you can
          move from <b>To Contact</b> all the way to <b>Accepted</b>.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          {STAGES.map((stage) => {
            const list = byStage.get(stage.id) ?? [];
            return (
              <div
                key={stage.id}
                className={`flex min-h-40 flex-col gap-2 rounded-xl border p-2 transition-colors ${
                  dragOver === stage.id
                    ? "border-accent bg-accent-soft/50"
                    : "border-border bg-card/50"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(stage.id);
                }}
                onDragLeave={() => setDragOver((s) => (s === stage.id ? null : s))}
                onDrop={() => onDrop(stage.id)}
              >
                <div className="px-1">
                  <div className="flex items-center justify-between text-sm font-semibold">
                    {stage.label}
                    <span className="rounded-full bg-accent-soft px-2 text-xs font-bold text-accent">
                      {list.length}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted">{stage.hint}</div>
                </div>
                {list.map((deal) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    store={store}
                    onDragStart={() => setDragId(deal.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setDragOver(null);
                    }}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
