"use client";

import { useEffect, useRef } from "react";

// A koi pond after the one on shwn.design, written from scratch. Canvas 2D paints the pebbles and
// plants once. Each koi is a cut-out photo (public/pond/creatures.webp, see CREDITS.txt there) bent
// along its swimming spine, with a drawn translucent tail. They are drawn with their shadows into
// textures, and a last pass adds the ripples, breeze, caustics, grain and feathered edge.
// Pond units: width 1, height PH, y pointing down.

const ASPECT = 3 / 2;
const PH = 1 / ASPECT;
const GW = 192; // ripple grid, same aspect as the pond
const GH = 128;
const STEP = 1 / 90;
const DAMP = 0.986;
const TAU = Math.PI * 2;
const M = 30; // spine samples, denser toward the head
const S = Array.from({ length: M }, (_, i) => (i / (M - 1)) ** 1.35);
const ANCHOR = 0.3; // the body turns about this point
const FLOATS = 6; // x, y, u, v, part, fish
const SWIM = 0, GLIDE = 1, HOVER = 2, BURST = 3;

type Put = (x: number, y: number, u: number, v: number, part: number) => void;

// The atlas: one 768×352 row per koi, nose at the left.
const ATLAS = "/pond/koi.webp";
const ATLAS_W = 768, ATLAS_H = 1408, ATLAS_ROW = 352;

type Kind = { row: number; base: string; fin: string; len: number };
// atlas row, tail colour at the root and edge, body length (nose to tail stem)
const KINDS: Kind[] = [
  { row: 0, base: "#d9793c", fin: "#efe4d8", len: 0.22 }, // Ginrin Ochiba Shigure
  { row: 1, base: "#e9b63c", fin: "#f3cf6a", len: 0.24 }, // Karashigoi
  { row: 2, base: "#f3efe8", fin: "#f5f2ec", len: 0.21 }, // Kohaku
  { row: 3, base: "#e9e4dc", fin: "#eee8e0", len: 0.2 }, // Kujaku
];
// x, y, radius, light, base, dark
const STONES: [number, number, number, string, string, string][] = [
  [0.76, 0.2, 0.062, "#7c847d", "#646c66", "#2c332e"],
  [0.87, 0.37, 0.03, "#4f5650", "#383f3a", "#151a17"],
  [0.33, 0.44, 0.044, "#8a8568", "#6c684b", "#33311f"],
];
// x, y, direction, length, blades, spread
const GRASS: [number, number, number, number, number, number][] = [
  [0.36, -0.02, 1.45, 0.24, 8, 0.8],
  [0, 0.6, -0.4, 0.24, 9, 0.9],
  [0.96, 0.68, -2.3, 0.24, 8, 0.8],
];
const LEAF = ["#12301a", "#183a20", "#1f4626", "#0f2a16"];

type Koi = {
  id: number;
  kind: Kind;
  L: number;
  seed: number;
  x: number; // the turning point, ANCHOR along the body
  y: number;
  heading: number;
  speed: number;
  yaw: number;
  bend: number;
  mode: number;
  modeT: number;
  vT: number;
  amp: number;
  ampT: number;
  freq: number;
  freqT: number;
  phase: number;
  finPhase: number;
  depth: number; // 0 at the surface, 1 near the bed
  depthT: number;
  depthTimer: number;
  follow: number;
  followT: number;
  escape: number;
  spine: Float32Array;
};

const NOISE = `
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + 1.0), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 7.1; a *= 0.5; }
  return v;
}`;

const FISH_VERT = `#version 300 es
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec2 aUv;
layout(location = 2) in vec2 aInfo;
uniform float uPH;
uniform vec2 uShift;
uniform vec4 uQ[6];
out vec2 vUv;
flat out int vPart, vFish;
void main() {
  vPart = int(aInfo.x + 0.5);
  vFish = int(aInfo.y + 0.5);
  vUv = aUv;
  // Shadow pass only: animals nearer the surface throw their shadow further.
  vec2 p = aPos + uShift * (0.3 + 1.2 * (1.0 - uQ[vFish].y));
  gl_Position = vec4(p.x * 2.0 - 1.0, p.y / uPH * 2.0 - 1.0, 0.0, 1.0);
}`;

const FISH_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
flat in int vPart, vFish;
uniform sampler2D uAtlas;
uniform vec3 uBase[6], uFin[6];
uniform vec4 uQ[6]; // length, depth, tail phase, unused
uniform int uShadowMode;
out vec4 o;

