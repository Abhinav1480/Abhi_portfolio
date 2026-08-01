/* ═══════════════════════════════════════════════════════════════
   AX-01 — REAL-TIME AI MOTHERBOARD ENVIRONMENT
   Three.js · PBR materials · GPU instancing · Bloom post pipeline
   Design language: luxury engineering. Quiet. Precise. Physical.
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* ───────────────────────── constants ───────────────────────── */

const BOARD_W = 170;
const BOARD_H = 130;
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const COL = {
  bg:        0x08080b,
  pcb:       0x0c0c10,
  graphite:  0x17171c,
  ceramic:   0x1d1d23,
  chipBlack: 0x101014,
  metal:     0x8e9096,
  gold:      0xc9a86a,
  copper:    0xb87333,
  violet:    0xa78bfa,
  blue:      0x8ab4f8,
  amber:     0xe8c37e,
  green:     0x7ee2b8,
};

/* Region anchors on the board (world XZ). Content column is LEFT
   on screen, so camera targets are biased so hardware sits RIGHT. */
const REGIONS = {
  cpu:      new THREE.Vector3(  0, 0,   0),
  memory:   new THREE.Vector3( 30, 0, -16),
  routing:  new THREE.Vector3(-34, 0,  20),
  pcie:     new THREE.Vector3( 26, 0,  30),
  power:    new THREE.Vector3(-30, 0, -24),
};

/* Camera waypoints per section: [position, lookAt target] */
const WAYPOINTS = [
  { pos: new THREE.Vector3( -6, 21, 27),  tgt: new THREE.Vector3( -7.5, 0, -2) },   // 0 hero — above CPU
  { pos: new THREE.Vector3( 16, 15,  2),  tgt: new THREE.Vector3( 24,   0, -15) },  // 1 about — memory array
  { pos: new THREE.Vector3(-46, 13, 34),  tgt: new THREE.Vector3(-39,   0,  18) },  // 2 skills — signal routing
  { pos: new THREE.Vector3( 12, 14, 46),  tgt: new THREE.Vector3( 21,   0,  29) },  // 3 stockpilot — expansion slots
  { pos: new THREE.Vector3(-40, 16, -6),  tgt: new THREE.Vector3(-34,   0, -23) },  // 4 exam os — power delivery
  { pos: new THREE.Vector3( 30, 18, 10),  tgt: new THREE.Vector3( 20,   0,   0) },  // 5 gym salaar — memory side
  { pos: new THREE.Vector3( -2, 62, 50),  tgt: new THREE.Vector3(  5,   0,  2) },   // 6 contact — board overview
];

/* ───────────────────────── renderer ───────────────────────── */

const canvas = document.getElementById('world');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  document.getElementById('webgl-fallback').hidden = false;
  throw e;
}

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(COL.bg);
scene.fog = new THREE.FogExp2(COL.bg, 0.0105);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.5, 400);
camera.position.copy(WAYPOINTS[0].pos);

/* HDR-style environment for physically based reflections */
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
pmrem.dispose();

/* ───────────────────────── lighting ─────────────────────────
   Professional product lighting: warm key, cool fill, violet rim.
   Dark environment, no overexposure.                            */

scene.add(new THREE.HemisphereLight(0x2a2a36, 0x050507, 0.55));

const keyLight = new THREE.DirectionalLight(0xfff1de, 1.15);       // warm key
keyLight.position.set(-40, 70, 30);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x9db8e8, 0.32);      // blue fill
fillLight.position.set(50, 40, -50);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xa78bfa, 0.22);       // violet edge
rimLight.position.set(0, 18, -80);
scene.add(rimLight);

/* Region accent lights — quietly lifted when the visitor arrives */
const regionLights = {};
for (const [name, anchor] of Object.entries(REGIONS)) {
  const l = new THREE.PointLight(name === 'power' ? 0xe8c37e : 0xa78bfa, 0, 34, 2);
  l.position.set(anchor.x, 6, anchor.z);
  l.userData = { base: 0, boost: 0 };
  scene.add(l);
  regionLights[name] = l;
}
regionLights.cpu.userData.base = 14;                                // soft CPU underglow ambience

/* ───────────────────── shared materials ───────────────────── */

