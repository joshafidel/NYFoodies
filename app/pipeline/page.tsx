"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DealCard } from "@/components/DealCard";
import { formatDistance } from "@/lib/geo";
import { labelForTag } from "@/lib/cuisines";
import { useDeals, useSettings } from "@/lib/store";
import { ACTIVE_STAGES, Deal, Place, STAGES, Stage } from "@/lib/types";

export default function PipelinePage() {
  const store = useDeals();
  const { deals, loaded, updateDeal, addDeal } = store;
  const { settings } = useSettings();
  const [query, setQuery] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<Stage | null>(null);
  const [showArchive, setShowArchive] = useState(false);

  // verified-only manual add (typeahead against real places)
  const [showAdd, setShowAdd] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [addResults, setAddResults] = useState<Place[]>([]);
  const [addSearching, setAddSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (addQuery.trim().length < 2) {
      setAddResults([]);
      setAddSearching(false);
      return;
    }
    setAddSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const bias = settings.defaultLocation
          ? `&lat=${settings.defaultLocation.lat}&lon=${settings.defaultLocation.lon}`
          : "";
        const res = await fetch(
          `/api/place-search?q=${encodeURIComponent(addQuery.trim())}${bias}`
        );
        const json = await res.json();
        setAddResults(json.results ?? []);
      } catch {
        setAddResults([]);
      } finally {
        setAddSearching(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [addQuery, settings.defaultLocation]);

  const inPipeline = useMemo(
    () => new Set(deals.map((d) => d.sourceId).filter(Boolean)),
    [deals]
  );

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

  const archivedCount = byStage.get("declined")?.length ?? 0;
  const visibleStages = showArchive
    ? STAGES.filter((s) => s.id === "declined")
    : ACTIVE_STAGES;

  const followUpsDue = useMemo(
    () =>
      deals.filter(
        (d) =>
          d.followUpAt != null && d.followUpAt <= Date.now() && d.stage !== "declined"
      ),
    [deals]
  );

  function onDrop(stage: Stage) {
    if (dragId) updateDeal(dragId, { stage });
    setDragId(null);
    setDragOver(null);
  }

  function addVerified(p: Place) {
    addDeal({
      name: p.name,
      address: p.address,
      lat: p.lat,
      lon: p.lon,
      cuisines: p.cuisines,
      website: p.website,
      phone: p.phone,
      instagramHandle: p.instagramHandle,
      sourceId: p.id,
    });
    setAddQuery("");
    setAddResults([]);
    setShowAdd(false);
  }

  return (
    <div className="flex h-[calc(100dvh-7.25rem)] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-bold tracking-tight">Pipeline</h1>
        <span className="text-xs text-muted">
          {loaded ? `${deals.length} place${deals.length === 1 ? "" : "s"}` : ""}
        </span>
        <div className="ml-auto flex gap-1.5">
          <button
            className={`btn text-xs ${showArchive ? "btn-primary" : ""}`}
            onClick={() => setShowArchive((v) => !v)}
            title="Declined places live here"
          >
            Archive{archivedCount ? ` (${archivedCount})` : ""}
          </button>
          <button
            className="btn text-xs"
            onClick={() => {
              setShowAdd((v) => !v);
              setAddQuery("");
              setAddResults([]);
            }}
          >
            {showAdd ? "✕ Close" : "+ Add place"}
          </button>
        </div>
      </div>

      {followUpsDue.length > 0 && !showArchive && (
        <div className="card border-accent/40 p-3 text-sm">
          <div className="font-bold">Follow-ups due</div>
          <div className="mt-0.5 text-xs text-muted">
            {followUpsDue.map((d) => d.name).join(" · ")} — open their cards to nudge them
            or push the date.
          </div>
        </div>
      )}

      <input
        className="w-full"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter by name, @handle, cuisine…"
      />

      {showAdd && (
        <div className="card space-y-2 p-3">
          <div className="text-xs font-medium text-muted">
            Search for a real place — results appear as you type. Only verified places can
            enter the pipeline.
          </div>
          <input
            className="w-full"
            value={addQuery}
            onChange={(e) => setAddQuery(e.target.value)}
            placeholder="Start typing a restaurant or bar name…"
            autoFocus
          />
          {addSearching && <div className="text-xs text-muted">Searching…</div>}
          {!addSearching && addQuery.trim().length >= 2 && addResults.length === 0 && (
            <div className="text-xs text-muted">
              No verified places match — check the spelling or add a neighborhood
              (e.g. &ldquo;Lucali Brooklyn&rdquo;).
            </div>
          )}
          <div className="space-y-1">
            {addResults.map((p) => {
              const saved = inPipeline.has(p.id);
              return (
                <button
                  key={p.id}
                  className="card flex w-full items-center gap-2 p-2 text-left disabled:opacity-50"
                  disabled={saved}
                  onClick={() => addVerified(p)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{p.name}</div>
                    <div className="truncate text-xs text-muted">
                      {p.address}
                      {p.distanceMeters != null ? ` · ${formatDistance(p.distanceMeters)}` : ""}
                    </div>
                    {p.cuisines.length > 0 && (
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {p.cuisines.slice(0, 3).map((c) => (
                          <span key={c} className="tag">
                            {labelForTag(c)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-accent">
                    {saved ? "✓ In pipeline" : "+ Add"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {loaded && deals.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">
          Your pipeline is empty.{" "}
          <Link href="/" className="text-accent underline">
            Search for places
          </Link>{" "}
          and add the ones you want to pitch — they&apos;ll show up here as cards you can
          move from <b>To Contact</b> all the way to <b>Accepted</b>.
        </div>
      ) : (
        <div className="-mx-3 flex min-h-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-1 sm:-mx-4 sm:px-4">
          {visibleStages.map((stage) => {
            const list = byStage.get(stage.id) ?? [];
            return (
              <div
                key={stage.id}
                className={`flex h-full w-[82vw] max-w-xs shrink-0 snap-center flex-col gap-2 rounded-xl border p-2 transition-colors sm:w-72 sm:snap-align-none ${
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
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