// Seen through water: a little greener and less red the deeper they swim.
vec3 underwater(vec3 c, float depth) {
  c *= mix(vec3(1.0), vec3(0.8, 0.95, 0.92), depth);
  return mix(c, vec3(0.2, 0.32, 0.26), 0.06 + 0.3 * depth);
}

void main() {
  float depth = uQ[vFish].y;
  if (vPart == 1) {
    // Tail fin: (along the rays, across the fan). Translucent, thinning to the edge, rays catching light.
    float r = vUv.x, a = vUv.y;
    float edge = (1.0 - smoothstep(1.0 - fwidth(a) * 1.5, 1.0, abs(a))) * (1.0 - smoothstep(1.0 - fwidth(r) * 1.5, 1.0, r));
    float ray = pow(0.5 + 0.5 * cos(a * 44.0), 3.0);
    float alpha = edge * mix(0.7, 0.12, r) * (0.9 + 0.2 * ray);
    if (uShadowMode == 1) { o = vec4(alpha * 0.6); return; }
    vec3 col = mix(uBase[vFish], uFin[vFish], smoothstep(0.0, 0.4, r)) * (0.92 + 0.12 * ray);
    o = vec4(underwater(col, depth) * alpha, alpha);
    return;
  }
  // The photographed koi, cut out with premultiplied alpha.
  vec4 t = texture(uAtlas, vUv);
  if (uShadowMode == 1) { o = vec4(t.a); return; }
  o = vec4(underwater(t.rgb / max(t.a, 1e-4), depth) * t.a, t.a);
}`;

const VERT = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uBed, uFish, uShadow, uHeight;
uniform vec2 uRes, uGrid;
uniform float uTime;
out vec4 outColor;
${NOISE}

// Distance to the nearest wall between drifting cells: light focuses along the walls.
float cells(vec2 p, float t) {
  vec2 n = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(i, j);
    vec2 o = vec2(hash(n + g), hash(n + g + 19.7));
    o = 0.5 + 0.4 * sin(t * (0.5 + 0.5 * o.yx) + 6.2831 * o);
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return d2 - d1;
}

float caustic(vec2 p, float t) {
  p += (vec2(noise(p * 1.3 + t * 0.2), noise(p * 1.3 - t * 0.17 + 9.0)) - 0.5) * 0.8;
  float a = 1.0 - smoothstep(0.0, 0.45, cells(p, t));
  float b = 1.0 - smoothstep(0.0, 0.25, cells(p * 1.9 + 4.3, t * 1.3));
  return a * a * 1.1 + 0.18 * b * b;
}

// Slope of a breeze-ruffled surface: two drifting noise fields, by finite differences.
vec2 wind(vec2 p, float scale, float t) {
  vec2 q = p * scale + vec2(t * 0.35, t * 0.22), r = p * scale * 1.7 - vec2(t * 0.28, -t * 0.4);
  float e = 0.05;
  float h0 = noise(q) + 0.5 * noise(r);
  float hx = noise(q + vec2(e, 0)) + 0.5 * noise(r + vec2(e * 1.7, 0));
  float hy = noise(q + vec2(0, e)) + 0.5 * noise(r + vec2(0, e * 1.7));
  return vec2(hx - h0, hy - h0) / e;
}

void main() {
  vec2 uv = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes;
  vec2 toPond = vec2(1.0, uRes.y / uRes.x);
  vec2 p = uv * toPond;

  float h = texture(uHeight, uv).r;
  float hl = texture(uHeight, uv - vec2(uGrid.x, 0)).r, hr = texture(uHeight, uv + vec2(uGrid.x, 0)).r;
  float hu = texture(uHeight, uv - vec2(0, uGrid.y)).r, hd = texture(uHeight, uv + vec2(0, uGrid.y)).r;
  vec2 breeze = wind(p, 22.0, uTime);
  vec2 grad = vec2(hr - hl, hd - hu);
  float focus = clamp((4.0 * h - hl - hr - hu - hd) * 3.0, -0.7, 2.0);

  // The bed, seen through the moving surface.
  vec2 bedUv = uv + grad * 0.006 + breeze * 0.004;
  vec2 bp = bedUv * toPond;
  vec3 bed = mix(vec3(0.17, 0.27, 0.21), vec3(0.3, 0.42, 0.33), fbm(bp * 7.0));
  bed *= 0.86 + 0.28 * noise(bp * uRes.x * 0.45);
  vec4 deco = texture(uBed, bedUv);
  bed = bed * (1.0 - deco.a) + deco.rgb;

  float c = caustic(bp * 6.0, uTime * 0.55) * (1.0 + focus);

  // Koi shadows, already offset by depth in their own pass; soften them here.
  float sh = texture(uShadow, uv).a * 0.3;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785;
    sh += texture(uShadow, uv + vec2(cos(a), sin(a) * 1.5) * 0.006).a * 0.0875;
  }
  sh = min(sh, 1.0);

  vec3 col = bed * (0.8 + 0.45 * c * (1.0 - 0.8 * sh)) * (1.0 - 0.45 * sh);
  col += vec3(0.8, 0.92, 0.82) * c * c * 0.3 * (1.0 - sh);

  // Koi, slightly softened by the water.
  vec2 fu = uv + grad * 0.003 + breeze * 0.002, px = 0.75 / uRes;
  vec4 fish = (texture(uFish, fu + px) + texture(uFish, fu - px) + texture(uFish, fu + vec2(px.x, -px.y)) + texture(uFish, fu - vec2(px.x, -px.y))) * 0.25;
  col = col * (1.0 - fish.a) + fish.rgb * (0.85 + 0.3 * c);

  col += vec3(0.85, 0.95, 0.9) * smoothstep(0.08, 0.3, dot(grad, vec2(-0.6, -0.8))) * 0.25;
  col += (hash(gl_FragCoord.xy + fract(uTime * 7.0) * 311.0) - 0.5) * 0.07;

  // Feathered rounded edge, a little uneven.
  vec2 q = abs(gl_FragCoord.xy - 0.5 * uRes) - 0.5 * uRes + uRes.x * 0.075;
  float d = (length(max(q, 0.0)) + min(max(q.x, q.y), 0.0)) / uRes.x - 0.075;
  d += (fbm(uv * toPond * 14.0 + 3.0) - 0.5) * 0.02;
  float alpha = 1.0 - smoothstep(-0.055, 0.0, d);
  outColor = vec4(clamp(col, 0.0, 1.0) * alpha, alpha);
}`;

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const angDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const hash1 = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
function noise1(x: number) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return (hash1(i) * (1 - u) + hash1(i + 1) * u) * 2 - 1;
}
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