const MAT = {
  graphite: new THREE.MeshStandardMaterial({ color: COL.graphite, roughness: 0.66, metalness: 0.35 }),
  ceramic:  new THREE.MeshStandardMaterial({ color: COL.ceramic,  roughness: 0.5,  metalness: 0.12 }),
  chip:     new THREE.MeshStandardMaterial({ color: COL.chipBlack, roughness: 0.42, metalness: 0.25 }),
  metal:    new THREE.MeshStandardMaterial({ color: COL.metal,    roughness: 0.34, metalness: 0.95 }),
  brushed:  new THREE.MeshStandardMaterial({ color: 0x6f7178,     roughness: 0.48, metalness: 0.9 }),
  gold:     new THREE.MeshStandardMaterial({ color: COL.gold,     roughness: 0.32, metalness: 1.0 }),
  copper:   new THREE.MeshStandardMaterial({ color: COL.copper,   roughness: 0.4,  metalness: 1.0 }),
  capBody:  new THREE.MeshStandardMaterial({ color: 0x232329,     roughness: 0.55, metalness: 0.6 }),
  smd:      new THREE.MeshStandardMaterial({ color: 0x2b2b31,     roughness: 0.7,  metalness: 0.2 }),
  slotDark: new THREE.MeshStandardMaterial({ color: 0x121216,     roughness: 0.62, metalness: 0.18 }),
};

/* ─────────────── procedural PCB surface textures ───────────────
   One large non-repeating canvas: matte black solder mask, gold
   traces, silkscreen reference designators, inspection marks.
   A second canvas drives the faint emissive trace network.        */

const TEX_W = 2048, TEX_H = 1568;
const u = x => (x / BOARD_W + 0.5) * TEX_W;
const v = z => (z / BOARD_H + 0.5) * TEX_H;

function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
const rnd = seededRandom(1847);

function drawTrace(ctx, x, z, steps, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  let px = u(x), py = v(z);
  ctx.moveTo(px, py);
  let dir = Math.floor(rnd() * 8) * Math.PI / 4;              // manhattan + 45°
  for (let i = 0; i < steps; i++) {
    const len = 14 + rnd() * 70;
    px += Math.cos(dir) * len;
    py += Math.sin(dir) * len;
    ctx.lineTo(px, py);
    dir += (rnd() < 0.5 ? 1 : -1) * Math.PI / 4;
  }
  ctx.stroke();
}

function buildBoardTextures() {
  /* ALBEDO */
  const c = document.createElement('canvas');
  c.width = TEX_W; c.height = TEX_H;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#0b0b0f';
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  /* subtle solder-mask mottling + micro dust */
  for (let i = 0; i < 5200; i++) {
    const g = 8 + rnd() * 16;
    ctx.fillStyle = `rgba(${g + 6},${g + 6},${g + 12},${0.05 + rnd() * 0.07})`;
    ctx.fillRect(rnd() * TEX_W, rnd() * TEX_H, 1 + rnd() * 3, 1 + rnd() * 3);
  }
  /* micro scratches */
  ctx.strokeStyle = 'rgba(160,160,170,0.030)';
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 90; i++) {
    ctx.beginPath();
    const x = rnd() * TEX_W, y = rnd() * TEX_H, a = rnd() * Math.PI;
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * (30 + rnd() * 120), y + Math.sin(a) * (30 + rnd() * 120));
    ctx.stroke();
  }

  /* ground-plane crosshatch, extremely faint */
  ctx.strokeStyle = 'rgba(255,255,255,0.016)';
  ctx.lineWidth = 1;
  for (let x = 0; x < TEX_W; x += 26) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, TEX_H); ctx.stroke(); }
  for (let y = 0; y < TEX_H; y += 26) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(TEX_W, y); ctx.stroke(); }

  /* signal traces — gold, restrained. Clustered around regions,
     kept AWAY from a wide central-left corridor (UI safe zone).  */
  const clusters = [
    [REGIONS.cpu, 46, 34],   [REGIONS.memory, 40, 26],
    [REGIONS.routing, 60, 22], [REGIONS.pcie, 40, 26],
    [REGIONS.power, 42, 30],
    [new THREE.Vector3(58, 0, -44), 26, 18],
    [new THREE.Vector3(-62, 0, -46), 24, 16],
    [new THREE.Vector3(60, 0, 48), 24, 16],
  ];
  for (const [a, n, spread] of clusters) {
    for (let i = 0; i < n; i++) {
      const alpha = 0.10 + rnd() * 0.14;
      drawTrace(ctx, a.x + (rnd() - 0.5) * spread, a.z + (rnd() - 0.5) * spread,
        3 + Math.floor(rnd() * 5), `rgba(190,158,96,${alpha})`, 1.4 + rnd() * 1.4);
    }
  }
  /* wide copper power rails near VRM */
  for (let i = 0; i < 8; i++) {
    drawTrace(ctx, REGIONS.power.x + (rnd() - 0.5) * 30, REGIONS.power.z + (rnd() - 0.5) * 22,
      2 + Math.floor(rnd() * 3), 'rgba(150,98,52,0.22)', 5 + rnd() * 4);
  }

  /* silkscreen: reference designators, labels, inspection marks */
  const labels = ['C1042','R2210','U-30','L7','Q118','GND','VCC_3V3','VDDQ','TP-07','X-TAL','J14','FB2','D9','PWR_OK','SDA','SCL','RST','EN_5V','CLK_100M','VSS'];
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 340; i++) {
    const x = rnd() * TEX_W, y = rnd() * TEX_H;
    /* keep silkscreen off the central-left safe corridor */
    if (x > TEX_W * 0.16 && x < TEX_W * 0.52 && y > TEX_H * 0.3 && y < TEX_H * 0.7 && rnd() < 0.8) continue;
    ctx.save();
    ctx.translate(x, y);
    if (rnd() < 0.5) ctx.rotate(Math.PI / 2);
    ctx.font = `${5 + rnd() * 4}px "JetBrains Mono", monospace`;
    ctx.fillStyle = `rgba(220,220,228,${0.10 + rnd() * 0.14})`;
    ctx.fillText(labels[Math.floor(rnd() * labels.length)], 0, 0);
    ctx.restore();
  }
  /* inspection dots + alignment crosses */
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(214,160,90,0.18)' : 'rgba(150,170,220,0.14)';
    ctx.beginPath();
    ctx.arc(rnd() * TEX_W, rnd() * TEX_H, 2 + rnd() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(220,220,228,0.12)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 26; i++) {
    const x = rnd() * TEX_W, y = rnd() * TEX_H, s = 5;
    ctx.beginPath();
    ctx.moveTo(x - s, y); ctx.lineTo(x + s, y);
    ctx.moveTo(x, y - s); ctx.lineTo(x, y + s);
    ctx.stroke();
  }
  /* board identity — quiet, corner */
  ctx.font = '12px "JetBrains Mono", monospace';
  ctx.fillStyle = 'rgba(220,220,228,0.16)';
  ctx.fillText('AX-01  MAINBOARD  ·  REV A  ·  LOT 2026  ·  FAB-TOKYO-3', TEX_W * 0.035, TEX_H * 0.965);
  ctx.fillText('94V-0  ·  E184705  ·  RoHS', TEX_W * 0.82, TEX_H * 0.965);

  const albedo = new THREE.CanvasTexture(c);
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  /* EMISSIVE — a sparse violet nervous system, very faint */
  const e = document.createElement('canvas');
  e.width = TEX_W; e.height = TEX_H;
  const ectx = e.getContext('2d');
  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, TEX_W, TEX_H);
  for (const [a, n, spread] of clusters) {
    for (let i = 0; i < Math.floor(n * 0.28); i++) {
      drawTrace(ectx, a.x + (rnd() - 0.5) * spread, a.z + (rnd() - 0.5) * spread,
        3 + Math.floor(rnd() * 4), `rgba(126,102,214,${0.5 + rnd() * 0.4})`, 1.3);
    }
  }
  const emissive = new THREE.CanvasTexture(e);

  return { albedo, emissive };
}

