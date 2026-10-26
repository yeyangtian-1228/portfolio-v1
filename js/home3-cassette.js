// WebGL cassette for home3.html (three.js). It fades in over the flat SVG fallback once the
// first frame is drawn; if WebGL or the module fails, the SVG stays.
//
// Modelled 1:1 on a tinted see-through cassette (the reference is a blue FUJI CDFAN1), in
// light grey: no paper label, the print sits on the plastic; big frosted hubs with square
// windows and toothed drive holes; a very full supply pack on the left and a nearly empty
// take-up reel on the right (only its flange edge shows); black screws; the moulded top rail,
// tape window frame and head section with its posts, openings and corner guide rollers.
// The print is ours (title, side, egg mark, name), laid out where the reference has its own.
//
// Units are CSS px of the 560 × 356 tape (front face at z = D/2, y up, origin at the centre),
// so positions read straight off a top-left drawing: (x, y) → (x − 280, 178 − y).
// The canvas is 720 × 516 of those units, centred on the tape, so it can tilt without clipping.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const wrap = document.getElementById("tape");
const canvas = wrap?.querySelector("canvas");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

const W = 560, H = 356, D = 64;           // shell; a real C-cassette is ~100 × 64 × 12 mm
const CW = 720, CH = 516;                 // canvas, in the same units
const fx = x => x - W / 2, fy = y => H / 2 - y;   // drawing → world

// Each tape (the keys on the page swap between them with a "tape" event): its print, and the
// shell it's moulded in. About is light grey with dark print; Works is cool white, matte and
// misty grey-white, with dark print and its tracklist on it; Other is solid white, dark print. Hovering a project card on the page sends a "track" event:
// the tape winds to that track, its row lights up and the big number shows it.
const RED = "#D2412F";
const PRINTS = {
  about: { title: "ABOUT ME", sub: "SIDE A · VOL.01 · NORMAL POSITION", mark: "DYT 01", num: "01", side: "A", ink: "#2B2B2E",
           name: "D A N I   Y E Y A N G   T I A N" },
  works: { title: "PROJECTS", sub: "SIDE B · VOL.02 · NORMAL POSITION", mark: "DYT 02", num: "02", side: "B", ink: "#22262C",
           tracks: [{ code: "B1", name: "VERDURE", color: "#6fd197", at: 0.06 },
                    { code: "B2", name: "CLICKET", color: "#ff6f6f", at: 0.4 },
                    { code: "B3", name: "MICROSOFT FABRIC", color: "#8a6cc0", at: 0.74 }] },
  other: { title: "OTHER WORK", sub: "SIDE C · VOL.03 · BONUS TRACKS", mark: "DYT 03", num: "03", side: "C", ink: "#22262C",
           name: "S I D E   P R O J E C T S   ·   S O O N" },
};
// frost: a matte, grainy finish (rougher, softer highlights, fine speckle in colour and
// opacity) that veils the inside more, instead of glossy clear plastic; rough overrides its roughness.
// The three step from see-through grey (About) through misty grey-white (Works) to solid white (Other).
const SHELLS = {
  about: { color: 0xa9afb7, opacity: 0.5, edge: 0x737c87, ghost: 0x6f7883, light: 0.7, frost: true, rough: 0.82 },
  works: { color: 0xd3d7dc, opacity: 0.76, edge: 0x9ea6af, ghost: 0x949ca5, light: 0.8, frost: true, rough: 0.45 },
  other: { color: 0xf7f8f9, opacity: 0.99, edge: 0xb9bfc6, ghost: 0xaeb4bb, light: 0.9, frost: true, rough: 0.5 },
};
const REELS = [{ x: 160, y: 166 }, { x: 398, y: 167 }];   // supply (left), take-up (right)
const HUB = { r: 61, inner: 40, hole: 29 };
const FLANGE = 119;                       // the clear reel flanges' edge
// The tape plays from the left spool onto the right at a constant speed, so the left pack
// shrinks while the right one grows and their combined area (the amount of tape) stays the
// same: L² + R² = min² + max². A spool turns at tape speed ÷ its pack radius, so the smaller
// pack spins faster. At the end the tape rewinds quickly to the start, spools racing backwards.
const TAPE_RUN = { min: 64, max: 117, play: 60, rewind: 3.2, startTurn: 2.4 };   // radii px; s; s per turn of the empty spool

// ---------- helpers ----------
const roundRect = (s, x, y, w, h, r) => {   // world coords, y up; (x, y) = bottom-left
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
};
const ring = (outer, inner, depth, mat, seg = 72) => {
  const s = new THREE.Shape().absarc(0, 0, outer, 0, Math.PI * 2, false);
  s.holes.push(new THREE.Path().absarc(0, 0, inner, 0, Math.PI * 2, true));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: seg });
  g.translate(0, 0, -depth / 2);
  return new THREE.Mesh(g, mat);
};
const disc = (r, depth, mat, seg = 48) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, depth, seg), mat);
  m.rotation.x = Math.PI / 2;
  return m;
};
const v = (x, y) => new THREE.Vector2(fx(x), fy(y));
const circlePts = (x, y, r, n = 120) => Array.from({ length: n }, (_, i) => v(x + r * Math.cos(i / n * Math.PI * 2), y + r * Math.sin(i / n * Math.PI * 2)));