// Half-width of the body, as a fraction of its length: blunt round head, widest behind the gills,
// tapering to a narrow tail stem.
function halfWidth(s: number) {
  const t = Math.max(0, (0.24 - s) / 0.24);
  return 0.125 * Math.pow(1 - Math.pow(t, 2.4), 1 / 2.4) * (1 - 0.74 * smooth(0.3, 0.95, s)) * (0.9 + 0.1 * smooth(0, 0.32, s));
}
// Forked tail: short in the middle, longest just inside each lobe's edge.
function tailShape(a: number) {
  const x = Math.abs(a);
  return 0.62 + 0.38 * smooth(0, 0.8, x) - 0.2 * smooth(0.82, 1, x);
}

function stone(ctx: CanvasRenderingContext2D, W: number, rand: () => number, x: number, y: number, r: number, light: string, base: string, dark: string) {
  const rot = rand() * Math.PI, sq = 0.78 + rand() * 0.17, ph = rand() * TAU, c = Math.cos(rot), s = Math.sin(rot);
  ctx.beginPath();
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * TAU, rr = r * (1 + 0.05 * Math.sin(2 * a + ph) + 0.03 * Math.sin(3 * a - ph));
    const lx = Math.cos(a) * rr, ly = Math.sin(a) * rr * sq;
    ctx.lineTo(x + lx * c - ly * s, y + lx * s + ly * c);
  }
  ctx.closePath();
  ctx.shadowColor = "rgba(3, 12, 7, 0.6)";
  ctx.shadowBlur = r * W * 0.35;
  ctx.shadowOffsetX = r * W * 0.12;
  ctx.shadowOffsetY = r * W * 0.2;
  ctx.fillStyle = dark;
  ctx.fill();
  ctx.shadowColor = "transparent";
  const g = ctx.createRadialGradient(x - r * 0.2, y - r * 0.25, r * 0.05, x, y, r * 1.05);
  g.addColorStop(0, light);
  g.addColorStop(0.65, base);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.fill();
  const sheen = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, 0, x - r * 0.35, y - r * 0.4, r * 0.45);
  sheen.addColorStop(0, "rgba(255, 255, 255, 0.12)");
  sheen.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = sheen;
  ctx.fill();
}