const boardTex = buildBoardTextures();
const boardMat = new THREE.MeshStandardMaterial({
  map: boardTex.albedo,
  emissive: 0xffffff,
  emissiveMap: boardTex.emissive,
  emissiveIntensity: 0.34,
  roughness: 0.88,
  metalness: 0.22,
});
const board = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_W, BOARD_H), boardMat);
board.rotation.x = -Math.PI / 2;
scene.add(board);

/* substrate edge — the board has thickness; it is an object, not a floor */
const edgeMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0d, roughness: 0.85, metalness: 0.1 });
const substrate = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W, 1.4, BOARD_H), edgeMat);
substrate.position.y = -0.71;
scene.add(substrate);

/* ────────────────────── GPU instancing helpers ────────────────────── */

const tmpObj = new THREE.Object3D();

function instance(geo, mat, placements) {
  const m = new THREE.InstancedMesh(geo, mat, placements.length);
  placements.forEach((p, i) => {
    tmpObj.position.set(p.x, p.y, p.z);
    tmpObj.rotation.set(0, p.ry || 0, 0);
    tmpObj.scale.setScalar(p.s || 1);
    tmpObj.updateMatrix();
    m.setMatrixAt(i, tmpObj.matrix);
  });
  m.instanceMatrix.needsUpdate = true;
  scene.add(m);
  return m;
}

/* cluster scatter that RESPECTS THE UI SAFE ZONE: the corridor at
   x ∈ [-58, -8] (screen-left content column at typical view angles)
   stays visually calm — fewer parts, no tall parts.               */
function scatter(anchor, count, spread, opts = {}) {
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 12) {
    const x = anchor.x + (rnd() - 0.5) * spread * 2;
    const z = anchor.z + (rnd() - 0.5) * spread * (opts.zSpread || 1) * 2;
    if (Math.abs(x) > BOARD_W / 2 - 4 || Math.abs(z) > BOARD_H / 2 - 4) continue;
    if (opts.avoidCpu && Math.abs(x) < 7 && Math.abs(z) < 7) continue;
    out.push({ x, y: opts.y ?? 0, z, ry: opts.grid ? (rnd() < 0.5 ? 0 : Math.PI / 2) : rnd() * Math.PI * 2, s: 0.8 + rnd() * (opts.sVar ?? 0.45) });
  }
  return out;
}