// ---------- print on the plastic ----------
async function printTexture(PRINT, active = -1) {
  const INK = PRINT.ink;
  await Promise.all([
    document.fonts.load('600 44px "Instrument Sans"'),
    document.fonts.load('italic 600 30px "Instrument Sans"'),
    document.fonts.load('500 12px "Geist Mono"'),
  ]).catch(() => {});
  const s = 4, c = document.createElement("canvas");
  c.width = W * s; c.height = H * s;
  const g = c.getContext("2d");
  g.scale(s, s);
  const text = (str, x, y, font, color, spacing = 0, align = "left") => {
    g.font = font; g.fillStyle = color; g.textAlign = align;
    if ("letterSpacing" in g) g.letterSpacing = spacing + "px";
    g.fillText(str, x, y);
  };
  text(PRINT.title, 44, 64, '600 30px "Instrument Sans", system-ui, sans-serif', INK, -0.3);
  // the small spec line follows the top of the pack, like the reference's; a long title pushes it right
  const subX = Math.max(200, 44 + g.measureText(PRINT.title).width + 10);
  g.save(); g.translate(subX + 100, 52); g.rotate(0.04);
  text(PRINT.sub, -100, 0, '500 10px "Geist Mono", ui-monospace, monospace', INK, 1);
  g.restore();
  // (the egg mark beside the model name is its own animated piece; see eggMark)
  text(PRINT.mark, 400, 86, 'italic 600 30px "Instrument Sans", system-ui, sans-serif', INK, 0.5);
  text(active >= 0 ? PRINT.tracks[active].code : PRINT.num, 44, 178, 'italic 600 26px "Instrument Sans", system-ui, sans-serif', RED);
  g.strokeStyle = INK; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(86, 140); g.lineTo(86, 202); g.stroke();
  // side badge
  g.strokeStyle = RED; g.lineWidth = 2;
  g.beginPath(); g.arc(512, 168, 13, 0, Math.PI * 2); g.stroke();
  text(PRINT.side, 512, 175, '600 18px "Instrument Sans", system-ui, sans-serif', RED, 0, "center");
  // tape counter ticks in the window between the hubs
  g.strokeStyle = INK; g.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) { const x = 232 + i * 12; g.beginPath(); g.moveTo(x, 160); g.lineTo(x, 174); g.stroke(); }
  if (PRINT.name) text(PRINT.name, 86, 248, 'italic 600 15px "Instrument Sans", system-ui, sans-serif', INK, 0.5);
  // tracklist: a coloured dot per project; the track the tape is on is bright, with a ▶
  (PRINT.tracks || []).forEach((tr, i) => {
    const y = 232 + i * 15, on = i === active;
    g.globalAlpha = active < 0 || on ? 1 : 0.5;
    g.fillStyle = tr.color; g.beginPath(); g.arc(90, y - 4, 3.6, 0, Math.PI * 2); g.fill();
    text(`${on ? "▶ " : ""}${tr.code}  ${tr.name}`, 100, y, `${on ? 600 : 500} 11px "Geist Mono", ui-monospace, monospace`, INK, 1.2);
    g.globalAlpha = 1;
  });
  g.beginPath(); g.moveTo(452, 246); g.lineTo(486, 236); g.lineTo(476, 244); g.lineTo(498, 238); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ---------- egg mark ----------
// The site favicon (a cracked egg) in the print red, centred on (346, 98), 48 px square.
// It starts whole, wobbles and cracks, the top of the shell pops off (the favicon pose) and
// the dragon flies out; when the dragon has gone the top settles back and the egg is whole.
const EGG = { x: 346, y: 98, size: 48, view: { x: 80, y: 215, s: 960 } };
const EGG_TOP = "M294 373H394L410 462 525 448 551 554 667 536 697 646 817 629C860 520 852 382 760 300 705 252 640 234 560 234 440 236 352 298 294 373Z";
const EGG_BOTTOM = "M248 808L320 714 386 750 481 638 576 697 635 622 740 705 818 656C865 725 878 790 874 850 865 1000 740 1155 562 1155 380 1155 280 990 248 808Z";
const EGG_WHOLE = "M561 300C760 300 874 600 874 850 874 1030 735 1155 561 1155 387 1155 248 1030 248 850 248 600 362 300 561 300Z";
const EGG_CRACK = "M262 760L330 700 390 735 480 640 575 700 635 625 740 705 860 650";
// timeline (s): whole → wobble + crack → pop open → dragon out → close → whole
const T = { wobble: 0.55, pop: 1.15, peek: 1.25, hatch: 2.35, cycle: 8.4 };

function eggMark() {
  const k = EGG.size / EGG.view.s;                     // view units → world
  const toWorld = (vx, vy) => [(vx - (EGG.view.x + EGG.view.s / 2)) * k, -(vy - (EGG.view.y + EGG.view.s / 2)) * k];
  const piece = (draw) => {
    const c = document.createElement("canvas"), px = 384;
    c.width = c.height = px;
    const g = c.getContext("2d");
    g.scale(px / EGG.view.s, px / EGG.view.s); g.translate(-EGG.view.x, -EGG.view.y);
    draw(g);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false, toneMapped: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(EGG.size, EGG.size), mat);
    m.renderOrder = 4;
    return m;
  };
  const red = path => g => { g.fillStyle = RED; g.fill(new Path2D(path)); };
  // pivots: the whole egg rocks on its bottom; the top lid hinges on its lower-right tip
  const hold = (mesh, vx, vy) => { const p = new THREE.Group(), [x, y] = toWorld(vx, vy); p.position.set(x, y, 0); mesh.position.set(-x, -y, 0); p.add(mesh); return p; };
  const wholeMesh = piece(red(EGG_WHOLE));
  const crackMesh = piece(g => { g.strokeStyle = "#eef0f2"; g.lineWidth = 34; g.lineJoin = "round"; g.lineCap = "round"; g.stroke(new Path2D(EGG_CRACK)); });
  wholeMesh.add(crackMesh); crackMesh.position.z = 0.05; crackMesh.renderOrder = 5;
  const whole = hold(wholeMesh, 561, 1155);
  const top = hold(piece(red(EGG_TOP)), 817, 629);
  const bottom = piece(red(EGG_BOTTOM));
  const group = new THREE.Group();
  group.add(whole, top, bottom);
  group.position.set(fx(EGG.x), fy(EGG.y), 0);
  const closed = { x: 1.2, y: -2.6, r: -0.28 };        // the lid sitting down on the shell
  const setLid = (e) => {                              // e: 0 closed → 1 open (may overshoot)
    top.children[0].parent.position.set(toWorld(817, 629)[0] + closed.x * (1 - e), toWorld(817, 629)[1] + closed.y * (1 - e), 0);
    top.rotation.z = closed.r * (1 - e);
  };
  const backOut = x => { const c = 2.2; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  return {
    group,
    update(time, still = false) {   // still: just the mark, cracked open, no hatching
      if (reduce || still) { whole.visible = false; top.visible = bottom.visible = true; setLid(1); return; }
      const open = time >= T.pop && time < T.cycle - 0.15;
      whole.visible = !open; top.visible = bottom.visible = open;
      if (!open) {
        // still, then a wobble that grows as the crack spreads
        const w = time < T.wobble || time > T.pop ? 0 : (time - T.wobble) / (T.pop - T.wobble);
        whole.rotation.z = Math.sin(time * 38) * 0.13 * w;
        crackMesh.material.opacity = w;
        return;
      }
      const shut = T.cycle - 0.15 - 0.45;              // the lid comes back down after the dragon
      if (time < T.pop + 0.4) setLid(backOut((time - T.pop) / 0.4));
      else if (time > shut) setLid(1 - Math.min(1, (time - shut) / 0.4) ** 2);
      else setLid(1);
    },
  };
}

