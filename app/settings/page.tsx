"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSettings } from "@/lib/store";

interface IgProfile {
  username: string;
  name?: string;
  profile_picture_url?: string;
  followers_count?: number;
  media_count?: number;
}

interface IgMedia {
  id: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  caption?: string;
}

interface IgState {
  configured: boolean;
  connected: boolean;
  profile?: IgProfile;
  media?: IgMedia[];
  error?: string;
}

export default function SettingsPage() {
  const { settings, update } = useSettings();
  const [ig, setIg] = useState<IgState | null>(null);

  useEffect(() => {
    fetch("/api/instagram/me")
      .then((r) => r.json())
      .then(setIg)
      .catch(() => setIg({ configured: false, connected: false }));
  }, []);

  function clearAll() {
    if (
      confirm("This wipes your entire pipeline, pitches, and settings from this browser. Are you sure?")
    ) {
      localStorage.removeItem("nyfoodies.deals.v1");
      localStorage.removeItem("nyfoodies.settings.v1");
      localStorage.removeItem("nyfoodies.pitches.v1");
      location.reload();
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <h1 className="px-1 text-lg font-bold tracking-tight">Settings</h1>

      {/* Instagram */}
      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-bold">Instagram</h2>
        {!ig ? (
          <div className="text-sm text-muted">Checking connection…</div>
        ) : ig.connected && ig.profile ? (
          <>
            <div className="flex items-center gap-3">
              {ig.profile.profile_picture_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ig.profile.profile_picture_url}
                  alt={ig.profile.username}
                  className="h-14 w-14 rounded-full border border-border object-cover"
                />
              )}
              <div className="flex-1">
                <div className="font-bold">@{ig.profile.username}</div>
                <div className="text-xs text-muted">
                  {ig.profile.followers_count?.toLocaleString() ?? "—"} followers ·{" "}
                  {ig.profile.media_count?.toLocaleString() ?? "—"} posts
                </div>
              </div>
              <form action="/api/instagram/logout" method="post">
                <button className="btn btn-ghost text-xs text-muted">Disconnect</button>
              </form>
            </div>
            {ig.media && ig.media.length > 0 && (
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                {ig.media.slice(0, 8).map((m) => (
                  <a
                    key={m.id}
                    href={m.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="block aspect-square overflow-hidden rounded-lg border border-border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.media_type === "VIDEO" ? m.thumbnail_url ?? m.media_url : m.media_url}
                      alt={m.caption?.slice(0, 60) ?? "post"}
                      className="h-full w-full object-cover"
                    />
                  </a>
                ))}
              </div>
            )}
          </>
        ) : ig.configured ? (
          <div className="space-y-2 text-sm text-muted">
            <p>
              Connect your Instagram professional account to show your live follower count
              and recent posts.
              {ig.error && <span className="mt-1 block text-accent">{ig.error}</span>}
            </p>
            <a href="/api/instagram/login" className="btn btn-primary">
              📸 Connect Instagram
            </a>
          </div>
        ) : (
          <div className="space-y-2 text-sm text-muted">
            <p className="font-medium text-foreground">Not configured yet (free, ~5 min)</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Switch your Instagram to a free Professional account (Creator/Business).</li>
              <li>
                Create a free app at{" "}
                <a
                  className="text-accent underline"
                  href="https://developers.facebook.com/apps/"
                  target="_blank"
                  rel="noreferrer"
                >
                  developers.facebook.com
                </a>{" "}
                → add the Instagram product.
              </li>
              <li>
                Add <code className="rounded bg-accent-soft px-1">YOUR_APP_URL/api/instagram/callback</code>{" "}
                as a redirect URI.
              </li>
              <li>
                Set <code className="rounded bg-accent-soft px-1">INSTAGRAM_APP_ID</code> and{" "}
                <code className="rounded bg-accent-soft px-1">INSTAGRAM_APP_SECRET</code> env vars
                and redeploy.
              </li>
            </ol>
            <p>The rest of the app works fine without this.</p>
          </div>
        )}
      </section>

      {/* Pitches pointer */}
      <section className="card space-y-1 p-4">
        <h2 className="text-sm font-bold">Pitches</h2>
        <p className="text-sm text-muted">
          Your outreach messages live in the{" "}
          <Link href="/pitches" className="text-accent underline">
            Pitches
          </Link>{" "}
          tab — the ★ default one is what the DM button copies.
        </p>
      </section>

      {/* Location */}
      <section className="card space-y-2 p-4">
        <h2 className="text-sm font-bold">Default search location</h2>
        <p className="text-sm text-muted">
          {settings.defaultLocation
            ? `Currently: ${settings.defaultLocation.label}`
            : "Not set — your last search location is remembered automatically."}
        </p>
        {settings.defaultLocation && (
          <button className="btn text-xs" onClick={() => update({ defaultLocation: undefined })}>
            Clear saved location
          </button>
        )}
      </section>

      {/* Data */}
      <section className="card space-y-2 p-4">
        <h2 className="text-sm font-bold">Data</h2>
        <p className="text-sm text-muted">
          Everything is stored in this browser (localStorage) — free, private, no account.
          Clearing browser data clears the app too.
        </p>
        <button className="btn text-xs text-accent" onClick={clearAll}>
          🗑️ Erase all app data
        </button>
      </section>
    </div>
  );
}
