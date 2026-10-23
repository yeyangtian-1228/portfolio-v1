// WebGL camera for the home page (three.js). It replaces the CSS 3D camera once it is ready;
// if WebGL or the module fails, the CSS camera in index.html stays in place.
//
// The flat artwork is not duplicated here: the front, back and side SVGs inside #camera are
// turned into textures (minus the parts tagged data-3d="skip", which are built as geometry
// below). Units are CSS px of the 900 × 790 stage, so the face turned to the viewer sits
// at z = 0 and renders 1:1 with the Figma layout.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const button = document.getElementById("camera");
const canvas = button?.querySelector(".cam-gl");
const stage = document.getElementById("stage");

const W = 436, H = 270, D = 110;          // body
const LENS = { x: 50, y: -15, r: 112 };   // lens centre relative to the body centre
const C = {
  plate: "#B4B4B2", black: "#151514", ring: "#2C2C2A", red: "#D2412F",
};
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- SVG → texture ----------
const defs = document.querySelector("#cam-defs defs").outerHTML;
const svgNS = "http://www.w3.org/2000/svg";

// An SVG drawn as an <img> can't load files, so photos (<image href>) are inlined first.
const toDataURL = href => fetch(href).then(r => r.blob()).then(b => new Promise((res, rej) => {
  const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(b);
}));

async function svgToTexture(svg, viewBox, w, h, { scale = 3, bg = C.plate, clean } = {}) {
  const el = svg.cloneNode(true);
  el.querySelectorAll('[data-3d="skip"]').forEach(n => n.remove());
  if (clean) clean(el);
  await Promise.all([...el.querySelectorAll("image")].map(async im => {
    im.setAttribute("href", await toDataURL(im.getAttribute("href")));
  }));
  el.setAttribute("xmlns", svgNS);
  el.setAttribute("viewBox", viewBox);
  el.setAttribute("width", w * scale);
  el.setAttribute("height", h * scale);
  el.insertAdjacentHTML("afterbegin", defs);
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(el));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = w * scale; c.height = h * scale;
      const ctx = c.getContext("2d");
      if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height); }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      resolve(t);
    };
    img.onerror = reject;
    img.src = url;
  });
}

const plainSVG = (w, h) => {
  const s = document.createElementNS(svgNS, "svg");
  s.innerHTML = `<g filter="url(#grain)"><rect width="${w}" height="${h}" fill="${C.plate}"/></g>`;
  return s;
};

// ---------- easing ----------
// cubic-bezier(x1, y1, x2, y2) like CSS
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = t => ((ax * t + bx) * t + cx) * t;
  const sy = t => ((ay * t + by) * t + cy) * t;
  const dx = t => (3 * ax * t + 2 * bx) * t + cx;
  return x => {
    let t = x;
    for (let i = 0; i < 6; i++) { const e = sx(t) - x; const d = dx(t); if (Math.abs(e) < 1e-5 || !d) break; t -= e / d; }
    return sy(Math.min(1, Math.max(0, t)));
  };
}
const turnEase = bezier(.65, 0, .35, 1);