// ---------- dragon ----------
// assets/home3/dragon-fly.png holds three black flight poses left to right on white (wings
// level, wings up, wings high and climbing), with thin arrows between them. The poses are
// found as connected shapes (the arrows are dropped as thin strokes, and claws or spines
// that come loose join the pose they sit in), trimmed, lined up on their heads, and
// recoloured to the print red with white as transparent. Once the egg mark cracks open the
// dragon's head pokes up out of the shell and looks around, then it jumps out, faces left and
// flies off drifting down, beating its wings through the poses, and fades out; and again.
const FLY = { egg: 340, to: 112, y: 82, drop: 10, h: 60, lap: 5.4, beats: 5 };   // drawing px; y = head line leaving the egg
// peeking: the head comes up out of the shell (everything below the rim is clipped away),
// looks around, then the dragon jumps out into its flight
const PEEK = { x: 344, from: 114, to: 88, s: 0.5, tilt: -0.55 };
// What of the dragon is still "in the egg" is hidden by an invisible mask that only writes
// depth: below the opening from the egg's left side rightwards, and everything right of the
// egg. The head shows above the opening; body and tail slide out of the shell as it flies off.
const MASK = { rim: 100, left: 332, right: 362 };
async function dragonSprite() {
  const img = new Image();
  img.src = "assets/home3/dragon-fly.png";
  await img.decode();
  const src = document.createElement("canvas");
  src.width = img.naturalWidth; src.height = img.naturalHeight;
  const sg = src.getContext("2d", { willReadFrequently: true });
  sg.drawImage(img, 0, 0);
  const { data, width, height } = sg.getImageData(0, 0, src.width, src.height);
  const isInk = i => 255 - (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3 > 90;
  // connected shapes (8-neighbour flood fill)
  const label = new Int32Array(width * height).fill(-1), parts = [];
  for (let i = 0; i < width * height; i++) {
    if (label[i] >= 0 || !isInk(i)) continue;
    const box = { x0: width, x1: 0, y0: height, y1: 0, n: 0 }, stack = [i];
    label[i] = parts.length;
    while (stack.length) {
      const j = stack.pop(), x = j % width, y = (j - x) / width;
      box.n++; box.x0 = Math.min(box.x0, x); box.x1 = Math.max(box.x1, x); box.y0 = Math.min(box.y0, y); box.y1 = Math.max(box.y1, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, k = ny * width + nx;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height && label[k] < 0 && isInk(k)) { label[k] = parts.length; stack.push(k); }
      }
    }
    parts.push(box);
  }
  // the three biggest shapes are the bodies. Arrow shafts are long and very flat, and an
  // arrow's head is whatever small bit sits on its shaft; both are dropped. Other small bits
  // join the body whose box contains their centre.
  const bodies = [...parts].sort((a, b) => b.n - a.n).slice(0, 3).sort((a, b) => a.x0 - b.x0);
  if (bodies.length < 2) throw new Error("dragon poses not found");
  const boxes = bodies.map(b => ({ ...b }));
  // an arrow is a small, low, wide mark (shaft and head usually one shape, ~40 × 13 px here)
  const flat = p => { const w = p.x1 - p.x0 + 1, h = p.y1 - p.y0 + 1; return p.n < bodies[0].n * 0.03 && h <= 20 && w > 2 * h; };
  const shafts = parts.filter(p => !bodies.includes(p) && flat(p));
  const onShaft = (cx, cy) => shafts.some(a => cx >= a.x0 - 4 && cx <= a.x1 + 14 && cy >= a.y0 - 14 && cy <= a.y1 + 14);
  for (const p of parts) {
    if (bodies.includes(p) || p.n < 4 || flat(p)) continue;
    const cx = (p.x0 + p.x1) / 2, cy = (p.y0 + p.y1) / 2;
    if (p.n < bodies[0].n * 0.02 && onShaft(cx, cy)) continue;   // an arrow head
    const b = boxes.find(b => cx >= b.x0 - 8 && cx <= b.x1 + 8 && cy >= b.y0 - 8 && cy <= b.y1 + 8);
    if (b) { b.x0 = Math.min(b.x0, p.x0); b.x1 = Math.max(b.x1, p.x1); b.y0 = Math.min(b.y0, p.y0); b.y1 = Math.max(b.y1, p.y1); b.parts = [...(b.parts || []), p]; }
  }
  // paint each pose's own shapes into its cell: nose right, head at the top
  boxes.forEach(b => { b.w = b.x1 - b.x0 + 1; b.h = b.y1 - b.y0 + 1; });
  const cw = Math.max(...boxes.map(b => b.w)), ch = Math.max(...boxes.map(b => b.h));
  const atlas = document.createElement("canvas");
  atlas.width = cw * boxes.length; atlas.height = ch;
  const ag = atlas.getContext("2d");
  const out = ag.createImageData(atlas.width, atlas.height);
  boxes.forEach((b, f) => {
    const own = new Set([parts.indexOf(bodies[f]), ...(b.parts || []).map(p => parts.indexOf(p))]);
    const ox = f * cw + (cw - b.w);
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
      const i = y * width + x;
      if (!own.has(label[i])) continue;
      const o = ((y - b.y0) * atlas.width + (ox + x - b.x0)) * 4;
      out.data[o] = out.data[o + 1] = out.data[o + 2] = 0; out.data[o + 3] = 255;
    }
  });
  ag.putImageData(out, 0, 0);
  // soften the cut edges a little, then lay it on white so the recolour below reads ink from it
  const soft = document.createElement("canvas");
  soft.width = atlas.width; soft.height = atlas.height;
  const sx = soft.getContext("2d");
  sx.fillStyle = "#fff"; sx.fillRect(0, 0, soft.width, soft.height);
  sx.filter = "blur(0.6px)"; sx.drawImage(atlas, 0, 0); sx.filter = "none";
  ag.clearRect(0, 0, atlas.width, atlas.height); ag.drawImage(soft, 0, 0);
  const px = ag.getImageData(0, 0, atlas.width, atlas.height), p = px.data;
  const [r, g, bl] = [0xD2, 0x41, 0x2F];
  for (let i = 0; i < p.length; i += 4) {
    const a = Math.max(0, 255 - (p[i] + p[i + 1] + p[i + 2]) / 3);
    p[i] = r; p[i + 1] = g; p[i + 2] = bl; p[i + 3] = Math.min(255, a * 1.15);
  }
  ag.putImageData(px, 0, 0);
  const tex = new THREE.CanvasTexture(atlas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(1 / boxes.length, 1);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
  const h = FLY.h, w = h * cw / ch;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  const n = boxes.length;
  const BEAT = n === 3 ? [0, 1, 2, 1] : [...Array(n).keys()];    // level → up → high → up → …
  const headLocal = new THREE.Vector2(w * 0.42, h * 0.38);          // near the nose tip, in the art's own frame
  const ease = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  return {
    mesh,
    // state: null (hidden), { peek: 0…1 } or { fly: 0…1 }
    update(t, state) {
      mesh.visible = !!state;
      if (!state) return;
      mat.opacity = 1;
      if (state.peek != null) {
        // head first: rises out of the shell nose-up, then looks left and right
        const p = state.peek, s = PEEK.s;
        tex.offset.x = 0;
        const look = p > 0.4 ? Math.sin((p - 0.4) / 0.6 * Math.PI * 2) * 0.14 : 0;
        const r = PEEK.tilt + look;
        const hy = PEEK.from + (PEEK.to - PEEK.from) * ease(p / 0.4) + (p > 0.4 ? Math.sin(t * 6) * 0.8 : 0);
        mesh.scale.set(-s, s, 1);
        mesh.rotation.z = r;
        const v = new THREE.Vector2(-headLocal.x * s, headLocal.y * s).rotateAround(new THREE.Vector2(), r);
        mesh.position.x = fx(PEEK.x) - v.x;
        mesh.position.y = fy(hy) - v.y;
        return;
      }
      const k = state.fly;
      // wings level as it jumps out, then wingbeats through the poses
      const f = reduce || k < 0.06 ? 0 : BEAT[Math.floor(t * FLY.beats) % BEAT.length];
      tex.offset.x = f / n;
      // path: a little hop out of the egg, then drifting down and away to the left, bobbing
      const p = Math.min(1, k * 1.05);
      const nose = FLY.egg - (FLY.egg - FLY.to) * Math.pow(p, 1.15);
      const head = FLY.y + FLY.drop * Math.pow(p, 1.3) - 7 * Math.sin(Math.PI * Math.min(1, p * 3))
        + (reduce ? 0 : Math.sin(t * 4.4) * 2.2 * Math.min(1, k * 6));
      const s = k < 0.14 ? PEEK.s + (1 - PEEK.s) * ease(k / 0.14) : 1;   // grows as it leaves the shell
      mesh.scale.set(-s, s, 1);                                 // mirrored: the art faces right
      const level = 0.07 * Math.min(1, p * 2);                  // nose a touch down as it descends
      mesh.rotation.z = PEEK.tilt * (1 - ease(k / 0.1)) + level;
      mesh.position.x = fx(nose) + (w * s) / 2;
      mesh.position.y = fy(head) - (h * s) / 2;
      mat.opacity = reduce ? 1 : Math.max(0, Math.min(1, (1 - k) / 0.14));
    },
  };
}