function clump(ctx: CanvasRenderingContext2D, rand: () => number, x: number, y: number, angle: number, len: number, blades: number, spread: number) {
  for (let i = 0; i < blades; i++) {
    const a = angle + (rand() - 0.5) * spread, l = len * (0.55 + rand() * 0.5), bend = (rand() - 0.5) * 0.6;
    const w = len * (0.01 + rand() * 0.008) + 0.0012;
    const cx = x + Math.cos(a + bend) * l * 0.55, cy = y + Math.sin(a + bend) * l * 0.55;
    const tx = x + Math.cos(a - bend * 0.3) * l, ty = y + Math.sin(a - bend * 0.3) * l;
    const nx = -Math.sin(a) * w, ny = Math.cos(a) * w;
    ctx.fillStyle = LEAF[Math.floor(rand() * LEAF.length)];
    ctx.beginPath();
    ctx.moveTo(x + nx, y + ny);
    ctx.quadraticCurveTo(cx + nx * 0.6, cy + ny * 0.6, tx, ty);
    ctx.quadraticCurveTo(cx - nx * 0.6, cy - ny * 0.6, x - nx, y - ny);
    ctx.fill();
  }
}

function paintBed(ctx: CanvasRenderingContext2D, W: number) {
  const rand = rng(5);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(W, 0, 0, W, 0, 0);
  for (const s of STONES) stone(ctx, W, rand, ...s);
  ctx.shadowColor = "rgba(4, 14, 8, 0.45)";
  ctx.shadowBlur = W * 0.006;
  ctx.shadowOffsetX = W * 0.004;
  ctx.shadowOffsetY = W * 0.007;
  for (const g of GRASS) clump(ctx, rand, ...g);
  for (let i = 0; i < 9; i++) clump(ctx, rand, 0.06 + rand() * 0.88, 0.05 + rand() * (PH - 0.1), rand() * TAU, 0.035 + rand() * 0.02, 4, 0.9);
  ctx.shadowColor = "transparent";
}

// Swim: a few tail beats at a chosen pace. Glide: tail still, coasting down. Hover: almost still,
// sculling with the pectoral fins. Burst: the startle escape.
function setMode(k: Koi, mode: number) {
  const r = Math.random;
  k.mode = mode;
  if (mode === SWIM) Object.assign(k, { modeT: 2 + r() * 4, vT: k.L * (0.45 + r() * 0.75), ampT: 0.65 + r() * 0.45, freqT: 1.3 + r() });
  else if (mode === GLIDE) Object.assign(k, { modeT: 1 + r() * 2.5, vT: k.L * 0.1, ampT: 0.08, freqT: 0.9 });
  else Object.assign(k, { modeT: 2 + r() * 5, vT: k.L * 0.03, ampT: 0.16, freqT: 0.6 + r() * 0.3 });
}

function nextMode(k: Koi) {
  const p = Math.random();
  if (k.mode === SWIM) setMode(k, p < 0.55 ? GLIDE : p < 0.8 ? SWIM : HOVER);
  else if (k.mode === GLIDE) setMode(k, p < 0.75 ? SWIM : HOVER);
  else setMode(k, k.mode === BURST ? GLIDE : SWIM);
}

function makeKoi(kind: Kind, id: number, others: Koi[]): Koi {
  let x = 0.5, y = PH / 2;
  for (let tries = 0; tries < 30; tries++) {
    x = 0.15 + Math.random() * 0.7;
    y = 0.12 + Math.random() * (PH - 0.24);
    if (others.every((o) => Math.hypot(o.x - x, o.y - y) > 0.2)) break;
  }
  const k: Koi = {
    id, kind, L: kind.len * (0.9 + Math.random() * 0.2), seed: Math.random() * 100, x, y,
    heading: Math.random() * TAU, speed: 0, yaw: 0, bend: 0, mode: SWIM, modeT: 0, vT: 0, amp: 0, ampT: 0, freq: 1, freqT: 1,
    phase: Math.random() * TAU, finPhase: Math.random() * TAU, depth: Math.random(), depthT: Math.random(),
    depthTimer: Math.random() * 8, follow: -1, followT: Math.random() * 6, escape: 0, spine: new Float32Array(2 * M),
  };
  setMode(k, Math.floor(Math.random() * 3));
  k.modeT *= Math.random();
  k.speed = k.vT;
  k.amp = k.ampT;
  k.freq = k.freqT;
  return k;
}