/* ── vias — 900 gold-plated through-holes ── */
{
  const geo = new THREE.CylinderGeometry(0.09, 0.09, 0.08, 6);
  const pts = [];
  for (const [a, , spread] of [[REGIONS.cpu, 0, 20], [REGIONS.memory, 0, 16], [REGIONS.routing, 0, 24], [REGIONS.pcie, 0, 16], [REGIONS.power, 0, 18]]) {
    pts.push(...scatter(a, 180, spread, { y: 0.04, avoidCpu: true, sVar: 0.3 }));
  }
  instance(geo, MAT.gold, pts);
}

/* ── SMD resistors / tiny passives — 520, gridded ── */
{
  const geo = new THREE.BoxGeometry(0.34, 0.09, 0.17);
  const pts = [];
  for (const a of Object.values(REGIONS)) pts.push(...scatter(a, 104, 15, { y: 0.05, grid: true, avoidCpu: true }));
  instance(geo, MAT.smd, pts);
}

/* ── ceramic capacitors — 160 small cylinders ── */
{
  const geo = new THREE.CylinderGeometry(0.22, 0.22, 0.5, 10);
  const pts = [
    ...scatter(REGIONS.power, 70, 13, { y: 0.25, avoidCpu: true }),
    ...scatter(REGIONS.cpu, 46, 13, { y: 0.25, avoidCpu: true }),
    ...scatter(REGIONS.pcie, 44, 13, { y: 0.25 }),
  ];
  instance(geo, MAT.capBody, pts);
}

/* ── electrolytic caps with brushed-metal tops — 46 ── */
{
  const geo = new THREE.CylinderGeometry(0.42, 0.42, 1.0, 14);
  const pts = [...scatter(REGIONS.power, 30, 11, { y: 0.5 }), ...scatter(REGIONS.cpu, 16, 12, { y: 0.5, avoidCpu: true })];
  instance(geo, MAT.metal, pts);
}

/* ── VRM inductors — graphite cubes in disciplined rows ── */
{
  const geo = new THREE.BoxGeometry(1.15, 0.75, 1.15);
  const pts = [];
  for (let row = 0; row < 2; row++)
    for (let i = 0; i < 8; i++)
      pts.push({ x: REGIONS.power.x - 8 + i * 2.1, y: 0.38, z: REGIONS.power.z - 3 + row * 3.4, ry: 0, s: 1 });
  instance(geo, MAT.graphite, pts);
}

/* ── MOSFETs — flat black packages beside the inductors ── */
{
  const geo = new THREE.BoxGeometry(0.62, 0.14, 0.5);
  const pts = [];
  for (let i = 0; i < 16; i++)
    pts.push({ x: REGIONS.power.x - 8 + (i % 8) * 2.1, y: 0.07, z: REGIONS.power.z + 1.8 + Math.floor(i / 8) * 1.4, ry: 0, s: 1 });
  pts.push(...scatter(REGIONS.routing, 40, 16, { y: 0.07, grid: true }));
  instance(geo, MAT.chip, pts);
}

/* ── microcontrollers / QFP chips — 44, varied sizes ── */
{
  const geo = new THREE.BoxGeometry(1.6, 0.22, 1.6);
  const pts = [
    ...scatter(REGIONS.routing, 18, 17, { y: 0.11, grid: true, sVar: 1.1 }),
    ...scatter(REGIONS.memory, 12, 13, { y: 0.11, grid: true, sVar: 0.8 }),
    ...scatter(REGIONS.pcie, 14, 13, { y: 0.11, grid: true, sVar: 0.9 }),
  ];
  instance(geo, MAT.chip, pts);
}

/* ── crystal oscillators — small metal cans ── */
{
  const geo = new THREE.CylinderGeometry(0.28, 0.28, 0.22, 12);
  instance(geo, MAT.brushed, scatter(REGIONS.routing, 14, 15, { y: 0.11 }));
}

/* ── mounting screws — brushed hex heads ── */
{
  const geo = new THREE.CylinderGeometry(0.32, 0.32, 0.16, 6);
  const pts = [];
  const xs = [-78, -40, 0, 40, 78], zs = [-58, 0, 58];
  for (const x of xs) for (const z of zs) pts.push({ x: x + (rnd() - 0.5), y: 0.08, z: z + (rnd() - 0.5), ry: rnd(), s: 1 });
  instance(geo, MAT.brushed, pts);
}

/* ────────────────────── hero component: the CPU ──────────────────────
   Matte ceramic body · graphite die · gold chamfer · laser engraving ·
   soft violet underglow. Expensive hardware — not a mascot.           */

function buildCpuTopTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  const x = c.getContext('2d');

  /* graphite ceramic with fine brushed grain */
  const g = x.createLinearGradient(0, 0, 1024, 1024);
  g.addColorStop(0, '#232329'); g.addColorStop(0.5, '#1b1b21'); g.addColorStop(1, '#212127');
  x.fillStyle = g;
  x.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 1400; i++) {
    x.fillStyle = `rgba(255,255,255,${0.008 + rnd() * 0.018})`;
    x.fillRect(rnd() * 1024, rnd() * 1024, 40 + rnd() * 160, 1);
  }
  /* micro wear + manufacturing marks */
  for (let i = 0; i < 40; i++) {
    x.fillStyle = `rgba(0,0,0,${0.05 + rnd() * 0.1})`;
    x.beginPath(); x.arc(rnd() * 1024, rnd() * 1024, 1 + rnd() * 2, 0, 7); x.fill();
  }

  /* central die — slightly darker, hairline gold border */
  x.fillStyle = '#141418';
  x.fillRect(342, 342, 340, 340);
  x.strokeStyle = 'rgba(201,168,106,0.5)';
  x.lineWidth = 2;
  x.strokeRect(342, 342, 340, 340);
  /* die grid — compute tiles */
  x.strokeStyle = 'rgba(255,255,255,0.05)';
  x.lineWidth = 1;
  for (let i = 1; i < 8; i++) {
    x.beginPath(); x.moveTo(342 + i * 42.5, 342); x.lineTo(342 + i * 42.5, 682); x.stroke();
    x.beginPath(); x.moveTo(342, 342 + i * 42.5); x.lineTo(682, 342 + i * 42.5); x.stroke();
  }

  /* laser engraving — tiny manufacturing text only */
  x.fillStyle = 'rgba(212,212,220,0.6)';
  x.font = '500 30px "Space Grotesk", sans-serif';
  x.fillText('AX-01', 90, 130);
  x.font = '15px "JetBrains Mono", monospace';
  x.fillStyle = 'rgba(200,200,210,0.42)';
  x.fillText('NEURAL PROCESSING UNIT', 90, 165);
  x.fillStyle = 'rgba(200,200,210,0.34)';
  x.font = '14px "JetBrains Mono", monospace';
  x.fillText('REV A · LOT 2026', 90, 905);
  x.fillText('5nm · SN 0001847', 90, 930);
  x.textAlign = 'right';
  x.fillText('FAB-TOKYO-3', 934, 905);
  x.fillText('△ 184 · QC PASS', 934, 930);
  x.textAlign = 'left';

  /* tiny QR code */
  for (let i = 0; i < 14; i++) for (let j = 0; j < 14; j++) {
    if (rnd() < 0.46) { x.fillStyle = 'rgba(210,210,218,0.4)'; x.fillRect(858 + i * 5, 92 + j * 5, 4, 4); }
  }
  x.strokeStyle = 'rgba(210,210,218,0.3)';
  x.strokeRect(854, 88, 76, 76);

  /* gold alignment triangle (pin 1) */
  x.fillStyle = 'rgba(201,168,106,0.55)';
  x.beginPath(); x.moveTo(92, 940); x.lineTo(112, 940); x.lineTo(92, 960); x.fill();

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const cpu = new THREE.Group();
{
  /* gold-plated interposer substrate */
  const interposer = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.18, 7.4), MAT.gold);
  interposer.position.y = 0.09;
  cpu.add(interposer);

  /* darker package layer */
  const pkg = new THREE.Mesh(new THREE.BoxGeometry(6.9, 0.2, 6.9),
    new THREE.MeshStandardMaterial({ color: 0x101013, roughness: 0.6, metalness: 0.2 }));
  pkg.position.y = 0.27;
  cpu.add(pkg);

  /* ceramic body with chamfered silhouette */
  const body = new THREE.Mesh(new THREE.CylinderGeometry(4.62, 4.86, 0.62, 4),
    new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.52, metalness: 0.18 }));
  body.rotation.y = Math.PI / 4;
  body.position.y = 0.68;
  cpu.add(body);

  /* engraved graphite top plate */
  const top = new THREE.Mesh(new THREE.BoxGeometry(6.1, 0.05, 6.1),
    new THREE.MeshStandardMaterial({ map: buildCpuTopTexture(), roughness: 0.46, metalness: 0.3 }));
  top.position.y = 1.015;
  cpu.add(top);

  /* soft violet underglow — an emissive halo hugging the base */
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 256;
  const gx = glowCanvas.getContext('2d');
  const rg = gx.createRadialGradient(128, 128, 52, 128, 128, 128);
  rg.addColorStop(0, 'rgba(167,139,250,0)');
  rg.addColorStop(0.62, 'rgba(167,139,250,0.30)');
  rg.addColorStop(0.8, 'rgba(140,110,240,0.10)');
  rg.addColorStop(1, 'rgba(140,110,240,0)');
  gx.fillStyle = rg;
  gx.fillRect(0, 0, 256, 256);
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(13, 13),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(glowCanvas), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.03;
  cpu.add(glow);
  cpu.userData.glow = glow;

  cpu.position.copy(REGIONS.cpu);
  scene.add(cpu);
}