async function init() {
  if (!wrap || !canvas) return;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const fov = 18;
  const dist = (CH / 2) / Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const cam = new THREE.PerspectiveCamera(fov, CW / CH, 10, dist * 3);
  cam.position.set(0, 0, dist);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(-0.6, 0.9, 1);
  scene.add(sun, new THREE.AmbientLight(0xffffff, 0.45));

  // ---------- materials ----------
  // Tinted light-grey polystyrene: see-through, both faces drawn so walls and edges layer up.
  const shellMat = new THREE.MeshPhysicalMaterial({
    color: 0x9ea5ae, metalness: 0, roughness: 0.2,
    transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide,
    clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.3,
  });
  const edge = new THREE.LineBasicMaterial({ color: 0x737c87, transparent: true, opacity: 0.85 });
  const edgeLight = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
  const ghost = new THREE.LineBasicMaterial({ color: 0x6f7883, transparent: true, opacity: 0.45 });
  // fine grain for frosted shells
  const grain = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const g = c.getContext("2d"), d = g.createImageData(256, 256);
    for (let i = 0; i < d.data.length; i += 4) { const n = 205 + Math.random() * 50; d.data[i] = d.data[i + 1] = d.data[i + 2] = n; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2);
    return t;
  })();
  const setShell = sh => {
    shellMat.color.setHex(sh.color); shellMat.opacity = sh.opacity;
    shellMat.roughness = sh.rough ?? (sh.frost ? 0.62 : 0.2);
    shellMat.clearcoat = sh.frost ? 0.25 : 1;
    shellMat.clearcoatRoughness = sh.frost ? 0.45 : 0.05;
    shellMat.envMapIntensity = sh.frost ? 0.9 : 1.3;
    shellMat.map = sh.frost ? grain : null;
    shellMat.alphaMap = sh.frost ? grain : null;
    shellMat.needsUpdate = true;
    edge.color.setHex(sh.edge); ghost.color.setHex(sh.ghost); edgeLight.opacity = sh.light;
  };
  setShell(SHELLS.about);
  const frost = new THREE.MeshPhysicalMaterial({ color: 0xe4e7eb, roughness: 0.5, transparent: true, opacity: 0.95, envMapIntensity: 0.6 });
  const frostDim = new THREE.MeshStandardMaterial({ color: 0x9fa6af, roughness: 0.6 });
  const tape = new THREE.MeshStandardMaterial({ color: 0x1f1511, roughness: 0.5, envMapIntensity: 0.15 });
  const black = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.35, metalness: 0.3 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.3, metalness: 0.9 });
  const felt = new THREE.MeshStandardMaterial({ color: 0x8d9096, roughness: 0.9 });
  const print = new THREE.MeshBasicMaterial({ map: await printTexture(PRINTS.about), transparent: true, depthWrite: false, depthTest: false, toneMapped: false });
  // switching tapes: reprint the label and give the reels a quick fast-forward spin
  // switching tapes: new print and shell, and a quick fast-forward spin; tracks: wind to one
  let boost = 0, tapeName = "about", active = -1, printJob = 0;
  const reprint = async () => {
    const job = ++printJob, tex = await printTexture(PRINTS[tapeName], active);
    if (job !== printJob) { tex.dispose(); return; }             // a newer print won
    const old = print.map; print.map = tex; old.dispose();
  };
  addEventListener("tape", e => {
    if (!PRINTS[e.detail]) return;
    tapeName = e.detail; active = -1;
    setShell(SHELLS[tapeName]);
    reprint();
    boost = reduce ? 0 : 1;
  });
  // a key pressed before this module was ready
  if (PRINTS[document.body.dataset.tape] && document.body.dataset.tape !== tapeName) {
    tapeName = document.body.dataset.tape; setShell(SHELLS[tapeName]); reprint();
  }
  addEventListener("track", e => {
    const tr = PRINTS[tapeName].tracks?.[e.detail];
    if (!tr || e.detail === active) return;
    active = e.detail;
    reprint();
    seek(tr.at);
  });

  const root = new THREE.Group();     // pointer tilt + idle sway
  scene.add(root);
  const add = (m, x, y, z, order) => { m.position.set(x, y, z); if (order != null) m.renderOrder = order; root.add(m); return m; };
  const line = (pts, mat, z, closed = true) => {
    const l = new (closed ? THREE.LineLoop : THREE.Line)(new THREE.BufferGeometry().setFromPoints(pts), mat);
    l.position.z = z; l.renderOrder = 3; root.add(l); return l;
  };

  // ---------- inside: tape packs and hubs ----------
  const reels = [], packs = [];
  for (const r of REELS) {
    packs.push({ mesh: add(ring(TAPE_RUN.max, HUB.r - 1, D - 26, tape), fx(r.x), fy(r.y), -1), r: TAPE_RUN.max });
    // hub: frosted ring with eight square windows, a raised inner rim, and six drive teeth
    const hub = new THREE.Group();
    hub.add(ring(HUB.r, HUB.inner, 9, frost));
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4 + Math.PI / 8;
      const sq = new THREE.Mesh(new THREE.BoxGeometry(9, 9, 1), frostDim);
      sq.position.set(Math.cos(a) * 51, Math.sin(a) * 51, 4.8); sq.rotation.z = a;
      hub.add(sq);
    }
    hub.add(ring(HUB.inner, HUB.hole, 12, frost));
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3;
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(6, 7, 11), frost);
      tooth.position.set(Math.sin(a) * (HUB.hole - 3), Math.cos(a) * (HUB.hole - 3), 0);
      tooth.rotation.z = -a;
      hub.add(tooth);
    }
    for (const rad of [HUB.r, HUB.inner, HUB.hole]) {
      const o = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(new THREE.Path().absarc(0, 0, rad, 0, Math.PI * 2).getPoints(72)), ghost);
      o.position.z = rad === HUB.r ? 4.6 : 6.1; hub.add(o);
    }
    // renderOrder on the meshes, not the group: a group's order outranks its children's and
    // would draw the hubs after the dragon, over it
    hub.traverse(o => { o.renderOrder = 1; });
    hub.renderOrder = 0;
    add(hub, fx(r.x), fy(r.y), D / 2 - 12);
    reels.push(hub);
  }
  // clear flange edges of both spools (they show wherever the pack is small)
  for (const r of REELS) line(circlePts(r.x, r.y, FLANGE), ghost, 6);
  // pack radius: rebuilt only when it has moved half a pixel
  const setPack = (i, R) => {
    const p = packs[i];
    if (Math.abs(p.r - R) < 0.5) return;
    p.mesh.geometry.dispose();
    p.mesh.geometry = ring(R, HUB.r - 1, D - 26, tape).geometry;
    p.r = R;
  };

  // ---------- head section ----------
  // ---------- tape path ----------
  // Off the bottom-outer side of each pack, down round the corner guide roller and along the
  // bottom edge past the head: two slanted runs (they swing as the packs grow and shrink),
  // a wrap round each roller, and the run along the bottom.
  const GUIDE = { r: 20, y: 321, x: [58, 502] }, TAPE_Z = -1, TAPE_W = 18;
  add(new THREE.Mesh(new THREE.BoxGeometry(fx(GUIDE.x[1]) - fx(GUIDE.x[0]), 2.2, TAPE_W), tape), 0, fy(GUIDE.y + GUIDE.r), TAPE_Z);
  const runs = [0, 1].map(() => add(new THREE.Mesh(new THREE.BoxGeometry(1, 2.2, TAPE_W), tape), 0, 0, TAPE_Z));
  const wraps = [0, 1].map(i => ({ mesh: add(new THREE.Mesh(new THREE.BufferGeometry(), tape), fx(GUIDE.x[i]), fy(GUIDE.y), TAPE_Z), a: null }));
  const setTapePath = R => {
    [0, 1].forEach(i => {
      // outer common tangent of the pack (A, R) and the roller (B, r), on the outside edge
      const A = new THREE.Vector2(fx(REELS[i].x), fy(REELS[i].y)), B = new THREE.Vector2(fx(GUIDE.x[i]), fy(GUIDE.y));
      const d = B.clone().sub(A), L = d.length(), th = Math.atan2(d.y, d.x), ph = Math.acos((R[i] - GUIDE.r) / L);
      const pick = [th + ph, th - ph].map(a => ({ a, x: Math.cos(a) })).sort((p, q) => i === 0 ? p.x - q.x : q.x - p.x)[0].a;
      const p1 = A.clone().add(new THREE.Vector2(Math.cos(pick), Math.sin(pick)).multiplyScalar(R[i]));
      const p2 = B.clone().add(new THREE.Vector2(Math.cos(pick), Math.sin(pick)).multiplyScalar(GUIDE.r));
      const run = runs[i], seg = p2.clone().sub(p1);
      run.scale.x = seg.length();
      run.position.set((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, TAPE_Z);
      run.rotation.z = Math.atan2(seg.y, seg.x);
      // wrap round the roller from the tangent point to its bottom
      const bottom = -Math.PI / 2;
      const [start, end] = i === 0 ? [pick, bottom + Math.PI * 2] : [bottom, pick];
      let arc = end - start; while (arc < 0) arc += Math.PI * 2; while (arc > Math.PI * 2) arc -= Math.PI * 2;
      const w = wraps[i];
      if (w.a == null || Math.abs(w.a - arc) > 0.01) {
        w.mesh.geometry.dispose();
        w.mesh.geometry = new THREE.TorusGeometry(GUIDE.r, 1.1, 6, 24, arc);
        w.a = arc;
      }
      w.mesh.rotation.z = start;
    });
  };
  add(new THREE.Mesh(new THREE.BoxGeometry(40, 3, 10), metal), fx(281), fy(326), D / 2 - 10);
  add(new THREE.Mesh(new THREE.BoxGeometry(18, 9, 9), felt), fx(281), fy(334), D / 2 - 10);
  for (const x of [100, 462]) add(disc(4, D - 26, frost, 20), fx(x), fy(336), 0, 1);
  // corner guide rollers (frosted rings) and the round guide posts above them
  for (const x of [58, 502]) {
    add(ring(20, 11, 10, frost), fx(x), fy(321), D / 2 - 8, 1);
    add(ring(7, 3, 6, frost), fx(x), fy(321), D / 2 - 6, 1);
  }
  for (const x of [27, 533]) add(ring(8, 4, 6, frost), fx(x), fy(271), D / 2 - 6, 1);

  // ---------- shell ----------
  // moulded as two open halves split at the seam (z = 0), so the Other tape can come apart;
  // closed they draw exactly like the one box
  const halfOf = (geo, front) => {
    const pos = geo.attributes.position, keep = [];
    for (let t = 0; t < pos.count; t += 3) if ((pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2) > 0) === front) keep.push(t);
    const out = new THREE.BufferGeometry();
    for (const [n, a] of Object.entries(geo.attributes)) {
      const arr = new Float32Array(keep.length * 3 * a.itemSize);
      keep.forEach((t, i) => arr.set(a.array.subarray(t * a.itemSize, (t + 3) * a.itemSize), i * 3 * a.itemSize));
      out.setAttribute(n, new THREE.BufferAttribute(arr, a.itemSize));
    }
    return out;
  };
  const box = new RoundedBoxGeometry(W, H, D, 6, 14).toNonIndexed();
  const shellFront = add(new THREE.Mesh(halfOf(box, true), shellMat), 0, 0, 0, 2);
  const shellBack = add(new THREE.Mesh(halfOf(box, false), shellMat), 0, 0, 0, 2);
  box.dispose();
  // The Other tape's halves are trays instead: flat faces and straight walls, rounded only at
  // the corners and with a small bevel on the edges, so taken apart they read as moulded parts
  // rather than pillows. Each is open at the seam (its seam cap is dropped).
  const BEV = 1.5;
  const tray = front => {
    const sh = roundRect(new THREE.Shape(), fx(BEV), fy(H - BEV), W - 2 * BEV, H - 2 * BEV, 14 - BEV);
    const g = new THREE.ExtrudeGeometry(sh, { depth: D / 2 - 2 * BEV, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelSegments: 2, curveSegments: 10 }).toNonIndexed();
    g.translate(0, 0, BEV);                              // seam cap at z = 0, outer face at D/2
    const pos = g.attributes.position, keep = [];
    for (let t = 0; t < pos.count; t += 3) if (Math.max(pos.getZ(t), pos.getZ(t + 1), pos.getZ(t + 2)) > 0.01) keep.push(t);
    const out = new THREE.BufferGeometry();
    for (const [n, a] of Object.entries(g.attributes)) {
      const arr = new Float32Array(keep.length * 3 * a.itemSize);
      keep.forEach((t, i) => arr.set(a.array.subarray(t * a.itemSize, (t + 3) * a.itemSize), i * 3 * a.itemSize));
      if (n === "uv") for (let i = 0; i < arr.length; i++) arr[i] /= W;   // shape units → about 0…1, for the grain
      out.setAttribute(n, new THREE.BufferAttribute(arr, a.itemSize));
    }
    g.dispose();
    const m = add(new THREE.Mesh(out, shellMat), 0, 0, 0, 2);
    if (!front) m.scale.z = -1;                          // the back tray is the front one mirrored
    m.visible = false;
    return m;
  };
  const trayFront = tray(true), trayBack = tray(false);
  // raised head block on the front
  const trap = new THREE.Shape();
  trap.moveTo(fx(88), fy(356)); trap.lineTo(fx(104), fy(276)); trap.lineTo(fx(459), fy(276)); trap.lineTo(fx(472), fy(356)); trap.closePath();
  add(new THREE.Mesh(new THREE.ExtrudeGeometry(trap, { depth: 6, bevelEnabled: true, bevelThickness: 1, bevelSize: 1, bevelSegments: 2 }), shellMat), 0, 0, D / 2 - 1, 2);

  // moulding, drawn as edges: outer and inner walls, seam, top rail, tape window, head posts
  const rr = (x, y, w, h, r, z, mat) => line(roundRect(new THREE.Shape(), fx(x), fy(y + h), w, h, r).getPoints(10), mat, z);
  rr(1, 1, W - 2, H - 2, 13, D / 2 + 0.2, edge);
  rr(1, 1, W - 2, H - 2, 13, -D / 2 - 0.2, edge);
  rr(6, 6, W - 12, H - 12, 10, D / 2 + 0.3, edgeLight);
  rr(13, 13, W - 26, H - 26, 8, D / 2 - 0.5, ghost);
  rr(1, 1, W - 2, H - 2, 13, 0, ghost);
  for (const y of [22, 36]) line([v(30, y), v(530, y)], ghost, D / 2 + 0.25, false);
  rr(84, 118, 394, 96, 10, D / 2 + 0.25, ghost);              // tape window frame
  line([v(88, 356), v(104, 276), v(459, 276), v(472, 356)], edge, D / 2 + 6.4, false);
  for (const x of [178, 239, 324, 387]) line([v(x, 282), v(x, 350)], ghost, D / 2 + 6.4, false);
  for (const [x, y, w, h] of [[118, 312, 24, 30], [150, 312, 24, 30], [410, 312, 24, 30], [442, 312, 24, 30]]) rr(x, y, w, h, 3, D / 2 + 6.4, ghost);

  // print on the outer face
  add(new THREE.Mesh(new THREE.PlaneGeometry(W, H), print), 0, 0, D / 2 + 0.15, 4);

  // the dragon that hatched from the egg mark, running along the strip under the title
  const egg = eggMark();
  egg.group.position.z = D / 2 + 0.2;
  root.add(egg.group);
  const dragon = await dragonSprite().catch(() => null);
  if (dragon) {
    dragon.mesh.renderOrder = 3.9;                       // under the egg, so the shell sits in front of it
    dragon.mesh.position.z = D / 2 + 0.25;
    root.add(dragon.mesh);
    const m = new THREE.Shape([v(MASK.left, MASK.rim), v(MASK.right, MASK.rim), v(MASK.right, 0), v(W, 0), v(W, H), v(MASK.left, H)]);
    const mask = new THREE.Mesh(new THREE.ShapeGeometry(m), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, transparent: true }));   // transparent: sorted after the shell and hubs, not before them
    mask.position.z = D / 2 + 0.3;                       // just in front of the dragon
    mask.renderOrder = 3.8;                              // drawn before it
    root.add(mask);
  }

  // ---------- screws ----------
  const screws = [];
  for (const [x, y] of [[20, 20], [542, 20], [20, 341], [542, 341], [281, 303]]) {
    const g = new THREE.Group();
    const head = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.5, 3, 32), black);
    head.rotation.x = Math.PI / 2;
    g.add(head);
    for (const rz of [0, Math.PI / 2]) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(7.5, 1.4, 1), new THREE.MeshStandardMaterial({ color: 0x050505 }));
      slot.position.z = 1.6; slot.rotation.z = rz + 0.35;
      g.add(slot);
    }
    screws.push(add(g, fx(x), fy(y), D / 2 + (y > 300 && x === 281 ? 7 : 1), 5));
  }

  // ---------- exploded view (Other tape) ----------
  // On the Other tape the cassette comes apart along its thickness as the pointer moves (any way),
  // like an assembly drawing: front half (with its print, moulding and head block), screws,
  // a clear liner sheet, the reels and tape, a second liner, back half. Each part keeps its
  // closed z and is pushed out by its layer's offset × how open it is.
  // the liner (slip) sheets: clear film with a hole over each hub; only seen while apart
  const linerMat = new THREE.MeshBasicMaterial({ color: 0xdfe3e8, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const linerEdge = new THREE.LineBasicMaterial({ color: 0x8e959e, transparent: true, opacity: 0 });
  const liner = z => {
    const sh = roundRect(new THREE.Shape(), fx(36), fy(262), 488, 176, 6);
    for (const p of REELS) sh.holes.push(new THREE.Path().absarc(fx(p.x), fy(p.y), HUB.r + 6, 0, Math.PI * 2, true));
    const m = add(new THREE.Mesh(new THREE.ShapeGeometry(sh, 24), linerMat), 0, 0, z, 1.5);
    for (const pts of [sh.getPoints(12), ...sh.holes.map(h => h.getPoints(48))]) {
      const l = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), linerEdge);
      l.renderOrder = 3; m.add(l);
    }
    m.visible = false;
    return m;
  };
  const liners = [liner(D / 2 - 4), liner(-D / 2 + 4)];
  // the halves are open shells with no thickness; apart, each gets the cut face of its wall
  // (a RIM-wide band round the seam) so it reads as moulded plastic, not a sheet
  const RIM = 4;
  const rims = [shellFront, shellBack].map(() => {
    const sh = roundRect(new THREE.Shape(), fx(0), fy(H), W, H, 14);
    sh.holes.push(roundRect(new THREE.Path(), fx(RIM), fy(H - RIM), W - 2 * RIM, H - 2 * RIM, 14 - RIM));
    const m = add(new THREE.Mesh(new THREE.ShapeGeometry(sh, 12), shellMat), 0, 0, 0, 2);
    m.visible = false;
    return m;
  });
  const LAYER = { front: 170, screws: 112, linerF: 58, mid: 0, linerB: -62, back: -170 };
  const parts = [];
  for (const o of root.children) {
    const z = o.position.z;
    const k = [shellFront, trayFront, rims[0]].includes(o) ? LAYER.front : [shellBack, trayBack, rims[1]].includes(o) ? LAYER.back
      : screws.includes(o) ? LAYER.screws : o === liners[0] ? LAYER.linerF : o === liners[1] ? LAYER.linerB
      : z >= D / 2 - 1.5 ? LAYER.front : z <= -D / 2 + 1 ? LAYER.back : LAYER.mid;
    if (k) parts.push({ o, z, k });
  }
  // Opening also flattens the view toward orthographic (an assembly drawing has no vanishing
  // point, so parallel edges stay parallel): a dolly zoom that backs the camera off up to
  // FLAT × as far while narrowing the lens so the tape plane stays the same size. (Blending the
  // projection matrices instead keeps nearly all of the perspective until the very end.)
  const FLAT = 40;
  let flatAt = -1;
  const setProjection = e => {
    if (Math.abs(e - flatAt) < 1e-4) return;
    flatAt = e;
    const d = dist * (1 + (FLAT - 1) * e);
    cam.position.z = d;
    cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan((CH / 2) / d));
    cam.near = Math.max(10, d - 2000); cam.far = d + 2000;
    cam.updateProjectionMatrix();
  };
  // open pose: seen from above and a little to the side, smaller and lower so the stack fits
  // under the keys; the shell clears up a little as it opens so the parts inside read
  const OPEN = { x: -1.05, y: 0.3, z: 0.1, s: 0.64, drop: -30, opacity: 0.72 };
  const OPEN_TONE = new THREE.Color(0xc9ced5);   // a touch greyer apart, so lit and shaded walls differ
  // stir: how much the pointer has moved over the deck (tape + panels), 0 … 1; every move there
  // opens it a little more, and it stays open while the pointer is on the deck. Once the pointer
  // leaves the deck (or the page) it winds back down and the cassette closes.
  const STIR = { full: 0.45, close: 1.4 };   // full: travel to open (× window width); close: s to shut
  const deck = wrap.closest(".deck") || document.body;
  let explode = 0, stir = 0, onDeck = false, lastPt = null;
  if (!reduce) {
    addEventListener("pointermove", e => {
      onDeck = deck.contains(e.target);
      if (onDeck && lastPt) stir = Math.min(1, stir + Math.hypot(e.clientX - lastPt.x, e.clientY - lastPt.y) / (innerWidth * STIR.full));
      lastPt = { x: e.clientX, y: e.clientY };
    });
    deck.addEventListener("pointerleave", () => { onDeck = false; lastPt = null; });
  }
  addEventListener("tape", () => { stir = 0; });

  // ---------- sizing ----------
  const fit = () => {
    renderer.setPixelRatio(Math.min(2.5, devicePixelRatio || 1) * canvas.clientWidth / CW);
    renderer.setSize(CW, CH, false);
  };
  fit();
  addEventListener("resize", fit);

  // ---------- motion ----------
  // Rest pose: turned a little so the shell's thickness and the screws catch the light;
  // the pointer tilts it a few degrees more. The reels always play.
  const rest = { x: -0.07, y: 0.11 };
  const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  const TILT_GAIN = { about: 1, works: 2.4, other: 1 };    // the Projects tape follows the pointer further
  if (!reduce) {
    addEventListener("pointermove", e => {
      const r = wrap.getBoundingClientRect();
      tilt.tx = THREE.MathUtils.clamp((e.clientX - (r.left + r.width / 2)) / innerWidth, -1, 1) * 0.35;
      tilt.ty = THREE.MathUtils.clamp((e.clientY - (r.top + r.height / 2)) / innerHeight, -1, 1) * 0.22;
    });
    document.addEventListener("pointerleave", () => { tilt.tx = 0; tilt.ty = 0; });
  }
  // where the tape is: u = 0 (all on the left) … 1 (all on the right), and how fast it moves
  const { min, max } = TAPE_RUN, total = min * min + max * max, span = max * max - min * min;
  const K = (Math.PI * 2 / TAPE_RUN.startTurn) * min / (span / TAPE_RUN.play);   // so the empty spool starts at one turn per startTurn s
  // tape position u (0 all on the left … 1 all on the right): plays forward; at the end it
  // rewinds to the start; a seek winds it (fast-forward or rewind) to a track's position
  const smooth = x => x * x * (3 - 2 * x), dsmooth = x => 6 * x * (1 - x);
  const pos = { u: 0, mode: "play", from: 0, to: 0, t0: 0, dur: 0 };
  function seek(to, now = performance.now()) {
    pos.mode = "wind"; pos.from = pos.u; pos.to = to; pos.t0 = now;
    pos.dur = (0.45 + 1.1 * Math.abs(to - pos.u)) * 1000;
  }
  const tapeStep = (now, dt) => {
    if (pos.mode === "play") {
      pos.u += dt / TAPE_RUN.play;
      if (pos.u >= 1) { pos.u = 1; pos.mode = "wind"; pos.from = 1; pos.to = 0; pos.t0 = now; pos.dur = TAPE_RUN.rewind * 1000; }
      return 1 / TAPE_RUN.play;
    }
    const x = Math.min(1, (now - pos.t0) / pos.dur);
    pos.u = pos.from + (pos.to - pos.from) * smooth(x);
    if (x >= 1) pos.mode = "play";
    return (pos.to - pos.from) * dsmooth(x) / (pos.dur / 1000);
  };
  let last = performance.now(), t = 0, shown = false;
  const frame = now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    if (!reduce) {
      const g = TILT_GAIN[tapeName] ?? 1;
      tilt.x += (tilt.tx * g - tilt.x) * Math.min(1, dt * 4);
      tilt.y += (tilt.ty * g - tilt.y) * Math.min(1, dt * 4);
    }
    {
      if (reduce && pos.mode === "wind") pos.u = pos.to;
      const du = reduce ? 0 : tapeStep(now, dt), u = reduce ? (pos.mode === "wind" ? pos.to : 0.15) : pos.u;
      const S = min * min + span * u, dS = span * du;               // S = right pack radius²
      const R = [Math.sqrt(total - S), Math.sqrt(S)];
      R.forEach((r, i) => {
        setPack(i, r);
        reels[i].rotation.z -= (K * dS / r + boost * 26 * (TAPE_RUN.min / r)) * dt;   // both spools turn the same way
      });
      setTapePath(R);
      boost = Math.max(0, boost - dt / 0.9);                        // the fast-forward spin dies away
    }
    // Other: opens as the pointer moves over the deck, closes again once it leaves
    if (!onDeck) stir = Math.max(0, stir - dt / STIR.close);
    const want = tapeName === "other" ? smooth(stir) : 0;
    explode += (want - explode) * Math.min(1, dt * 5);
    const E = explode < 0.001 ? 0 : explode;
    for (const p of parts) p.o.position.z = p.z + p.k * E;
    for (const l of [...liners, ...rims]) l.visible = E > 0.01;
    const trays = tapeName === "other";
    shellFront.visible = shellBack.visible = !trays; trayFront.visible = trayBack.visible = trays;
    linerMat.opacity = 0.32 * E; linerEdge.opacity = 0.7 * E;
    const lerp = THREE.MathUtils.lerp;
    root.rotation.y = lerp(rest.y + tilt.x + (reduce ? 0 : Math.sin(t * 0.6) * 0.015), OPEN.y, E);
    root.rotation.x = lerp(rest.x + tilt.y + (reduce ? 0 : Math.sin(t * 0.8) * 0.01), OPEN.x, E);
    root.rotation.z = OPEN.z * E;
    root.scale.setScalar(lerp(1, OPEN.s, E));
    root.position.y = OPEN.drop * E;
    shellMat.opacity = lerp(SHELLS[tapeName].opacity, OPEN.opacity, E);
    shellMat.color.setHex(SHELLS[tapeName].color).lerp(OPEN_TONE, E);
    setProjection(E);
    // egg + dragon run on the wall clock, so they keep time even on slow frames
    const clock = now / 1000, phase = clock % T.cycle;
    // the dragon only hatches on the About tape; elsewhere the egg is just the mark
    const hatching = tapeName === "about";
    egg.update(phase, !hatching);
    if (dragon) {
      const state = !hatching ? null : reduce ? { fly: 0.5 }
        : phase >= T.peek && phase < T.hatch ? { peek: (phase - T.peek) / (T.hatch - T.peek) }
        : phase >= T.hatch && phase < T.hatch + FLY.lap ? { fly: (phase - T.hatch) / FLY.lap } : null;
      dragon.update(clock, state);
    }
    renderer.render(scene, cam);
    if (!shown) { shown = true; wrap.classList.add("is-3d"); }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

init().catch(err => { console.warn("home3 cassette: showing the flat SVG", err); wrap?.classList.add("no-3d"); });
