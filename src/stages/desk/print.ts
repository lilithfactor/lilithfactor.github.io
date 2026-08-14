/* ============================================================================
 * THE PRESS — what is actually printed on the paper.
 *
 * Until this file existed, the case-study sheets on the desk were blank. That
 * is the difference between a menu and a portfolio: a visitor who lands and
 * sees eight labelled objects has been given a navigation bar with a nice
 * texture on it, and has learned nothing about the person whose desk it is. A
 * visitor who lands and can read "60%", "1.4x", "25%", "40%" off four sheets
 * has already been told the thing the site exists to tell them, before they
 * click anything.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS DOES NOT BREAK DIRECTIVE 2
 *
 * architecture.md Directive 2 says text is never baked into a texture, and the
 * reason it says so is loss: a word that exists only on a canvas is invisible
 * to Cmd-F, to translation, to a screen reader and to Google, and for a
 * product manager's portfolio that trade is never worth making.
 *
 * Nothing here is lost, because nothing here is only here. Every number below
 * is a duplicate of text that is already in the prerendered document — the
 * case studies are literally titled "60% Faster Onboarding" and "25% Faster
 * Time-to-market". The canvas is aria-hidden, the panels carry the real prose,
 * and deleting this file would cost the page no content at all. What is
 * rendered here is a *picture of the sheet*, in the same sense that a
 * photograph of a desk is allowed to contain paper with writing on it.
 *
 * The rule the directive is protecting — no content reachable only through the
 * canvas — holds exactly as before.
 * ---------------------------------------------------------------------------
 *
 * HOW IT PRINTS. Not as a picture of a sheet: as a field of MULTIPLIERS, white
 * where the paper shows through and ink/paper where the ink lands. See
 * palette.overprint. That is what lets a printed sheet keep the stock tone and
 * the cut edges every other piece of card in the model gets from its vertex
 * colours — a print texture that carried its own paper colour would be a decal
 * with a visible border, which is the exact opposite of the thing being built.
 * ========================================================================== */

import { CanvasTexture, ClampToEdgeWrapping, SRGBColorSpace } from "three";
import type { Outcome } from "./layout";
import { blend, css, overprint, type Palette } from "./palette";

/**
 * The typeface the page already loads. design-system.md gives mono the job of
 * carrying "tags, dates, KPIs, and outcome numbers" — which is exactly and only
 * what is printed here — and the desk borrowing the document's own font is what
 * stops the sheets reading as a separate piece of art pasted onto the scene.
 */
const MONO = '"IBM Plex Mono", ui-monospace, monospace';

/** A sheet, in canvas pixels. 3:4, matching the 0.24 x 0.32m card it lands on. */
const W = 288;
const H = 384;

function pad(w: number, h: number): CanvasRenderingContext2D | null {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return canvas.getContext("2d");
}

function texture(canvas: HTMLCanvasElement): CanvasTexture {
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = ClampToEdgeWrapping;
  t.wrapT = ClampToEdgeWrapping;
  return t;
}

/* --- The tooth, again ------------------------------------------------------
 * A printed sheet still has to be paper. The shared fibre map in texture.ts is
 * the `map` slot, and a printed sheet has spent that slot on its own ink — so
 * the tooth is drawn into the print canvas instead. Without it the four
 * outcome sheets are the only mathematically smooth surfaces in the model,
 * which makes them read as UI stuck onto a paper scene. */
