/**
 * The soundscape.
 *
 * ONE toggle governs everything — music and effects together — and it starts
 * OFF. Every browser blocks gestureless audio anyway, but the real reason is
 * the audience: a hiring manager opening this link in an open-plan office who
 * gets ambushed by sound closes the tab and remembers why.
 * See brain/design/ux-rules.md rule 13.
 *
 * Music is an <audio> element (long, streamed, loops). Effects are decoded
 * AudioBuffers (short, fired often, need low latency) — an <audio> per effect
 * has real latency and concurrency limits.
 *
 * Nothing is fetched until sound is switched on: silent visitors pay 0 bytes.
 */

type Sfx = "paper" | "tap" | "switch";

const SFX_SRC: Record<Sfx, string> = {
  paper: "/audio/sfx-paper.opus",
  tap: "/audio/sfx-tap.opus",
  switch: "/audio/sfx-switch.opus",
};

const CRACKLE_SRC = "/audio/sfx-crackle.opus";
const STORE_KEY = "desk-sound";

/** Background music sits under reading, not over it. */
const MUSIC_VOLUME = 0.3;
const CRACKLE_VOLUME = 0.18;
const SFX_VOLUME = 0.35;

export interface Track {
  id: string;
  name: string;
  credit: string;
  src: string;
}

export interface Audio {
  readonly on: boolean;
  toggle(): Promise<void>;
  play(sfx: Sfx): void;
  next(): void;
  readonly track: Track | null;
  subscribe(fn: () => void): void;
  dispose(): void;
}

export function createAudio(tracks: readonly Track[]): Audio {
  let ctx: AudioContext | null = null;
  let buffers: Partial<Record<Sfx, AudioBuffer>> = {};
  let music: HTMLAudioElement | null = null;
  let crackle: HTMLAudioElement | null = null;
  let index = 0;
  let on = false;
  const listeners: Array<() => void> = [];
  const notify = () => listeners.forEach((f) => f());

  const context = () => (ctx ??= new AudioContext());

  async function loadSfx() {
    const c = context();
    await Promise.all(
      (Object.keys(SFX_SRC) as Sfx[]).map(async (key) => {
        if (buffers[key]) return;
        try {
          const res = await fetch(SFX_SRC[key]);
          buffers[key] = await c.decodeAudioData(await res.arrayBuffer());
        } catch {
          // A missing effect must never break the desk. Silence is the fallback.
        }
      }),
    );
  }

  function makeMusic(): HTMLAudioElement | null {
    const t = tracks[index];
    if (!t) return null;
    const el = new Audio();
    // Opus first, AAC for Safari builds without it. Same file stem.
    el.src = `${t.src}.opus`;
    el.addEventListener("error", () => {
      if (!el.src.endsWith(".m4a")) el.src = `${t.src}.m4a`;
    });
    el.loop = true;
    el.volume = MUSIC_VOLUME;
    el.preload = "auto";
    return el;
  }

  function stopAll() {
    music?.pause();
    crackle?.pause();
  }

  const onVisibility = () => {
    // Nobody should have to hunt their tabs for mystery music.
    if (document.hidden) stopAll();
    else if (on) {
      void music?.play().catch(() => {});
      void crackle?.play().catch(() => {});
    }
  };

  const api: Audio = {
    get on() {
      return on;
    },
    get track() {
      return tracks[index] ?? null;
    },

    async toggle() {
      on = !on;
      localStorage.setItem(STORE_KEY, on ? "on" : "off");

      if (!on) {
        stopAll();
        api.play("switch");
        notify();
        return;
      }

      await context().resume();
      await loadSfx();
      api.play("switch");

      music ??= makeMusic();
      // The crackle bed is what makes it sound analog rather than streamed.
      crackle ??= Object.assign(new Audio(CRACKLE_SRC), {
        loop: true,
        volume: CRACKLE_VOLUME,
      });
      await Promise.all([
        music?.play().catch(() => {}),
        crackle?.play().catch(() => {}),
      ]);
      notify();
    },

    play(sfx) {
      if (!on || !ctx) return;
      const buffer = buffers[sfx];
      if (!buffer) return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      // ±3% detune. Identical playback on the fifth click is exactly what makes
      // UI sound feel cheap; a tiny variation reads as a real object.
      source.detune.value = (Math.random() * 2 - 1) * 36;
      const gain = ctx.createGain();
      gain.gain.value = SFX_VOLUME;
      source.connect(gain).connect(ctx.destination);
      source.start();
    },

    next() {
      if (tracks.length === 0) return;
      index = (index + 1) % tracks.length;
      const wasOn = on;
      music?.pause();
      music = makeMusic();
      if (wasOn) void music?.play().catch(() => {});
      api.play("tap");
      notify();
    },

    subscribe(fn) {
      listeners.push(fn);
    },

    dispose() {
      stopAll();
      document.removeEventListener("visibilitychange", onVisibility);
      void ctx?.close();
      ctx = null;
      buffers = {};
    },
  };

  document.addEventListener("visibilitychange", onVisibility);
  // A returning visitor who turned it on still needs a gesture — browsers
  // require one and so do we. The stored value only pre-arms the label.
  if (localStorage.getItem(STORE_KEY) === "on") notify();

  return api;
}
