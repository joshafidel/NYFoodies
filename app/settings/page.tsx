"use client";

import { useEffect, useState } from "react";
import { fillTemplate, useSettings } from "@/lib/store";
import { DEFAULT_TEMPLATE } from "@/lib/types";

export default function SettingsPage() {
  const { settings, loaded, update } = useSettings();
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (loaded) setDraft(settings.template);
  }, [loaded, settings.template]);

  function save() {
    update({ template: draft });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function clearAll() {
    if (
      confirm(
        "This wipes your entire pipeline and settings from this browser. Are you sure?"
      )
    ) {
      localStorage.removeItem("nyfoodies.deals.v1");
      localStorage.removeItem("nyfoodies.settings.v1");
      location.reload();
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <section className="card space-y-3 p-6">
        <h1 className="text-lg font-bold">Pitch template</h1>
        <p className="text-sm text-muted">
          This is what the <b>DM</b> button copies to your clipboard. Use{" "}
          <code className="rounded bg-accent-soft px-1">{"{name}"}</code> where the
          restaurant&apos;s name should go.
        </p>
        <textarea
          rows={6}
          className="w-full"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={save}>
            {saved ? "Saved ✓" : "Save template"}
          </button>
          <button className="btn" onClick={() => setDraft(DEFAULT_TEMPLATE)}>
            Reset to default
          </button>
        </div>
        <div className="rounded-lg border border-border p-3 text-sm">
          <div className="mb-1 text-xs font-medium text-muted">
            Preview (for &ldquo;Joe&apos;s Pizza&rdquo;):
          </div>
          {fillTemplate(draft || DEFAULT_TEMPLATE, "Joe's Pizza")}
        </div>
      </section>

      <section className="card space-y-2 p-6">
        <h2 className="text-lg font-bold">Default search location</h2>
        <p className="text-sm text-muted">
          {settings.defaultLocation
            ? `Currently: ${settings.defaultLocation.label}`
            : "Not set — your last search location is remembered automatically."}
        </p>
        {settings.defaultLocation && (
          <button className="btn" onClick={() => update({ defaultLocation: undefined })}>
            Clear saved location
          </button>
        )}
      </section>

      <section className="card space-y-2 p-6">
        <h2 className="text-lg font-bold">Data</h2>
        <p className="text-sm text-muted">
          Your pipeline lives in this browser (localStorage) — free, private, no account
          needed. Clearing browser data clears the pipeline too.
        </p>
        <button className="btn text-accent" onClick={clearAll}>
          🗑️ Erase all app data
        </button>
      </section>
    </div>
  );
}