/* retention bracket + corner screws around the socket */
{
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.28, 9.6), MAT.brushed);
  const hole = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.5, 8.2), new THREE.MeshBasicMaterial({ color: COL.bg }));
  bracket.position.y = 0.14;
  /* fake the cut-out with four rails instead of CSG — cheap + clean */
  scene.remove(bracket); // replaced by rails below
  const railGeoH = new THREE.BoxGeometry(9.6, 0.26, 0.62);
  const railGeoV = new THREE.BoxGeometry(0.62, 0.26, 9.6);
  for (const [gx, gz, geo] of [[0, -4.5, railGeoH], [0, 4.5, railGeoH], [-4.5, 0, railGeoV], [4.5, 0, railGeoV]]) {
    const rail = new THREE.Mesh(geo, MAT.brushed);
    rail.position.set(gx, 0.13, gz);
    scene.add(rail);
  }
  const screwGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.2, 6);
  for (const [sx, sz] of [[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5]]) {
    const s = new THREE.Mesh(screwGeo, MAT.metal);
    s.position.set(sx, 0.28, sz);
    scene.add(s);
  }
}

/* ─────────────── memory array — RAM slots + modules ─────────────── */
{
  const slotGeo = new THREE.BoxGeometry(15, 0.5, 0.8);
  const stickGeo = new THREE.BoxGeometry(14.2, 2.5, 0.22);
  const chipGeo = new THREE.BoxGeometry(1.5, 1.1, 0.1);
  const heatGeo = new THREE.BoxGeometry(14.4, 2.7, 0.34);
  for (let i = 0; i < 4; i++) {
    const z = REGIONS.memory.z - 4.6 + i * 3.1;
    const slot = new THREE.Mesh(slotGeo, MAT.slotDark);
    slot.position.set(REGIONS.memory.x, 0.25, z);
    scene.add(slot);
    /* gold contact line inside the slot */
    const contact = new THREE.Mesh(new THREE.BoxGeometry(13.8, 0.06, 0.16), MAT.gold);
    contact.position.set(REGIONS.memory.x, 0.52, z);
    scene.add(contact);
    if (i % 2 === 0) {                                        /* two slots populated */
      const stick = new THREE.Mesh(heatGeo, MAT.brushed);
      stick.position.set(REGIONS.memory.x, 1.85, z);
      scene.add(stick);
      const pcbEdge = new THREE.Mesh(stickGeo, MAT.slotDark);
      pcbEdge.position.set(REGIONS.memory.x, 1.7, z + 0.02);
      scene.add(pcbEdge);
      for (let cIdx = 0; cIdx < 8; cIdx++) {
        const ch = new THREE.Mesh(chipGeo, MAT.chip);
        ch.position.set(REGIONS.memory.x - 6.2 + cIdx * 1.78, 1.8, z + 0.24);
        scene.add(ch);
      }
    }
  }
}

/* ─────────────── expansion — PCIe slots + seated module ─────────────── */
{
  const slotGeo = new THREE.BoxGeometry(17, 0.62, 1.0);
  for (let i = 0; i < 3; i++) {
    const z = REGIONS.pcie.z - 3.4 + i * 3.4;
    const slot = new THREE.Mesh(slotGeo, MAT.slotDark);
    slot.position.set(REGIONS.pcie.x, 0.31, z);
    scene.add(slot);
    const contact = new THREE.Mesh(new THREE.BoxGeometry(15.6, 0.05, 0.2), MAT.gold);
    contact.position.set(REGIONS.pcie.x, 0.64, z);
    scene.add(contact);
  }
  /* one seated accelerator module with a finned heatsink */
  const card = new THREE.Mesh(new THREE.BoxGeometry(15.4, 4.4, 0.24), MAT.slotDark);
  card.position.set(REGIONS.pcie.x, 2.5, REGIONS.pcie.z - 3.4);
  scene.add(card);
  const finGeo = new THREE.BoxGeometry(13.6, 0.16, 0.9);
  for (let f = 0; f < 10; f++) {
    const fin = new THREE.Mesh(finGeo, MAT.brushed);
    fin.position.set(REGIONS.pcie.x, 1.1 + f * 0.34, REGIONS.pcie.z - 4.05);
    scene.add(fin);
  }
}