async function init() {
  if (!button || !canvas || !stage) return;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);

  // canvas: 600 × 440 css px, placed 60 left / 50 above the camera button
  const CW = 600, CH = 440;
  const fov = 18;
  const dist = (CH / 2) / Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const cam = new THREE.PerspectiveCamera(fov, CW / CH, 10, dist * 3);
  cam.position.set(0, 0, dist);

  const scene = new THREE.Scene();
  // Lighting tuned so a face turned to the viewer keeps its Figma colours,
  // while sides and top read a little darker / lighter.
  // (three.js light units: an intensity of π returns the texture colour unchanged.)
  scene.add(new THREE.AmbientLight(0xffffff, 0.62 * Math.PI));
  const key = new THREE.DirectionalLight(0xffffff, 0.45 * Math.PI);
  key.position.set(-0.45, 0.6, 1);
  scene.add(key);

  // ---------- textures from the page's SVG artwork ----------
  const q = s => button.querySelector(s);
  const [front, back, side, lensFace, top] = await Promise.all([
    svgToTexture(q(".face.front svg"), "22 50 436 270", W, H),
    svgToTexture(q(".face.back svg"), "22 50 436 270", W, H),
    svgToTexture(q(".face.side.left svg"), "0 0 110 270", D, H, {
      clean: el => el.querySelectorAll('rect[opacity=".16"]').forEach(n => n.remove()),
    }),
    svgToTexture(q('.face.lens[style*="34px"] svg'), "178 88 224 224", 224, 224, {
      bg: C.black, clean: el => el.querySelectorAll("[filter='url(#lensShadow)']").forEach(n => n.removeAttribute("filter")),
    }),
    svgToTexture(plainSVG(W, D), `0 0 ${W} ${D}`, W, D, { scale: 2 }),
  ]);

  const mat = (opts) => new THREE.MeshLambertMaterial(opts);
  const black = mat({ color: C.black });
  const ringMat = mat({ color: C.ring });
  const red = mat({ color: C.red });
  const plate = mat({ color: C.plate });

  // ---------- model ----------
  const root = new THREE.Group();      // pointer tilt
  const spin = new THREE.Group();      // the turn
  const model = new THREE.Group();
  root.position.y = 220 - 235;         // body centre sits 15px below the canvas centre
  spin.position.z = -D / 2;            // turn around the body centre, front face at z = 0
  scene.add(root); root.add(spin); spin.add(model);

  // body: materials in BoxGeometry order +x, -x, +y, -y, +z, -z
  const body = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 5, 14), [
    mat({ map: side }), mat({ map: side }), mat({ map: top }), mat({ map: top }), mat({ map: front }), mat({ map: back }),
  ]);
  model.add(body);

  // lens: mount, barrel, focus ring, front glass
  const lens = new THREE.Group();
  lens.position.set(LENS.x, LENS.y, D / 2);
  const cyl = (r, len, m, z) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 72), m);
    c.rotation.x = Math.PI / 2; c.position.z = z; return c;
  };
  lens.add(cyl(116, 5, black, 2.5));
  lens.add(cyl(LENS.r, 30, black, 5 + 15));
  lens.add(cyl(LENS.r + 1.5, 8, ringMat, 21));
  const glass = new THREE.Mesh(new THREE.CircleGeometry(LENS.r, 72), mat({ map: lensFace }));
  glass.position.z = 35.05;
  lens.add(glass);
  // focus tab sticking out of the barrel, lower left
  const tab = new THREE.Group();
  const ang = Math.atan2(-62, -84);
  tab.position.set(Math.cos(ang) * 112, Math.sin(ang) * 112, 14);
  tab.rotation.z = ang;
  const lever = new THREE.Mesh(new RoundedBoxGeometry(26, 18, 8, 2, 3), black);
  lever.position.x = 8; tab.add(lever);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 8, 32), black);
  knob.rotation.x = Math.PI / 2; knob.position.x = 22; tab.add(knob);
  lens.add(tab);
  model.add(lens);

  // top plate: shutter dial (presses), red bar, red button
  const topY = H / 2;
  const shutter = new THREE.Group();
  shutter.position.set(-151, topY, 0);
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(23, 23, 26, 48), black);
  dial.position.y = 11; shutter.add(dial);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(17, 17, 4, 40), plate);
  cap.position.y = 24.5; shutter.add(cap);
  model.add(shutter);
  const bar = new THREE.Mesh(new RoundedBoxGeometry(104, 20, 34, 2, 3), red);
  bar.position.set(-60, topY + 6, 12);
  model.add(bar);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(18, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), red);
  dome.position.set(60, topY, 12);
  model.add(dome);

  // strap lugs on both ends
  for (const s of [-1, 1]) {
    const block = new THREE.Mesh(new RoundedBoxGeometry(16, 24, 18, 2, 4), black);
    block.position.set(s * (W / 2 + 4), 73, 0);
    model.add(block);
    const eye = new THREE.Mesh(new THREE.TorusGeometry(8, 2.2, 10, 28), plate);
    eye.position.set(s * (W / 2 + 12), 73, 0);
    model.add(eye);
  }

  // ---------- sizing ----------
  const fit = () => {
    const k = stage.clientWidth / 1160;
    renderer.setPixelRatio(Math.min(3, Math.max(0.75, devicePixelRatio * k)));
    renderer.setSize(CW, CH, false);
    dirty = true;
  };

  // ---------- state + loop ----------
  let dirty = true;
  let turning = null;                  // {from, to, start, dur, resolve}
  let press = null;                    // start time
  const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  const set = deg => { spin.rotation.y = THREE.MathUtils.degToRad(deg); dirty = true; };

  if (!reduce) {
    addEventListener("pointermove", e => {
      const r = button.getBoundingClientRect();
      const nx = (e.clientX - (r.left + r.width / 2)) / (innerWidth / 2);
      const ny = (e.clientY - (r.top + r.height / 2)) / (innerHeight / 2);
      tilt.tx = THREE.MathUtils.clamp(nx, -1, 1) * 0.14;
      tilt.ty = THREE.MathUtils.clamp(ny, -1, 1) * 0.08;
    });
    document.addEventListener("pointerleave", () => { tilt.tx = 0; tilt.ty = 0; });
  }

  const frame = now => {
    if (turning) {
      const t = (now - turning.start) / turning.dur;
      if (t >= 0) {
        const p = turnEase(Math.min(1, t));
        set(turning.from + (turning.to - turning.from) * p);
        if (t >= 1) { const r = turning.resolve; turning = null; r(); }
      }
    }
    if (press !== null) {
      const t = (now - press) / 320;
      const dip = t < 0.35 ? t / 0.35 : Math.max(0, 1 - (t - 0.35) / 0.65);
      shutter.position.y = topY - 9 * dip;
      if (t >= 1) { press = null; shutter.position.y = topY; }
      dirty = true;
    }
    tilt.x += (tilt.ty - tilt.x) * 0.08;
    tilt.y += (tilt.tx - tilt.y) * 0.08;
    if (Math.abs(root.rotation.x - tilt.x) > 1e-4 || Math.abs(root.rotation.y - tilt.y) > 1e-4) {
      root.rotation.x = tilt.x; root.rotation.y = tilt.y; dirty = true;
    }
    if (dirty) { renderer.render(scene, cam); dirty = false; }
    requestAnimationFrame(frame);
  };

  // Hand over from the CSS camera only while it is at rest.
  const state = window.camState || { angle: 0, busy: false };
  while (state.busy) await new Promise(r => setTimeout(r, 100));
  set(state.angle);
  new ResizeObserver(fit).observe(stage);
  fit();
  renderer.render(scene, cam);
  button.classList.add("webgl");
  requestAnimationFrame(frame);

  window.cam3d = {
    turn: (from, to, delay, dur) => new Promise(resolve => {
      turning = { from, to, start: performance.now() + delay, dur, resolve };
    }),
    press: () => { press = performance.now(); },
    set,
  };
}

init().catch(err => console.warn("3D camera unavailable, using the CSS version:", err));