function updateKoi(k: Koi, dt: number, t: number, all: Koi[]) {
  k.modeT -= dt;
  if (k.modeT <= 0) nextMode(k);
  const burst = k.mode === BURST;

  // Wander on a slowly changing turn, sometimes trail another koi, give way to koi at the same depth.
  let want = (noise1(t * 0.2 + k.seed) * 0.7 + noise1(t * 0.53 + k.seed * 2) * 0.3) * (k.mode === HOVER ? 0.6 : 1);
  k.followT -= dt;
  if (k.followT <= 0) {
    k.follow = Math.random() < 0.35 ? Math.floor(Math.random() * all.length) : -1;
    if (k.follow === k.id) k.follow = -1;
    k.followT = 5 + Math.random() * 9;
  }
  if (k.follow >= 0 && !burst) {
    const o = all[k.follow], tx = o.x - Math.cos(o.heading) * o.L, ty = o.y - Math.sin(o.heading) * o.L;
    want = angDiff(Math.atan2(ty - k.y, tx - k.x), k.heading) * 1.2;
    if (k.mode === HOVER && Math.hypot(tx - k.x, ty - k.y) > k.L) setMode(k, SWIM);
  }
  for (const o of all) {
    const dx = o.x - k.x, dy = o.y - k.y, d = Math.hypot(dx, dy), reach = (k.L + o.L) * 0.6;
    if (o !== k && d < reach && Math.abs(o.depth - k.depth) < 0.35) {
      want -= Math.sign(Math.cos(k.heading) * dy - Math.sin(k.heading) * dx) * (1 - d / reach) * 2;
    }
  }
  // Look ahead and turn back toward the middle before reaching the edge.
  const look = k.L * 0.9 + k.speed * 1.5, m = 0.06;
  const ax = k.x + Math.cos(k.heading) * look, ay = k.y + Math.sin(k.heading) * look;
  const out = Math.max(m - ax, ax - 1 + m, m - ay, ay - PH + m);
  if (out > 0) {
    const s = Math.min(1, out / 0.06);
    want = want * (1 - s) + angDiff(Math.atan2(PH / 2 - k.y, 0.5 - k.x), k.heading) * 2.5 * s;
  }
  if (burst) want = angDiff(k.escape, k.heading) * 10;
  const maxYaw = burst ? 7 : k.mode === HOVER ? 0.7 : 1.2;
  k.yaw += (clamp(want, -maxYaw, maxYaw) - k.yaw) * Math.min(1, dt * (burst ? 14 : 2.2));
  k.heading += k.yaw * dt;

  k.speed += (k.vT - k.speed) * Math.min(1, dt * [0.6 + k.amp, 0.35, 0.9, 7][k.mode]);
  k.amp += (k.ampT - k.amp) * Math.min(1, dt * (burst ? 10 : 2));
  k.freq += (k.freqT - k.freq) * Math.min(1, dt * 3);
  k.phase += TAU * k.freq * dt;
  k.finPhase += TAU * 0.9 * dt;
  k.x = clamp(k.x + Math.cos(k.heading) * k.speed * dt, 0.02, 0.98);
  k.y = clamp(k.y + Math.sin(k.heading) * k.speed * dt, 0.02, PH - 0.02);
  // The body curves with the turn: tighter when slow, a full C when bolting.
  const bendT = clamp(((k.yaw * k.L) / Math.max(k.speed, k.L * 0.35)) * 0.8, -1.3, 1.3);
  k.bend += (bendT - k.bend) * Math.min(1, dt * (burst ? 16 : 5));

  k.depthTimer -= dt;
  if (k.depthTimer <= 0) {
    k.depthT = Math.random();
    k.depthTimer = 6 + Math.random() * 10;
  }
  k.depth += clamp(k.depthT - k.depth, -0.07 * dt, 0.07 * dt);
}

function startle(k: Koi, x: number, y: number) {
  let near = Infinity;
  for (let i = 0; i < M; i++) near = Math.min(near, Math.hypot(k.spine[2 * i] - x, k.spine[2 * i + 1] - y) - halfWidth(S[i]) * k.L);
  const reach = near < 0.01 ? 1 : 1 - near / 0.22;
  if (reach <= 0 || Math.random() > reach + 0.3) return;
  k.mode = BURST;
  k.modeT = 0.25 + reach * 0.35;
  k.escape = Math.atan2(k.y - y, k.x - x) + (Math.random() - 0.5) * 0.9;
  k.vT = k.L * (2 + 2.5 * reach);
  k.ampT = 1.6;
  k.freqT = 4.5;
  k.depthT = Math.min(1, k.depth + 0.5);
  k.follow = -1;
}

