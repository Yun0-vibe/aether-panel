/**
 * Brand asset generator for Aether Panel.
 * Rasterizes the logo mark + wordmark into PNGs without any image library:
 * raw pixel compositing + a built-in 5x7 bitmap font + zlib PNG encoding.
 *
 *   node scripts/brand-gen.mjs
 *
 * Outputs (panel/client/public/): favicon-512.png, apple-touch-icon.png, og.png
 */
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "panel", "client", "public");
fs.mkdirSync(outDir, { recursive: true });

// ------------------------------------------------------------------ png io

function crc32(buf) {
  let table = crc32.t;
  if (!table) {
    table = crc32.t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// rows: array of Uint8ClampedArray RGB; writes 8-bit RGB PNG (no alpha)
function encodePNG(rows, width, height) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    Buffer.from(rows[y].buffer, rows[y].byteOffset, width * 3).copy(raw, y * (width * 3 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ drawing

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.rows = Array.from({ length: h }, () => new Uint8ClampedArray(w * 3));
  }
  set(x, y, r, g, b) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = x * 3; // rows[y] is per-row; index within the row
    this.rows[y][i] = r;
    this.rows[y][i + 1] = g;
    this.rows[y][i + 2] = b;
  }
  blend(x, y, r, g, b, a) {
    if (a >= 1) return this.set(x, y, r, g, b);
    if (a <= 0) return;
    const i = x * 3;
    this.rows[y][i] = this.rows[y][i] * (1 - a) + r * a;
    this.rows[y][i + 1] = this.rows[y][i + 1] * (1 - a) + g * a;
    this.rows[y][i + 2] = this.rows[y][i + 2] * (1 - a) + b * a;
  }
}

// paints the app tile described by public/favicon.svg into a CSS-space box
function paintMark(c, x0, y0, size) {
  const rand = mulberry32(7);
  const s = size / 64;
  for (let y = Math.floor(y0); y < Math.ceil(y0 + size); y++) {
    for (let x = Math.floor(x0); x < Math.ceil(x0 + size); x++) {
      const u = (x - x0 + 0.5) / s - 0.5; // svg viewBox coords (0..64)
      const v = (y - y0 + 0.5) / s - 0.5;
      // rounded rect background (r=14)
      const rX = Math.min(u, 64 - u);
      const rY = Math.min(v, 64 - v);
      const corner = 14;
      const dx = corner - Math.min(rX, 64 - corner ? rX : rX),
        dxc = Math.max(0, corner - rX),
        dyc = Math.max(0, corner - rY);
      const cornerD = Math.sqrt(dxc * dxc + dyc * dyc);
      const inBg = cornerD <= corner - 0.5 || rX <= 64 - corner || true; // rect interior + corners
      const bgIn = u >= -0.5 && u <= 64.5 && v >= -0.5 && v <= 64.5 && cornerD <= corner + 0.5;
      if (!bgIn) continue;
      const bgT = (u + v) / (64 + 64);
      // dither the diagonal gradient slightly for a material look
      const d = (rand() - 0.5) * 4;
      const bg = [
        12 + (21 - 12) * bgT + d,
        20 + (35 - 20) * bgT + d,
        36 + (68 - 36) * bgT + d,
      ];
      c.blend(x, y, bg[0], bg[1], bg[2], 0.4); // panel bg over page black
      // A-mark: chevron triangle with feet y=55
      const markY1 = 55,
        markY0 = 9,
        apexX = 32;
      const legOuter = ((55 - markY0) / 53) * 21; // x extents at height h from apex
      const inTriangle = v >= markY0 && v <= markY1 && Math.abs(u - apexX) <= 21 + 0.5 && Math.abs(u - apexX) <= (v - markY0) * (21 / 53) + 1.2;
      const innerLeg = Math.max(0, (21 - 8.5) * ((v - markY0) / 53)); // inner cut start
      const crossbar = v >= 41 && v <= 45.5 && Math.abs(u - apexX) <= 11;
      const t = (v - markY0) / (markY1 - markY0);
      const mk = [124 - 66 * t, 240 - 63 * t, 255 - 119 * t];
      if (inTriangle) {
        const slope = (21 / 53) * (v - markY0) + 0.8;
        const inCut = Math.abs(u - apexX) <= slope - 21 + 29.5 && !crossbar && Math.abs(u - apexX) >= slope - 21 && v > markY0 + 26;
        if (!inCut || crossbar) c.blend(x, y, mk[0], mk[1], mk[2], 0.9);
      }
    }
  }
}

// 5x7 pixel font (subset needed by the brand copy)
const FONT = {
  A: "01110 10001 10001 11111 10001 10001 10001",
  E: "11111 10000 10000 11110 10000 10000 11111",
  T: "11111 00100 00100 00100 00100 00100 00100",
  H: "10001 10001 10001 11111 10001 10001 10001",
  R: "11110 10001 10001 11110 10100 10010 10001",
  P: "11111 10001 10001 11111 10000 10000 10000",
  N: "10001 11001 10101 10011 10001 10001 10001",
  L: "10000 10000 10000 10000 10000 10000 11111",
  G: "11111 10000 10000 10011 10001 10001 11111",
  M: "10001 11011 10101 10101 10001 10001 10001",
  S: "11111 10000 10000 11111 00001 00001 11111",
  V: "10001 10001 10001 10001 10001 01010 00100",
  D: "11110 10001 10001 10001 10001 10001 11110",
  U: "10001 10001 10001 10001 10001 10001 11110",
  O: "01110 10001 10001 10001 10001 10001 01110",
  I: "11111 00100 00100 00100 00100 00100 11111",
  C: "11111 10001 10000 10000 10000 10001 11111",
  K: "10001 10010 10100 11000 10100 10010 10001",
  W: "10001 10001 10001 10101 10101 10101 01010",
  Y: "10001 10001 01010 00100 00100 00100 00100",
  B: "11110 10001 10001 11110 10001 10001 11110",
  F: "11111 10000 10000 11110 10000 10000 10000",
  ",": "00000 00000 00000 00000 00110 00110 01000",
  ".": "00000 00000 00000 00000 00000 01100 01100",
  "-": "00000 00000 00000 11111 00000 00000 00000",
  "/": "00001 00010 00010 00100 01000 01000 10000",
  "!": "00100 00100 00100 00100 00100 00000 00100",
};

function drawText(c, text, x, y, scale, rgb) {
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const rows = FONT[ch] ?? FONT[ch === " " ? " " : ch]?.split?.(" ");
    if (!rows) {
      cx += scale * 3;
      continue;
    }
    const map = (FONT[ch] ?? "").split(" ");
    for (let py = 0; py < 7; py++) {
      for (let px = 0; px < 5; px++) {
        if (map[py]?.[px] === "1") {
          for (let sy = 0; sy < scale; sy++)
            for (let sx = 0; sx < scale; sx++)
              c.set(cx + px * scale + sx, y + py * scale + sy, rgb[0], rgb[1], rgb[2]);
        }
      }
    }
    cx += scale * 6; // 5 px glyph + 1 px spacing
  }
}

