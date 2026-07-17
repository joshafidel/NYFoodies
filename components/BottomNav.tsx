"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function CompassIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PipelineIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="3" y="4" width="5" height="16" rx="1.5" />
      <rect x="9.5" y="4" width="5" height="11" rx="1.5" />
      <rect x="16" y="4" width="5" height="7" rx="1.5" />
    </svg>
  );
}

function PitchesIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M21 11.5a8.5 8.5 0 01-8.5 8.5c-1.2 0-2.4-.25-3.4-.7L4 21l1.7-5.1A8.5 8.5 0 1121 11.5z" />
      <path d="M8.5 10.5h7M8.5 13.5h4.5" strokeLinecap="round" />
    </svg>
  );
}

function ProfileIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20c.8-3.5 3.6-5.4 7-5.4s6.2 1.9 7 5.4" strokeLinecap="round" />
    </svg>
  );
}

const TABS = [
  { href: "/", label: "Discover", Icon: CompassIcon },
  { href: "/pipeline", label: "Pipeline", Icon: PipelineIcon },
  { href: "/pitches", label: "Pitches", Icon: PitchesIcon },
  { href: "/profile", label: "Profile", Icon: ProfileIcon },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(120,80,50,0.08)] backdrop-blur">
      <div className="mx-auto flex max-w-2xl px-2 py-1.5">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`mx-0.5 flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-bold transition-colors ${
                active ? "bg-accent-soft text-accent" : "text-muted"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
