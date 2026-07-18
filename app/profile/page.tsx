"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSettings } from "@/lib/store";
import { CreatorProfile, DEFAULT_FOLLOW_UP_DAYS } from "@/lib/types";

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

const FIELDS: {
  key: keyof CreatorProfile;
  label: string;
  placeholder: string;
  type?: string;
}[] = [
  { key: "creatorName", label: "Your name", placeholder: "Josh" },
  { key: "creatorHandle", label: "Your Instagram handle", placeholder: "@nyfoodies" },
  { key: "audienceSize", label: "Audience size", placeholder: "25k followers" },
  { key: "mediaKitUrl", label: "Media-kit link", placeholder: "https://…" },
  {
    key: "deliverables",
    label: "Default deliverables",
    placeholder: "a reel + 3 stories tagging you",
  },
];

export default function ProfilePage() {
  const { settings, loaded, update } = useSettings();
  const [ig, setIg] = useState<IgState | null>(null);
  const [draft, setDraft] = useState<CreatorProfile>({});
  const [saved, setSaved] = useState(false);
  const [homeDraft, setHomeDraft] = useState("");
  const [workDraft, setWorkDraft] = useState("");
  const [slotError, setSlotError] = useState("");

  async function saveSlot(slot: "home" | "work", text: string) {
    if (!text.trim()) return;
    setSlotError("");
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(text)}`);
    const json = await res.json();
    if (!json.results?.length) {
      setSlotError("Couldn't find that address — try adding a zip.");
      return;
    }
    update({ [slot]: json.results[0] });
    if (slot === "home") setHomeDraft("");
    else setWorkDraft("");
  }

  useEffect(() => {
    fetch("/api/instagram/me")
      .then((r) => r.json())
      .then(setIg)
      .catch(() => setIg({ configured: false, connected: false }));
  }, []);

  useEffect(() => {
    if (loaded) setDraft(settings.profile ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  function saveProfile() {
    update({ profile: draft });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function clearAll() {
    if (
      confirm(
        "This wipes your entire pipeline, pitches, and profile from this browser. Are you sure?"
      )
    ) {
      localStorage.removeItem("nyfoodies.deals.v1");
      localStorage.removeItem("nyfoodies.settings.v1");
      localStorage.removeItem("nyfoodies.pitches.v1");
      location.reload();
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <h1 className="px-1 text-lg font-extrabold tracking-tight">Profile</h1>

      {/* Creator profile → pitch variables */}
      <section className="card space-y-2.5 p-4">
        <h2 className="text-sm font-extrabold">About you</h2>
        <p className="text-xs text-muted">
          These fill the variables in your pitches — {"{creator_name}"},{" "}
          {"{creator_handle}"}, {"{audience_size}"}, {"{media_kit}"}, {"{deliverables}"}.
        </p>
        {FIELDS.map((f) => (
          <label key={f.key} className="block text-xs font-bold text-muted">
            {f.label}
            <input
              className="mt-1 w-full text-sm font-normal"
              value={(draft[f.key] as string) ?? ""}
              placeholder={f.placeholder}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
            />
          </label>
        ))}
        <label className="block text-xs font-bold text-muted">
          Days until follow-up reminder (after you send a DM)
          <input
            className="mt-1 w-24 text-sm font-normal"
            type="number"
            min={1}
            max={30}
            value={draft.followUpDays ?? DEFAULT_FOLLOW_UP_DAYS}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                followUpDays: Math.max(1, parseInt(e.target.value || "5", 10)),
              }))
            }
          />
        </label>
        <button className="btn btn-primary" onClick={saveProfile}>
          {saved ? "Saved ✓" : "Save profile"}
        </button>
      </section>

      {/* Instagram */}
      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-extrabold">Instagram connection</h2>
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
                    className="block aspect-square overflow-hidden rounded-xl border border-border"
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
              Connect Instagram
            </a>
          </div>
        ) : (
          <div className="space-y-2 text-sm text-muted">
            <p className="font-bold text-foreground">Not configured yet (free, ~5 min)</p>
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
            <p>
              For DM detection &amp; conversation sync, see{" "}
              <code className="rounded bg-accent-soft px-1">docs/instagram-meta-setup.md</code>{" "}
              in the repo — it needs Meta App Review.
            </p>
          </div>
        )}
      </section>

      {/* Home & Work */}
      <section className="card space-y-2.5 p-4">
        <h2 className="text-sm font-extrabold">Home &amp; Work</h2>
        <p className="text-xs text-muted">
          Saved addresses for the one-tap buttons on Discover.
        </p>
        {(
          [
            ["home", homeDraft, setHomeDraft],
            ["work", workDraft, setWorkDraft],
          ] as const
        ).map(([slot, draftVal, setDraftVal]) => (
          <div key={slot} className="space-y-1">
            <div className="text-xs font-bold capitalize text-muted">{slot}</div>
            {settings[slot] && (
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate">{settings[slot]!.label}</span>
                <button
                  className="btn btn-ghost shrink-0 text-xs text-muted"
                  onClick={() => update({ [slot]: undefined })}
                >
                  Clear
                </button>
              </div>
            )}
            <div className="flex gap-1.5">
              <input
                className="min-w-0 flex-1 text-sm"
                value={draftVal}
                onChange={(e) => setDraftVal(e.target.value)}
                placeholder={settings[slot] ? "Change address…" : `Add your ${slot} address…`}
                onKeyDown={(e) => e.key === "Enter" && saveSlot(slot, draftVal)}
              />
              <button className="btn shrink-0 text-xs" onClick={() => saveSlot(slot, draftVal)}>
                Save
              </button>
            </div>
          </div>
        ))}
        {slotError && <div className="text-xs text-accent">{slotError}</div>}
      </section>

      {/* Location */}
      <section className="card space-y-2 p-4">
        <h2 className="text-sm font-extrabold">Default search location</h2>
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

      {/* Pitches pointer */}
      <section className="card space-y-1 p-4">
        <h2 className="text-sm font-extrabold">Pitches</h2>
        <p className="text-sm text-muted">
          Outreach messages live in the{" "}
          <Link href="/pitches" className="text-accent underline">
            Pitches
          </Link>{" "}
          tab — including starter templates for gifted meals, paid partnerships, openings,
          events, follow-ups, and email outreach.
        </p>
      </section>

      {/* Data */}
      <section className="card space-y-2 p-4">
        <h2 className="text-sm font-extrabold">Your data</h2>
        <p className="text-sm text-muted">
          Everything is stored in this browser (localStorage) — free, private, no account.
          Clearing browser data clears the app too.
        </p>
        <button className="btn text-xs text-accent" onClick={clearAll}>
          Erase all app data
        </button>
      </section>
    </div>
  );
}
