/**
 * Parse OSM `opening_hours` strings into per-day, am/pm-formatted schedules.
 * Handles the common grammar ("Mo-Fr 11:00-22:00; Sa,Su 12:00-23:00", "24/7",
 * "off"). Exotic rules (months, holidays) return null — better to show
 * nothing than military time or wrong hours.
 */

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const OSM_DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** "22:30" → "10:30pm", "11:00" → "11am", "00:00"/"24:00" → "12am". */
export function to12h(hhmm: string): string | null {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2];
  if (h === 24) h = 0;
  if (h > 24) return null;
  const suffix = h >= 12 ? "pm" : "am";
  let display = h % 12;
  if (display === 0) display = 12;
  return min === "00" ? `${display}${suffix}` : `${display}:${min}${suffix}`;
}

function timeRangeTo12h(range: string): string | null {
  const parts = range.split("-");
  if (parts.length !== 2) return null;
  const a = to12h(parts[0].trim());
  const b = to12h(parts[1].trim());
  return a && b ? `${a}–${b}` : null;
}

function expandDays(spec: string): number[] | null {
  const out = new Set<number>();
  for (const part of spec.split(",")) {
    const p = part.trim();
    const range = p.match(/^([A-Z][a-z])-([A-Z][a-z])$/);
    if (range) {
      const a = OSM_DAYS.indexOf(range[1]);
      const b = OSM_DAYS.indexOf(range[2]);
      if (a === -1 || b === -1) return null;
      for (let i = a; ; i = (i + 1) % 7) {
        out.add(i);
        if (i === b) break;
      }
    } else {
      const idx = OSM_DAYS.indexOf(p);
      if (idx === -1) return null;
      out.add(idx);
    }
  }
  return [...out];
}

/** Per-day schedule, index 0 = Monday. null = couldn't parse. */
export function parseOpeningHours(raw: string): string[] | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed === "24/7") return Array(7).fill("Open 24 hours");

  const days: string[] = Array(7).fill("Closed");
  let matchedAny = false;

  for (const ruleRaw of trimmed.split(";")) {
    const rule = ruleRaw.trim().replace(/,\s*$/, "");
    if (!rule) continue;
    // "PH off" and similar holiday rules — ignore silently
    if (/^(PH|SH)\b/.test(rule)) continue;

    const m = rule.match(/^([A-Za-z,\- ]+?)\s+(.+)$/);
    let daySpec: string;
    let timeSpec: string;
    if (m && /^[A-Z][a-z]/.test(m[1].trim())) {
      daySpec = m[1].trim().replace(/\s/g, "");
      timeSpec = m[2].trim();
    } else if (/^\d/.test(rule)) {
      daySpec = "Mo-Su";
      timeSpec = rule;
    } else {
      return null; // months/weeks/unknown grammar
    }

    const dayIdxs = expandDays(daySpec);
    if (!dayIdxs) return null;

    let text: string;
    if (/^(off|closed)$/i.test(timeSpec)) {
      text = "Closed";
    } else {
      const ranges = timeSpec.split(",").map((r) => timeRangeTo12h(r.trim()));
      if (ranges.some((r) => r == null)) return null;
      text = ranges.join(", ");
    }
    for (const d of dayIdxs) days[d] = text;
    matchedAny = true;
  }

  return matchedAny ? days : null;
}

/** Today's line, e.g. "Open today · 5pm–11pm" / "Closed today". */
export function todayHours(raw: string): string | null {
  const parsed = parseOpeningHours(raw);
  if (!parsed) return null;
  const jsDay = new Date().getDay(); // 0 = Sunday
  const idx = (jsDay + 6) % 7; // → 0 = Monday
  const text = parsed[idx];
  return text === "Closed" ? "Closed today" : `Today · ${text}`;
}
