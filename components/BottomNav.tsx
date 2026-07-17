"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Search", icon: "🔍" },
  { href: "/pipeline", label: "Pipeline", icon: "📊" },
  { href: "/pitches", label: "Pitches", icon: "📝" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(120,80,50,0.08)] backdrop-blur">
      <div className="mx-auto flex max-w-2xl px-2 py-1.5">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`mx-0.5 flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-bold transition-colors ${
                active ? "bg-accent-soft text-accent" : "text-muted"
              }`}
            >
              <span className={`text-xl leading-none ${active ? "" : "grayscale opacity-60"}`}>
                {t.icon}
              </span>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