/* ─────────────── power delivery — heatsinks over the VRMs ─────────────── */
{
  const base = new THREE.Mesh(new THREE.BoxGeometry(18, 0.5, 3.2), MAT.brushed);
  base.position.set(REGIONS.power.x - 0.6, 1.0, REGIONS.power.z - 6.4);
  scene.add(base);
  const finGeo = new THREE.BoxGeometry(0.24, 1.7, 3.0);
  for (let i = 0; i < 22; i++) {
    const fin = new THREE.Mesh(finGeo, MAT.brushed);
    fin.position.set(REGIONS.power.x - 9 + i * 0.8, 2.1, REGIONS.power.z - 6.4);
    scene.add(fin);
  }
  /* EMI shield can nearby */
  const shield = new THREE.Mesh(new THREE.BoxGeometry(7, 0.9, 5), MAT.metal);
  shield.position.set(REGIONS.power.x + 12, 0.45, REGIONS.power.z + 4);
  scene.add(shield);
}

/* ─────────────── diagnostic LEDs — patient, tiny, alive ─────────────── */
const leds = [];
{
  const geo = new THREE.BoxGeometry(0.16, 0.1, 0.28);
  const spots = [
    ...scatter(REGIONS.power, 5, 12, { y: 0.06 }),
    ...scatter(REGIONS.memory, 4, 12, { y: 0.06 }),
    ...scatter(REGIONS.pcie, 4, 12, { y: 0.06 }),
    ...scatter(REGIONS.routing, 5, 14, { y: 0.06 }),
  ];
  const palette = [COL.amber, COL.violet, COL.green, 0xdfe4ee];
  for (const p of spots) {
    const mat = new THREE.MeshBasicMaterial({ color: palette[Math.floor(rnd() * palette.length)] });
    const led = new THREE.Mesh(geo, mat);
    led.position.set(p.x, p.y, p.z);
    led.userData = { phase: rnd() * Math.PI * 2, speed: 0.25 + rnd() * 0.5, base: mat.color.clone() };
    scene.add(led);
    leds.push(led);
  }
}

/* ─────────────── electrical pulses — one every few seconds ───────────────
   Signals travel between regions along gently bent paths. Quiet.        */

const PULSE_PATHS = [
  [REGIONS.power, REGIONS.cpu],
  [REGIONS.cpu, REGIONS.memory],
  [REGIONS.cpu, REGIONS.pcie],
  [REGIONS.routing, REGIONS.cpu],
  [REGIONS.memory, REGIONS.pcie],
  [REGIONS.routing, REGIONS.power],
].map(([a, b]) => {
  const mid1 = a.clone().lerp(b, 0.35); mid1.x += (rnd() - 0.5) * 14; mid1.z += (rnd() - 0.5) * 14;
  const mid2 = a.clone().lerp(b, 0.7);  mid2.z += (rnd() - 0.5) * 14;
  const pts = [a.clone(), mid1, mid2, b.clone()].map(p => new THREE.Vector3(p.x, 0.12, p.z));
  return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.9);
});

const pulsePool = [];
{
  const geo = new THREE.SphereGeometry(0.16, 10, 10);
  for (let i = 0; i < 4; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xcabcff, transparent: true, opacity: 0 });
    const m = new THREE.Mesh(geo, mat);
    m.visible = false;
    const l = new THREE.PointLight(0xa78bfa, 0, 7, 2);
    m.add(l);
    m.userData = { active: false, t: 0, dur: 3, curve: null, light: l };
    scene.add(m);
    pulsePool.push(m);
  }
}
let nextPulseAt = 2.5;

function firePulse(time) {
  const p = pulsePool.find(p => !p.userData.active);
  if (!p) return;
  p.userData.active = true;
  p.userData.t = 0;
  p.userData.dur = 2.6 + rnd() * 1.6;
  p.userData.curve = PULSE_PATHS[Math.floor(Math.random() * PULSE_PATHS.length)];
  p.visible = true;
  nextPulseAt = time + 3.5 + Math.random() * 3.5;             // one pulse every few seconds
}

/* ───────────────────── post-processing pipeline ───────────────────── */

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.32,   // strength — very subtle
  0.85,   // radius — soft
  0.82    // threshold — only true highlights bloom
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* ───────────────────── camera rig + interaction ───────────────────── */

const cam = {
  pos: WAYPOINTS[0].pos.clone(),
  tgt: WAYPOINTS[0].tgt.clone(),
  mouse: new THREE.Vector2(0, 0),
  mouseSmooth: new THREE.Vector2(0, 0),
};

window.addEventListener('pointermove', (e) => {
  cam.mouse.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
}, { passive: true });

/* scroll progress 0..(sections-1), heavily damped */
let scrollProgress = 0, scrollTargetProgress = 0;
function readScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  scrollTargetProgress = max > 0 ? (window.scrollY / max) * (WAYPOINTS.length - 1) : 0;
}
window.addEventListener('scroll', readScroll, { passive: true });
readScroll();

