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
 * WHOSE WEATHER: Pranav's, not the visitor's. It is his desk. That also means
 * no geolocation prompt, no IP lookup, and nothing about the visitor leaving
 * their machine — the request carries a fixed latitude and longitude and asks
 * about a place, not a person.
 *
 * Open-Meteo needs no API key and sends `access-control-allow-origin: *`, which
 * is why this is possible from a static page at all. Free tier is
 * non-commercial with a daily call ceiling well above anything a portfolio
 * generates; the response is cached for half an hour per session on top.
 * ========================================================================== */

/** Where the desk is. Change this and the sky changes with it. */
export const PLACE = { latitude: 12.97, longitude: 77.59, name: "Bengaluru" };

export type Sky = "clear" | "cloud" | "rain" | "storm" | "snow" | "fog";

export interface Weather {
  readonly sky: Sky;
  /** True if it is daylight THERE, which is the honest answer for his desk. */
  readonly day: boolean;
  readonly celsius: number;
}

const CACHE = "desk-weather";
const MAX_AGE = 30 * 60 * 1000;
const DEADLINE = 2500;

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

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${PLACE.latitude}` +
    `&longitude=${PLACE.longitude}&current=weather_code,temperature_2m,is_day`;

  const request = fetch(url, { mode: "cors", cache: "no-store" })
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