function drawMarkBox(c, x0, y0, size) {
  const rand = mulberry32(11);
  const s = size / 64;
  for (let y = Math.floor(y0 - 1); y <= y0 + size + 1; y++) {
    for (let x = Math.floor(x0 - 1); x <= x0 + size + 1; x++) {
      const u = (x - x0 + 0.5) / s;
      const v = (y - y0 + 0.5) / s;
      const dx = Math.min(u, 64 - u) >= 14 ? 0 : 14 - Math.min(u, 64 - u);
      const dy = Math.min(v, 64 - v) >= 14 ? 0 : 14 - Math.min(v, 64 - v);
      const cornerD = Math.sqrt(dx * dx + dy * dy);
      if (cornerD > 14 + 0.7 || u < -0.7 || u > 64.7 || v < -0.7 || v > 64.7) continue;
      const aa = Math.max(0, Math.min(1, 15 - cornerD));
      const t = (u + v) / 128;
      const d = (rand() - 0.5) * 3;
      const bg = [12 + (21 - 12) * t + d, 20 + (35 - 20) * t + d, 36 + (68 - 36) * t + d];
      c.blend(x, y, bg[0], bg[1], bg[2], aa);
      // chevron: apex (32,9), feet (11,55) & (53,55), thickness via inner slope
      if (v >= 9 - 0.7 && v <= 55 + 0.7) {
        const wOuter = (v - 9) * (21 / 46);
        const wInner = Math.max(0, wOuter - 10.5 * s ? wOuter - 10.5 : wOuter - 10.5);
        const inOuter = Math.abs(u - 32) <= wOuter + 0.4;
        const inInner = Math.abs(u - 32) < wOuter - 10.5 && v > 22;
        const crossbar = v >= 41 && v <= 45.5 && Math.abs(u - 32) <= 11.5;
        if (crossbar || (inOuter && !inInner) || v < 22) {
          const t2 = (v - 9) / 46;
          const mk = [124 - 66 * t2, 240 - 63 * t2, 255 - 119 * t2];
          c.blend(x, y, mk[0], mk[1], mk[2], aa);
        }
      }
    }
  }
}