const SX = new Float32Array(M), SY = new Float32Array(M), TX = new Float32Array(M), TY = new Float32Array(M);
const NX = new Float32Array(M), NY = new Float32Array(M), FAN = new Float32Array(2 * 17 * 8);

// The spine: an arc bent by the turn, plus a travelling wave that grows toward the tail.
function spine(k: Koi) {
  const L = k.L * (0.94 + 0.12 * (1 - k.depth)), b = k.bend, h = k.heading, A = 0.11 * k.amp * L;
  for (let i = 0; i < M; i++) {
    const u = S[i] - ANCHOR, phi = h - b * u, straight = Math.abs(b) < 1e-4;
    const ix = straight ? u * Math.cos(h) : (Math.sin(h) - Math.sin(phi)) / b;
    const iy = straight ? u * Math.sin(h) : (Math.cos(phi) - Math.cos(h)) / b;
    const off = A * (0.06 + 0.94 * S[i] * S[i]) * Math.sin(k.phase - TAU * S[i]);
    SX[i] = k.x - L * ix + Math.sin(phi) * off;
    SY[i] = k.y - L * iy - Math.cos(phi) * off;
  }
  for (let i = 0; i < M; i++) {
    const a = Math.max(0, i - 1), c = Math.min(M - 1, i + 1);
    const dx = SX[c] - SX[a], dy = SY[c] - SY[a], d = Math.hypot(dx, dy) || 1;
    TX[i] = dx / d;
    TY[i] = dy / d;
    NX[i] = -TY[i];
    NY[i] = TX[i];
    k.spine[2 * i] = SX[i];
    k.spine[2 * i + 1] = SY[i];
  }
  return L;
}

// Writes one koi's triangles, fins under the body.
function meshKoi(k: Koi, put: Put) {
  const L = spine(k);
  // A fin: rays fanning from a short root, each curling a little more toward its tip.
  const fan = (x0: number, y0: number, axis: number, rootHW: number, len: number, spread: number, curl: number, rays: number, steps: number, shape: (a: number) => number) => {
    const px = -Math.sin(axis), py = Math.cos(axis), at = (j: number, s: number) => 2 * (j * (steps + 1) + s);
    for (let j = 0; j <= rays; j++) {
      const a = -1 + (2 * j) / rays, th = axis + a * spread, l = (len * shape(a)) / steps;
      let x = x0 + px * a * rootHW, y = y0 + py * a * rootHW;
      for (let s = 0; s <= steps; s++) {
        FAN[at(j, s)] = x;
        FAN[at(j, s) + 1] = y;
        const ang = th + curl * ((s + 0.5) / steps) ** 2;
        x += Math.cos(ang) * l;
        y += Math.sin(ang) * l;
      }
    }
    const vert = (j: number, s: number) => put(FAN[at(j, s)], FAN[at(j, s) + 1], s / steps, -1 + (2 * j) / rays, 1);
    for (let j = 0; j < rays; j++) {
      for (let s = 0; s < steps; s++) {
        vert(j, s); vert(j + 1, s); vert(j, s + 1);
        vert(j, s + 1); vert(j + 1, s); vert(j + 1, s + 1);
      }
    }
  };
  // Tail fin trails the beat and carries on the body's curve.
  const e = M - 1, flutter = 0.06 * Math.sin(k.finPhase * 1.3 + k.seed);
  fan(SX[e] - TX[e] * L * 0.03, SY[e] - TY[e] * L * 0.03, Math.atan2(TY[e], TX[e]), L * 0.035, L * 0.36,
    0.42 + 0.15 * (1 - Math.min(k.amp, 1)), -0.6 * k.amp * Math.cos(k.phase) - k.bend * 0.3 + flutter, 14, 5, tailShape);
  // Body: the koi's photo row stretched along the spine.
  const hw = (ATLAS_ROW / 2 / ATLAS_W) * L, v0 = (k.kind.row + 0.5) * ATLAS_ROW / ATLAS_H, dv = ATLAS_ROW / 2 / ATLAS_H;
  const side = (i: number, v: number) => put(SX[i] + NX[i] * hw * v, SY[i] + NY[i] * hw * v, S[i], v0 + v * dv, 0);
  for (let i = 0; i < M - 1; i++) {
    side(i, -1); side(i, 1); side(i + 1, -1);
    side(i + 1, -1); side(i, 1); side(i + 1, 1);
  }
}

