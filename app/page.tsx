"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useDeals } from "@/lib/store";
import { STAGES } from "@/lib/types";

interface IgProfile {
  username: string;
  name?: string;
  profile_picture_url?: string;
  followers_count?: number;
  media_count?: number;
}

interface IgMedia {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  like_count?: number;
  comments_count?: number;
}

interface IgState {
  configured: boolean;
  connected: boolean;
  profile?: IgProfile;
  media?: IgMedia[];
  error?: string;
}

export default function Dashboard() {
  const { deals, loaded } = useDeals();
  const [ig, setIg] = useState<IgState | null>(null);

  useEffect(() => {
    fetch("/api/instagram/me")
      .then((r) => r.json())
      .then(setIg)
      .catch(() => setIg({ configured: false, connected: false }));
  }, []);

  const counts = Object.fromEntries(
    STAGES.map((s) => [s.id, deals.filter((d) => d.stage === s.id).length])
  );

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <h1 className="text-2xl font-bold tracking-tight">Welcome back 🍜</h1>
        <p className="mt-1 text-sm text-muted">
          Find restaurants &amp; bars, pitch them on Instagram, and track every collab
          from first DM to booked visit.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/search" className="btn btn-primary">
            🔍 Find places
          </Link>
          <Link href="/pipeline" className="btn">
            📋 Open pipeline
          </Link>
        </div>
      </section>

      {/* Pipeline snapshot */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
          Pipeline snapshot
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {STAGES.map((s) => (
            <Link
              key={s.id}
              href="/pipeline"
              className="card p-4 transition-transform hover:-translate-y-0.5"
            >
              <div className="text-2xl font-bold">{loaded ? counts[s.id] : "–"}</div>
              <div className="text-xs font-medium text-muted">{s.label}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Instagram */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
          Your Instagram
        </h2>
        {!ig ? (
          <div className="card p-6 text-sm text-muted">Checking Instagram connection…</div>
        ) : ig.connected && ig.profile ? (
          <div className="card p-6">
            <div className="flex items-center gap-4">
              {ig.profile.profile_picture_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ig.profile.profile_picture_url}
                  alt={ig.profile.username}
                  className="h-16 w-16 rounded-full border border-border object-cover"
                />
              )}
              <div className="flex-1">
                <div className="font-bold">@{ig.profile.username}</div>
                {ig.profile.name && <div className="text-sm text-muted">{ig.profile.name}</div>}
                <div className="mt-1 flex gap-4 text-sm">
                  <span>
                    <b>{ig.profile.followers_count?.toLocaleString() ?? "—"}</b>{" "}
                    <span className="text-muted">followers</span>
                  </span>
                  <span>
                    <b>{ig.profile.media_count?.toLocaleString() ?? "—"}</b>{" "}
                    <span className="text-muted">posts</span>
                  </span>
                </div>
              </div>
              <form action="/api/instagram/logout" method="post">
                <button className="btn btn-ghost text-xs text-muted">Disconnect</button>
              </form>
            </div>
            {ig.media && ig.media.length > 0 && (
              <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {ig.media.map((m) => (
                  <a
                    key={m.id}
                    href={m.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative block aspect-square overflow-hidden rounded-lg border border-border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.media_type === "VIDEO" ? m.thumbnail_url ?? m.media_url : m.media_url}
                      alt={m.caption?.slice(0, 60) ?? "post"}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                    {(m.like_count != null || m.comments_count != null) && (
                      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        ❤️ {m.like_count ?? 0} 💬 {m.comments_count ?? 0}
                      </span>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>
        ) : ig.configured ? (
          <div className="card flex flex-col items-start gap-3 p-6">
            <p className="text-sm text-muted">
              Connect your Instagram professional account to pull your profile stats and
              recent posts — handy proof when you pitch restaurants.
              {ig.error && <span className="mt-1 block text-accent">{ig.error}</span>}
            </p>
            <a href="/api/instagram/login" className="btn btn-primary">
              📸 Connect Instagram
            </a>
          </div>
        ) : (
          <div className="card p-6 text-sm">
            <p className="font-medium">Instagram isn&apos;t configured yet (5-minute, free setup)</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
              <li>
                Make sure your Instagram account is a free <b>Professional</b> account
                (Creator or Business) — switch in Instagram Settings.
              </li>
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
                and add the <b>Instagram</b> product → &ldquo;API setup with Instagram login&rdquo;.
              </li>
              <li>
                Add <code className="rounded bg-accent-soft px-1">YOUR_APP_URL/api/instagram/callback</code>{" "}
                as a redirect URI.
              </li>
              <li>
                Copy the Instagram App ID &amp; Secret into <code className="rounded bg-accent-soft px-1">.env.local</code>{" "}
                (see <code className="rounded bg-accent-soft px-1">.env.example</code>) and restart the app.
              </li>
            </ol>
            <p className="mt-2 text-muted">
              Everything else in the app works without this — connecting Instagram just adds
              your live profile &amp; posts here.
            </p>
          </div>
        )}
      </section>

      {/* How DMs work */}
      <section className="card p-6 text-sm">
        <h2 className="font-semibold">How DMing works here</h2>
        <p className="mt-1 text-muted">
          Instagram doesn&apos;t allow apps to auto-send cold DMs (accounts get banned for it).
          Instead, each place in your pipeline has a <b>DM button</b> that copies your pitch
          template and opens their Instagram thread — you just paste and hit send. The
          pipeline then tracks who you&apos;ve contacted, who replied, who accepted, and the
          visit times they offered.
        </p>
      </section>
    </div>
  );
}
