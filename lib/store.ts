"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_TEMPLATE, Deal, OfferedTime, Settings, Stage } from "./types";

const DEALS_KEY = "nyfoodies.deals.v1";
const SETTINGS_KEY = "nyfoodies.settings.v1";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("nyfoodies:store", { detail: key }));
  } catch {
    // storage full / private mode — nothing sensible to do
  }
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Deals store, persisted to localStorage and synced across pages/tabs. */
export function useDeals() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setDeals(readJson<Deal[]>(DEALS_KEY, []));
    setLoaded(true);
    const onChange = () => setDeals(readJson<Deal[]>(DEALS_KEY, []));
    window.addEventListener("nyfoodies:store", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("nyfoodies:store", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const save = useCallback((next: Deal[]) => {
    setDeals(next);
    writeJson(DEALS_KEY, next);
  }, []);

  const addDeal = useCallback(
    (deal: Omit<Deal, "id" | "createdAt" | "updatedAt" | "offeredTimes" | "stage"> & { stage?: Stage }) => {
      const now = Date.now();
      const full: Deal = {
        offeredTimes: [],
        stage: deal.stage ?? "to_contact",
        ...deal,
        id: uid(),
        createdAt: now,
        updatedAt: now,
      };
      save([full, ...readJson<Deal[]>(DEALS_KEY, [])]);
      return full;
    },
    [save]
  );

  const updateDeal = useCallback(
    (id: string, patch: Partial<Deal>) => {
      const current = readJson<Deal[]>(DEALS_KEY, []);
      save(
        current.map((d) => {
          if (d.id !== id) return d;
          const next = { ...d, ...patch, updatedAt: Date.now() };
          if (patch.stage && patch.stage !== d.stage) {
            if (patch.stage === "contacted" && !next.contactedAt) next.contactedAt = Date.now();
            if (patch.stage === "responded" && !next.respondedAt) next.respondedAt = Date.now();
            if (patch.stage === "accepted" && !next.acceptedAt) next.acceptedAt = Date.now();
          }
          return next;
        })
      );
    },
    [save]
  );

  const removeDeal = useCallback(
    (id: string) => {
      save(readJson<Deal[]>(DEALS_KEY, []).filter((d) => d.id !== id));
    },
    [save]
  );

  const addOfferedTime = useCallback(
    (dealId: string, when: string, note?: string) => {
      const time: OfferedTime = { id: uid(), when, note };
      const current = readJson<Deal[]>(DEALS_KEY, []);
      save(
        current.map((d) =>
          d.id === dealId
            ? { ...d, offeredTimes: [...d.offeredTimes, time], updatedAt: Date.now() }
            : d
        )
      );
    },
    [save]
  );

  const removeOfferedTime = useCallback(
    (dealId: string, timeId: string) => {
      const current = readJson<Deal[]>(DEALS_KEY, []);
      save(
        current.map((d) =>
          d.id === dealId
            ? { ...d, offeredTimes: d.offeredTimes.filter((t) => t.id !== timeId), updatedAt: Date.now() }
            : d
        )
      );
    },
    [save]
  );

  return { deals, loaded, addDeal, updateDeal, removeDeal, addOfferedTime, removeOfferedTime };
}

export function useSettings() {
  const fallback: Settings = { template: DEFAULT_TEMPLATE };
  const [settings, setSettings] = useState<Settings>(fallback);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSettings(readJson<Settings>(SETTINGS_KEY, fallback));
    setLoaded(true);
    const onChange = () => setSettings(readJson<Settings>(SETTINGS_KEY, fallback));
    window.addEventListener("nyfoodies:store", onChange);
    return () => window.removeEventListener("nyfoodies:store", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    const current = readJson<Settings>(SETTINGS_KEY, { template: DEFAULT_TEMPLATE });
    const next = { ...current, ...patch };
    setSettings(next);
    writeJson(SETTINGS_KEY, next);
  }, []);

  return { settings, loaded, update };
}

/** Fill the pitch template for a given place name. */
export function fillTemplate(template: string, name: string): string {
  return template.replaceAll("{name}", name);
}