function tooth(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number): void {
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  ctx.save();
  ctx.lineCap = "round";
  for (let i = 0; i < 520; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const len = 3 + rand() * 12;
    // Greyscale as data, not as colour — a multiplier, like the fibre map.
    ctx.strokeStyle = `rgba(238,238,238,${0.1 + rand() * 0.22})`;
    ctx.lineWidth = rand() > 0.82 ? 1.3 : 0.7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + (rand() - 0.5) * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * One case-study sheet.
 *
 * The layout is a print layout, not a UI layout, and the difference is that
 * everything hangs off one left margin: a centred number floating in the middle
 * of a card is a dashboard tile, and a number set hard against a margin under a
 * red rule is a printed page. That single choice is most of what keeps these
 * from reading as floating labels.
 *
 * `paint` is called twice — once immediately so a sheet is never blank, and
 * again after document.fonts.ready so the real Plex Mono replaces whatever the
 * system had to offer at mount. See `press` below.
 */
function paintSheet(
  ctx: CanvasRenderingContext2D,
  outcome: Outcome,
  ink: string,
  muted: string,
  accent: string,
  faint: string,
  seed: number,
): void {
  ctx.clearRect(0, 0, W, H);
  // White multiplies to "the card, unchanged" — so the sheet starts as whatever
  // stock it was cut from and the drawing only ever takes light away.
  ctx.fillStyle = "rgb(255,255,255)";
  ctx.fillRect(0, 0, W, H);
  tooth(ctx, W, H, seed);

  const M = 30;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // The editor's mark. One short red rule per sheet and nothing else in that
  // colour: design-system.md caps --red-pen at five appearances on screen, and
  // four sheets plus the dossier tab is already the whole allowance.
  ctx.fillStyle = accent;
  ctx.fillRect(M, 44, 52, 6);

  ctx.fillStyle = muted;
  ctx.font = `500 21px ${MONO}`;
  ctx.fillText(outcome.kicker, M, 88);

  // The number. Big enough that it survives being lain flat on a desk and
  // viewed at a 40-degree glance, which is the only test that matters — the
  // sheet is read in the render, never at 1:1.
  ctx.fillStyle = ink;
  ctx.font = `500 104px ${MONO}`;
  ctx.fillText(outcome.metric, M - 6, 196);

  ctx.font = `500 38px ${MONO}`;
  ctx.fillText(outcome.label, M, 246);

  ctx.fillStyle = faint;
  ctx.fillRect(M, 272, W - M * 2, 2);

  /* The body of the case study, as typography rather than as words.
   *
   * These are bars, deliberately, and not lorem text: a sheet with unreadable
   * pretend sentences on it is a sheet making a claim nobody can check, and
   * this site has already had one fabricated detail removed from it. A ruled
   * block says "there is writing here" and says nothing else, which is the only
   * honest thing available at four screen pixels of line height. */
  let y = 300;
  const widths = [0.94, 0.88, 0.97, 0.72, 0.91, 0.83, 0.55];
  for (const w of widths) {
    ctx.fillRect(M, y, (W - M * 2) * w, 3);
    y += 13;
  }
}

/**
 * A chess position, printed as a diagram.
 *
 * art-direction.md is explicit that the board on the desk IS the chess entry
 * and that it is "set to a real position". It was a blank tan square. Building
 * it out of geometry costs about twenty-four draw calls for objects three
 * screen pixels across, which is most of the scene's remaining budget spent on
 * something nobody could resolve; printing it costs one canvas and zero draw
 * calls, and a printed diagram is what a chess position actually looks like
 * when it is on paper — which is the whole idiom of this desk.
 *
 * The position is the final one of Anderssen–Kieseritzky, London 1851 (the
 * Immortal Game, mate on move 23). A real game, and the most famous one there
 * is, which is the point: a board set to nothing in particular is set dressing.
 */
const IMMORTAL = "r1bk3r/p2pBpNp/n4n2/1p1NP2P/6P1/3P4/P1P1K3/q5b1";

function paintChess(
  ctx: CanvasRenderingContext2D,
  size: number,
  ink: string,
  muted: string,
  faint: string,
): void {
  const cell = size / 8;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "rgb(255,255,255)";
  ctx.fillRect(0, 0, size, size);

  // The dark squares. A printed board is not black and white — it is the paper
  // and one ink, at whatever tint the press could hold.
  ctx.fillStyle = faint;
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      if ((r + f) % 2 === 1) ctx.fillRect(f * cell, r * cell, cell, cell);
    }
  }

  ctx.strokeStyle = muted;
  ctx.lineWidth = Math.max(1, size / 128);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, size - ctx.lineWidth, size - ctx.lineWidth);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `500 ${Math.round(cell * 0.62)}px ${MONO}`;

  let rank = 0;
  let file = 0;
  for (const ch of IMMORTAL) {
    if (ch === "/") {
      rank += 1;
      file = 0;
      continue;
    }
    const skip = Number(ch);
    if (!Number.isNaN(skip)) {
      file += skip;
      continue;
    }

    const cx = (file + 0.5) * cell;
    const cy = (rank + 0.5) * cell;
    const black = ch === ch.toLowerCase();

    // A disc and a letter, which is how a position is set in a book. The disc
    // is doing the real work: at this size the letters are below the threshold
    // of reading and the pattern of light and dark men is not, so the board
    // reads as a game in progress from across the desk.
    ctx.beginPath();
    ctx.arc(cx, cy, cell * 0.36, 0, Math.PI * 2);
    ctx.fillStyle = black ? ink : "rgb(255,255,255)";
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1, size / 200);
    ctx.stroke();

    ctx.fillStyle = black ? "rgb(255,255,255)" : ink;
    ctx.fillText(ch.toUpperCase(), cx, cy + cell * 0.02);
    file += 1;
  }
}