/* waypoint interpolation with eased local segment */
const wp = { p: new THREE.Vector3(), t: new THREE.Vector3() };
function sampleWaypoints(prog) {
  const i = Math.min(Math.floor(prog), WAYPOINTS.length - 2);
  let f = prog - i;
  f = f * f * (3 - 2 * f);                                    // smoothstep between stations
  wp.p.lerpVectors(WAYPOINTS[i].pos, WAYPOINTS[i + 1].pos, f);
  wp.t.lerpVectors(WAYPOINTS[i].tgt, WAYPOINTS[i + 1].tgt, f);
}

/* section → region light choreography */
const SECTION_REGION = ['cpu', 'memory', 'routing', 'pcie', 'power', 'memory', 'cpu'];
const REGION_BASE_INTENSITY = { cpu: 14, memory: 10, routing: 10, pcie: 10, power: 9 };

/* UI hover events (dispatched from js/ui.js) softly excite regions */
window.addEventListener('ax:region', (e) => {
  const l = regionLights[e.detail.region];
  if (l) l.userData.boost = e.detail.active ? 8 : 0;
});

/* ───────────────────── loader handshake ───────────────────── */

let bootDone = false;
function finishBoot() {
  if (bootDone) return;
  bootDone = true;
  window.dispatchEvent(new CustomEvent('ax:booted'));
}

/* ───────────────────── frame loop ───────────────────── */

const clock = new THREE.Clock();
let frameCount = 0;
let fpsAccum = 0, fpsSamples = 0, degraded = false;

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  /* damped scroll → waypoint sample */
  scrollProgress += (scrollTargetProgress - scrollProgress) * Math.min(1, dt * 2.6);
  sampleWaypoints(THREE.MathUtils.clamp(scrollProgress, 0, WAYPOINTS.length - 1));

  /* luxury drift + micro parallax */
  cam.mouseSmooth.lerp(cam.mouse, Math.min(1, dt * 2.2));
  const driftX = REDUCED ? 0 : Math.sin(time * 0.11) * 0.55;
  const driftZ = REDUCED ? 0 : Math.cos(time * 0.09) * 0.45;
  cam.pos.copy(wp.p);
  cam.pos.x += driftX + cam.mouseSmooth.x * 0.9;
  cam.pos.y += Math.sin(time * 0.13) * 0.25 - cam.mouseSmooth.y * 0.5;
  cam.pos.z += driftZ;
  cam.tgt.copy(wp.t);
  cam.tgt.x += cam.mouseSmooth.x * 1.4;
  cam.tgt.z += cam.mouseSmooth.y * 1.0;

  camera.position.lerp(cam.pos, Math.min(1, dt * 3.2));
  camera.lookAt(cam.tgt);

  /* the board quietly breathes */
  boardMat.emissiveIntensity = 0.30 + Math.sin(time * 0.5) * 0.08;
  cpu.userData.glow.material.opacity = 0.8 + Math.sin(time * 0.7) * 0.2;

  /* region light choreography */
  const activeRegion = SECTION_REGION[Math.round(THREE.MathUtils.clamp(scrollProgress, 0, 6))];
  for (const [name, l] of Object.entries(regionLights)) {
    const want = (name === activeRegion ? (REGION_BASE_INTENSITY[name] || 10) : name === 'cpu' ? 6 : 0) + l.userData.boost;
    l.intensity += (want - l.intensity) * Math.min(1, dt * 2);
  }

  /* patient LED blinking */
  for (const led of leds) {
    const s = 0.35 + 0.65 * Math.max(0, Math.sin(time * led.userData.speed + led.userData.phase));
    led.material.color.copy(led.userData.base).multiplyScalar(s * 1.6);
  }

  /* electrical pulses */
  if (!REDUCED && time > nextPulseAt) firePulse(time);
  for (const p of pulsePool) {
    if (!p.userData.active) continue;
    p.userData.t += dt / p.userData.dur;
    if (p.userData.t >= 1) {
      p.userData.active = false; p.visible = false; p.userData.light.intensity = 0;
      continue;
    }
    const t = p.userData.t;
    p.userData.curve.getPointAt(t, p.position);
    const env = Math.sin(t * Math.PI);                        // fade in/out over the journey
    p.material.opacity = env;
    p.userData.light.intensity = env * 3.2;
  }

  composer.render();

  /* adaptive quality: if the GPU struggles, step the pixel ratio down once */
  fpsAccum += dt; fpsSamples++;
  if (!degraded && fpsSamples === 120) {
    if (fpsAccum / fpsSamples > 1 / 42) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.1));
      composer.setPixelRatio?.(Math.min(window.devicePixelRatio, 1.1));
      degraded = true;
    }
  }

  if (++frameCount === 3) finishBoot();
  requestAnimationFrame(tick);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

requestAnimationFrame(tick);