function disturb(h: Float32Array, x: number, y: number, amount: number, radius: number) {
  const cx = x * GW, cy = (y / PH) * GH, r = Math.ceil(radius);
  for (let gy = Math.round(cy) - r; gy <= Math.round(cy) + r; gy++) {
    for (let gx = Math.round(cx) - r; gx <= Math.round(cx) + r; gx++) {
      const d = Math.hypot(gx - cx, gy - cy) / radius;
      if (d < 1 && gx > 0 && gy > 0 && gx < GW - 1 && gy < GH - 1) h[gy * GW + gx] += amount * (0.5 + 0.5 * Math.cos(d * Math.PI));
    }
  }
}

function program(gl: WebGL2RenderingContext, vert: string, frag: string) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vert], [gl.FRAGMENT_SHADER, frag]] as const) {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
      return null;
    }
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  return p;
}

function startPond(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, antialias: false });
  const comp = gl && program(gl, VERT, FRAG), fishProg = gl && program(gl, FISH_VERT, FISH_FRAG);
  if (!gl || !comp || !fishProg) return () => {};

  // Texture units: 0 bed, 1 koi, 2 koi shadows, 3 ripple heights.
  const textures = [0, 1, 2, 3].map((unit) => {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  });
  const fishFB = gl.createFramebuffer(), shadowFB = gl.createFramebuffer();

  gl.useProgram(comp);
  ["uBed", "uFish", "uShadow", "uHeight"].forEach((name, unit) => gl.uniform1i(gl.getUniformLocation(comp, name), unit));
  gl.uniform2f(gl.getUniformLocation(comp, "uGrid"), 1 / GW, 1 / GH);
  const uRes = gl.getUniformLocation(comp, "uRes"), uTime = gl.getUniformLocation(comp, "uTime");

  const koi: Koi[] = [];
  KINDS.forEach((kind, id) => koi.push(makeKoi(kind, id, koi)));
  gl.useProgram(fishProg);
  gl.uniform1f(gl.getUniformLocation(fishProg, "uPH"), PH);
  gl.uniform3fv(gl.getUniformLocation(fishProg, "uBase"), koi.flatMap((k) => rgb(k.kind.base)));
  gl.uniform3fv(gl.getUniformLocation(fishProg, "uFin"), koi.flatMap((k) => rgb(k.kind.fin)));
  gl.uniform1i(gl.getUniformLocation(fishProg, "uAtlas"), 4);
  const uQ = gl.getUniformLocation(fishProg, "uQ"), uShift = gl.getUniformLocation(fishProg, "uShift");
  const uShadowMode = gl.getUniformLocation(fishProg, "uShadowMode");
  const q = new Float32Array(4 * koi.length);

  const buf = new Float32Array(koi.length * 1100 * FLOATS);
  let n = 0, fid = 0;
  const put: Put = (x, y, u, v, part) => {
    const o = n++ * FLOATS;
    buf[o] = x;
    buf[o + 1] = y;
    buf[o + 2] = u;
    buf[o + 3] = v;
    buf[o + 4] = part;
    buf[o + 5] = fid;
  };
  const vao = gl.createVertexArray(), vbo = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, buf.byteLength, gl.DYNAMIC_DRAW);
  [2, 2, 2].reduce((offset, size, loc) => {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, FLOATS * 4, offset * 4);
    return offset + size;
  }, 0);
  gl.bindVertexArray(null);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Creatures appear once their photo atlas has loaded.
  let atlasReady = false;
  const atlas = new Image();
  atlas.src = ATLAS;
  atlas.decode().then(() => {
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    atlasReady = true;
    if (still) tick(0);
  }, () => console.warn("Pond creatures failed to load"));

  const bed = document.createElement("canvas"), bctx = bed.getContext("2d")!;
  let cur = new Float32Array(GW * GH), prev = new Float32Array(GW * GH);
  let W = 0, H = 0, time = 0, acc = 0, last = 0, raf = 0;

  function resize() {
    const w = Math.round(canvas.clientWidth * Math.min(devicePixelRatio || 1, 2));
    if (!w || w === W) return;
    W = w;
    H = Math.round(w / ASPECT);
    canvas.width = bed.width = W;
    canvas.height = bed.height = H;
    paintBed(bctx, W);
    gl!.activeTexture(gl!.TEXTURE0);
    gl!.pixelStorei(gl!.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, bed);
    gl!.pixelStorei(gl!.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    // Koi at full resolution, their shadows at half (they get blurred anyway).
    for (const [unit, fb, scale] of [[1, fishFB, 1], [2, shadowFB, 2]] as const) {
      gl!.activeTexture(gl!.TEXTURE0 + unit);
      gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA8, W / scale | 0, H / scale | 0, 0, gl!.RGBA, gl!.UNSIGNED_BYTE, null);
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, fb);
      gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0, gl!.TEXTURE_2D, textures[unit], 0);
    }
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
    gl!.useProgram(comp);
    gl!.uniform2f(uRes, W, H);
  }

  function tick(dt: number) {
    time += dt;
    for (const k of koi) updateKoi(k, dt, time, koi);

    // Deeper koi first, so the ones near the surface pass over them.
    n = 0;
    for (const k of atlasReady ? [...koi].sort((a, b) => b.depth - a.depth) : []) {
      fid = k.id;
      meshKoi(k, put);
    }
    for (const k of koi) {
      q.set([k.L, k.depth, k.phase, 0.04 + 0.1 * Math.min(k.amp, 1)], 4 * k.id);
      // A koi just under the surface stirs it with its tail.
      disturb(cur, k.spine[2 * M - 2], k.spine[2 * M - 1], -dt * k.amp * (0.3 + k.speed / k.L) * (1 - k.depth) * 0.8, 2.2);
    }
    // Hugo Elias' two-buffer wave equation.
    for (acc += dt; acc >= STEP; acc -= STEP) {
      for (let y = 1; y < GH - 1; y++) {
        for (let x = 1, i = y * GW + 1; x < GW - 1; x++, i++) prev[i] = ((cur[i - 1] + cur[i + 1] + cur[i - GW] + cur[i + GW]) * 0.5 - prev[i]) * DAMP;
      }
      [cur, prev] = [prev, cur];
    }

    const g = gl!;
    g.useProgram(fishProg);
    g.uniform4fv(uQ, q);
    g.bindVertexArray(vao);
    g.bindBuffer(g.ARRAY_BUFFER, vbo);
    g.bufferSubData(g.ARRAY_BUFFER, 0, buf, 0, n * FLOATS);
    g.enable(g.BLEND);
    for (const [fb, shadow, w, h] of [[fishFB, 0, W, H], [shadowFB, 1, W >> 1, H >> 1]] as const) {
      g.bindFramebuffer(g.FRAMEBUFFER, fb);
      g.viewport(0, 0, w, h);
      g.clear(g.COLOR_BUFFER_BIT);
      g.uniform1i(uShadowMode, shadow);
      g.uniform2f(uShift, shadow * 0.01, shadow * 0.014);
      g.drawArrays(g.TRIANGLES, 0, n);
    }
    g.disable(g.BLEND);
    g.bindVertexArray(null);
    g.bindFramebuffer(g.FRAMEBUFFER, null);
    g.viewport(0, 0, W, H);

    g.useProgram(comp);
    g.activeTexture(g.TEXTURE3);
    g.texImage2D(g.TEXTURE_2D, 0, g.R16F, GW, GH, 0, g.RED, g.FLOAT, cur);
    g.uniform1f(uTime, time);
    g.drawArrays(g.TRIANGLES, 0, 3);
  }

  function frame(now: number) {
    tick(last ? Math.min((now - last) / 1000, 0.05) : 0);
    last = now;
    raf = requestAnimationFrame(frame);
  }

  function onDown(event: PointerEvent) {
    const r = canvas.getBoundingClientRect(), x = (event.clientX - r.left) / r.width, y = (event.clientY - r.top) / r.width;
    disturb(cur, x, y, -2.2, 3.2);
    for (const k of koi) startle(k, x, y);
  }

  const ro = new ResizeObserver(() => {
    resize();
    if (still) tick(0);
  });
  // Only animate while on screen.
  const io = new IntersectionObserver(([entry]) => {
    cancelAnimationFrame(raf);
    last = 0;
    if (entry.isIntersecting && !still) raf = requestAnimationFrame(frame);
  });
  ro.observe(canvas);
  io.observe(canvas);
  canvas.addEventListener("pointerdown", onDown);
  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    canvas.removeEventListener("pointerdown", onDown);
  };
}

export function KoiPond({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => (ref.current ? startPond(ref.current) : undefined), []);
  return <canvas ref={ref} className={className} role="img" aria-label="Koi swimming in a sunlit pond. Tap the water to make ripples, or tap a fish to scare it." />;
}
