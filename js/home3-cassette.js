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

// What's printed on this tape.
const PRINT = { title: "ABOUT ME", sub: "SIDE A · VOL.01 · NORMAL POSITION", mark: "DYT 01", num: "01", side: "A", name: "D A N I   Y E Y A N G   T I A N" };
const INK = "#2B2B2E", RED = "#D2412F";
const REELS = [{ x: 160, y: 166, pack: 127 }, { x: 398, y: 167, pack: 64 }];   // left full, right nearly empty
const HUB = { r: 61, inner: 40, hole: 29 };
const FLANGE = 119;                       // the clear reel flange edge around the right hub

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
async function printTexture() {
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
  // the small spec line follows the top of the pack, like the reference's
  g.save(); g.translate(300, 52); g.rotate(0.04);
  text(PRINT.sub, -100, 0, '500 10px "Geist Mono", ui-monospace, monospace', INK, 1);
  g.restore();
  // (the egg mark beside the model name is its own animated piece; see eggMark)
  text(PRINT.mark, 400, 86, 'italic 600 30px "Instrument Sans", system-ui, sans-serif', INK, 0.5);
  text(PRINT.num, 44, 178, 'italic 600 26px "Instrument Sans", system-ui, sans-serif', RED);
  g.strokeStyle = INK; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(86, 140); g.lineTo(86, 202); g.stroke();
  // side badge
  g.strokeStyle = RED; g.lineWidth = 2;
  g.beginPath(); g.arc(512, 168, 13, 0, Math.PI * 2); g.stroke();
  text(PRINT.side, 512, 175, '600 18px "Instrument Sans", system-ui, sans-serif', RED, 0, "center");
  // tape counter ticks in the window between the hubs
  g.strokeStyle = INK; g.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) { const x = 232 + i * 12; g.beginPath(); g.moveTo(x, 160); g.lineTo(x, 174); g.stroke(); }
  text(PRINT.name, 86, 248, 'italic 600 15px "Instrument Sans", system-ui, sans-serif', INK, 0.5);
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
    update(time) {
      if (reduce) { whole.visible = false; top.visible = bottom.visible = true; setLid(1); return; }
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
  const frost = new THREE.MeshPhysicalMaterial({ color: 0xe4e7eb, roughness: 0.5, transparent: true, opacity: 0.95, envMapIntensity: 0.6 });
  const frostDim = new THREE.MeshStandardMaterial({ color: 0x9fa6af, roughness: 0.6 });
  const tape = new THREE.MeshStandardMaterial({ color: 0x1f1511, roughness: 0.5, envMapIntensity: 0.15 });
  const black = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.35, metalness: 0.3 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.3, metalness: 0.9 });
  const felt = new THREE.MeshStandardMaterial({ color: 0x8d9096, roughness: 0.9 });
  const print = new THREE.MeshBasicMaterial({ map: await printTexture(), transparent: true, depthWrite: false, depthTest: false, toneMapped: false });

  const root = new THREE.Group();     // pointer tilt + idle sway
  scene.add(root);
  const add = (m, x, y, z, order) => { m.position.set(x, y, z); if (order != null) m.renderOrder = order; root.add(m); return m; };
  const line = (pts, mat, z, closed = true) => {
    const l = new (closed ? THREE.LineLoop : THREE.Line)(new THREE.BufferGeometry().setFromPoints(pts), mat);
    l.position.z = z; l.renderOrder = 3; root.add(l); return l;
  };

  // ---------- inside: tape packs and hubs ----------
  const reels = [];
  for (const r of REELS) {
    add(ring(r.pack, HUB.r - 1, D - 26, tape), fx(r.x), fy(r.y), -1);
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
  // clear flange edge of the nearly empty right reel, and the pack edge on the left
  line(circlePts(REELS[1].x, REELS[1].y, FLANGE), ghost, 6);
  line(circlePts(REELS[0].x, REELS[0].y, REELS[0].pack + 3), ghost, 6);

  // ---------- head section ----------
  add(new THREE.Mesh(new THREE.BoxGeometry(fx(500) - fx(60), 2.2, 12), tape), 0, fy(344), D / 2 - 18);
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
  const shell = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 6, 14), shellMat);
  shell.renderOrder = 2;
  root.add(shell);
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
    add(g, fx(x), fy(y), D / 2 + (y > 300 && x === 281 ? 7 : 1), 5);
  }

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
  if (!reduce) {
    addEventListener("pointermove", e => {
      const r = wrap.getBoundingClientRect();
      tilt.tx = THREE.MathUtils.clamp((e.clientX - (r.left + r.width / 2)) / innerWidth, -1, 1) * 0.35;
      tilt.ty = THREE.MathUtils.clamp((e.clientY - (r.top + r.height / 2)) / innerHeight, -1, 1) * 0.22;
    });
    document.addEventListener("pointerleave", () => { tilt.tx = 0; tilt.ty = 0; });
  }
  const PLAY = Math.PI * 2 / 3.2;     // take-up reel: one turn every 3.2 s
  let last = performance.now(), t = 0, shown = false;
  const frame = now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    if (!reduce) {
      tilt.x += (tilt.tx - tilt.x) * Math.min(1, dt * 4);
      tilt.y += (tilt.ty - tilt.y) * Math.min(1, dt * 4);
      // the full supply reel (left) turns slower than the nearly empty take-up reel (right)
      reels[0].rotation.z -= PLAY * dt * (REELS[1].pack / REELS[0].pack);
      reels[1].rotation.z -= PLAY * dt;
    }
    root.rotation.y = rest.y + tilt.x + (reduce ? 0 : Math.sin(t * 0.6) * 0.015);
    root.rotation.x = rest.x + tilt.y + (reduce ? 0 : Math.sin(t * 0.8) * 0.01);
    // egg + dragon run on the wall clock, so they keep time even on slow frames
    const clock = now / 1000, phase = clock % T.cycle;
    egg.update(phase);
    if (dragon) {
      const state = reduce ? { fly: 0.5 }
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

init().catch(err => console.warn("home3 cassette: staying with the flat SVG", err));
