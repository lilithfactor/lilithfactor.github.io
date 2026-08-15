/* ============================================================================
 * THE WEATHER — what it is doing outside the window, actually.
 *
 * THE ONE RUNTIME FETCH IN THIS PROJECT, and it is worth saying why that is
 * allowed here when architecture.md Directive 1 says content comes through the
 * build-time proxy.
 *
 * This is not content. Content is what the portfolio says about Pranav, it
 * lives in Notion, it is reviewed, and it must be in the HTML for a crawler and
 * for someone with no JavaScript. The weather is none of those things: it is
 * the room's ambience, it is true only for the next few minutes, and if it
 * never arrives the desk is exactly as complete as it was before. Baking it at
 * build time would mean a deploy every half hour to keep a cloud up to date.
 *
 * WHOSE WEATHER: the visitor's, worked out from their IP, falling back to the
 * desk's own city when that fails.
 *
 * Be clear about the trade, because it is a real one. This asks a third party
 * (ipwho.is, then get.geojs.io) what city an IP is in, which means the
 * visitor's address reaches a company neither of us has a contract with. It is
 * the same exchange every CDN-hosted analytics script makes and a smaller one
 * than asking the browser's Geolocation API, which prompts and returns a
 * street rather than a city. No prompt appears, nothing is stored beyond the
 * session, and the result is used only to choose which of six paper skies to
 * cut. City-level accuracy is all this needs — a window does not care which
 * suburb you are in — and if either lookup fails the desk simply shows the
 * weather where it lives.
 *
 * Neither service needs an API key and both send
 * `access-control-allow-origin: *`, which is what makes any of this possible
 * from a static page. Same for Open-Meteo, whose free tier is non-commercial
 * with a daily ceiling far above what a portfolio generates. Everything is
 * cached for the session on top.
 * ========================================================================== */

/** Where the desk lives. The fallback when an IP says nothing useful. */
export const PLACE = { latitude: 12.97, longitude: 77.59, name: "Bengaluru" };

interface Place {
  latitude: number;
  longitude: number;
  name: string;
}

const PLACE_CACHE = "desk-place";

/**
 * City from IP, best effort.
 *
 * Two providers because free tiers fail in the most annoying way available:
 * ipapi.co answers 429 with a perfectly valid-looking JSON body telling you to
 * buy a plan, so "it returned 200-ish JSON" is not proof of anything. Each
 * response is checked for actual numbers before it is believed.
 */
async function locate(): Promise<Place> {
  try {
    const raw = sessionStorage.getItem(PLACE_CACHE);
    if (raw) return JSON.parse(raw) as Place;
  } catch {
    /* private mode */
  }

  const sources: Array<{ url: string; read: (d: any) => Place | null }> = [
    {
      url: "https://ipwho.is/",
      read: (d: { success?: boolean; latitude?: number; longitude?: number; city?: string }) =>
        d?.success && typeof d.latitude === "number"
          ? { latitude: d.latitude, longitude: d.longitude as number, name: d.city ?? "" }
          : null,
    },
    {
      url: "https://get.geojs.io/v1/ip/geo.json",
      // geojs sends latitude and longitude as STRINGS, which is exactly the
      // kind of thing that silently produces NaN two functions later.
      read: (d: { latitude?: string; longitude?: string; city?: string }) => {
        const lat = Number(d?.latitude);
        const lon = Number(d?.longitude);
        return Number.isFinite(lat) && Number.isFinite(lon)
          ? { latitude: lat, longitude: lon, name: d.city ?? "" }
          : null;
      },
    },
  ];

  for (const source of sources) {
    try {
      const response = await fetch(source.url, { mode: "cors" });
      if (!response.ok) continue;
      const place = source.read(await response.json());
      if (!place) continue;
      try {
        sessionStorage.setItem(PLACE_CACHE, JSON.stringify(place));
      } catch {
        /* private mode */
      }
      return place;
    } catch {
      // Offline, blocked by a tracker blocker (very likely for this kind of
      // endpoint), or simply down. Try the next one, then give up quietly.
    }
  }
  return PLACE;
}

export type Sky = "clear" | "cloud" | "rain" | "storm" | "snow" | "fog";

export interface Weather {
  readonly sky: Sky;
  /** True if it is daylight THERE, which is the honest answer for his desk. */
  readonly day: boolean;
  readonly celsius: number;
}

const CACHE = "desk-weather";
const MAX_AGE = 30 * 60 * 1000;
// Two round trips in series (locate, then weather), so the deadline covers
// both. The desk builds without it if it runs out.
const DEADLINE = 4000;

/**
 * WMO weather codes → the six skies this window knows how to draw.
 *
 * The full table has 28 entries and the window has one sheet of card, so the
 * mapping is deliberately coarse: what changes on screen is the tone of the sky
 * and whether there is rain on it, and no visitor will ever tell "light drizzle"
 * from "moderate drizzle" through a 30cm paper window.
 */
function toSky(code: number): Sky {
  if (code === 0 || code === 1) return "clear";
  if (code === 2 || code === 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 85 && code <= 86) return "snow";
  if (code >= 95) return "storm";
  if (code >= 51) return "rain";
  return "cloud";
}

function cached(): Weather | null {
  try {
    const raw = sessionStorage.getItem(CACHE);
    if (!raw) return null;
    const { at, value } = JSON.parse(raw) as { at: number; value: Weather };
    return Date.now() - at < MAX_AGE ? value : null;
  } catch {
    return null;
  }
}

/**
 * Starts the request immediately and returns a promise that always resolves.
 *
 * Called at the very top of the desk mount so the round trip overlaps the model
 * loading that follows it — by the time the window is built the answer is
 * usually already here, and if it is not, the deadline passes and the window
 * falls back to the clock. The desk never waits on the sky.
 */
export function startWeather(): Promise<Weather | null> {
  const hit = cached();
  if (hit) return Promise.resolve(hit);

  const request = locate()
    .then((place) => {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}` +
        `&longitude=${place.longitude}&current=weather_code,temperature_2m,is_day`;
      return fetch(url, { mode: "cors", cache: "no-store" });
    })
    .then((r) => (r.ok ? r.json() : null))
    .then((data: { current?: { weather_code: number; temperature_2m: number; is_day: number } } | null) => {
      const now = data?.current;
      if (!now || typeof now.weather_code !== "number") return null;
      const value: Weather = {
        sky: toSky(now.weather_code),
        day: now.is_day === 1,
        celsius: now.temperature_2m,
      };
      try {
        sessionStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), value }));
      } catch {
        // Private mode, or a full quota. The weather still works this session.
      }
      return value;
    })
    .catch(() => null);

  // Offline, blocked by an extension, rate-limited, or simply slow: the window
  // is scenery and must never hold the scene up for it.
  return Promise.race([
    request,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), DEADLINE)),
  ]);
}