function fbmNoise(w, h) {
  const rand = mulberry32(23);
  const g = [];
  for (let y = 0; y < h; y++) {
    g.push(Array.from({ length: w }, () => rand()));
  }
  return g;
}

function paintBackground(c) {
  const noise = fbmNoise(c.w, 16);
  for (let y = 0; y < c.h; y++) {
    // vertical page gradient: #0a1120 → #12203c
    const t = y / c.h;
    const rr = 10 + 18 * t;
    const gg = 17 + 32 * t;
    const bb = 32 + 60 * t;
    // soft horizontal "aurora" band around the mark baseline
    for (let x = 0; x < c.w; x++) {
      const band = Math.max(0, 1 - Math.abs(y - c.h * 0.55) / (c.h * 0.35)) *
        (0.06 + 0.05 * Math.sin(x * 0.006 + y * 0.01));
      c.set(x, y, rr + band * 20, gg + band * 70, bb + band * 120);
    }
  }
}

// og banner 1200x630
function makeOG() {
  const c = new Canvas(1200, 630);
  paintBackground(c);
  drawMarkBox(c, 84, 210, 248);
  drawText(c, "AETHER", 380, 208, 15, [226, 232, 240]);
  drawText(c, "PANEL", 380, 344, 15, [56, 189, 248]);
  drawText(c, "GAME SERVERS, HANDLED.", 383, 492, 6, [148, 163, 184]);
  return encodePNG(c.rows, c.w, c.h);
}

// square icon (favicon-512 / apple-touch 180)
function makeSquare(size) {
  const c = new Canvas(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const t = (x + y) / (size * 2);
      c.set(x, y, 12 + 9 * t, 20 + 15 * t, 36 + 32 * t);
    }
  drawMarkBox(c, size * 0.08, size * 0.08, size * 0.84);
  return encodePNG(c.rows, size, size);
}

fs.writeFileSync(path.join(outDir, "og.png"), makeOG());
fs.writeFileSync(path.join(outDir, "favicon-512.png"), makeSquare(512));
fs.writeFileSync(path.join(outDir, "favicon-192.png"), makeSquare(192));
fs.writeFileSync(path.join(outDir, "apple-touch-icon.png"), makeSquare(180));
for (const f of ["og.png", "favicon-512.png", "favicon-192.png", "apple-touch-icon.png"]) {
  const kb = (fs.statSync(path.join(outDir, f)).size / 1024).toFixed(1);
  console.log(`wrote ${f} (${kb} kB)`);
}