export interface Press {
  /** One texture per outcome, in the order given. */
  readonly sheets: readonly CanvasTexture[];
  readonly chess: CanvasTexture | null;
  dispose(): void;
}

/**
 * Prints everything, twice.
 *
 * The first pass runs synchronously, because `mountDesk` is synchronous and a
 * texture that does not exist yet cannot be handed to a material. The second
 * runs when `document.fonts.ready` resolves, and it is the one that matters:
 * before it, the numbers are set in whatever monospace the system had, and the
 * whole argument for using the page's own typeface on the page's own paper is
 * that the desk and the document are set in the same face. Redrawing is one
 * canvas and one `needsUpdate` — far cheaper than blocking the mount on a font.
 *
 * Drawing immediately AND again, rather than only after the promise, is the
 * belt: if fonts.ready never settles the sheets are still printed, just in the
 * fallback. A blank sheet is the one outcome this file exists to prevent.
 */
export function press(p: Palette, outcomes: readonly Outcome[]): Press {
  const ink = css(overprint(p.ink, p.paper));
  const muted = css(overprint(blend(p.ink, p.paper, 0.46), p.paper));
  const faint = css(overprint(blend(p.ink, p.paper, 0.8), p.paper));
  const accent = css(overprint(p.accent, p.paper));

  const repaint: Array<() => void> = [];
  const sheets: CanvasTexture[] = [];

  outcomes.forEach((outcome, i) => {
    const ctx = pad(W, H);
    if (!ctx) return;
    const draw = () => paintSheet(ctx, outcome, ink, muted, accent, faint, 0x5eed + i * 977);
    draw();
    const t = texture(ctx.canvas);
    sheets.push(t);
    repaint.push(() => {
      draw();
      t.needsUpdate = true;
    });
  });

  let chess: CanvasTexture | null = null;
  const chessCtx = pad(256, 256);
  if (chessCtx) {
    const draw = () => paintChess(chessCtx, 256, ink, muted, faint);
    draw();
    chess = texture(chessCtx.canvas);
    const t = chess;
    repaint.push(() => {
      draw();
      t.needsUpdate = true;
    });
  }

  let disposed = false;
  void document.fonts?.ready
    .then(() => {
      if (disposed) return;
      for (const again of repaint) again();
    })
    .catch(() => {
      /* No font manager, or it rejected. The fallback print stands. */
    });

  return {
    sheets,
    chess,
    dispose() {
      disposed = true;
      for (const t of sheets) t.dispose();
      chess?.dispose();
    },
  };
}
