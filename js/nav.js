// Top nav: an underline that sits under the current page, follows hover,
// and slides to the target before navigating to another page.
(() => {
  const list = document.querySelector(".site-nav ul");
  if (!list) return;
  const links = [...list.querySelectorAll("a")];
  const current = links.find(a => a.getAttribute("aria-current") === "page") || links[0];
  const bar = document.createElement("span");
  bar.className = "nav-indicator no-anim";
  list.appendChild(bar);

  const moveTo = a => {
    bar.style.width = a.offsetWidth + "px";
    bar.style.transform = `translateX(${a.offsetLeft}px)`;
  };

  // Place under the current page without animating, then enable transitions.
  const place = () => {
    bar.classList.add("no-anim");
    moveTo(current);
    bar.offsetWidth; // flush so the next change animates
    bar.classList.remove("no-anim");
  };
  document.fonts.ready.then(place);
  place();
  addEventListener("resize", place);
  addEventListener("pageshow", place); // back/forward cache

  links.forEach(a => {
    a.addEventListener("mouseenter", () => moveTo(a));
    a.addEventListener("focus", () => moveTo(a));
    a.addEventListener("click", e => {
      if (a.getAttribute("aria-disabled") === "true" || a === current) { e.preventDefault(); return; }
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      moveTo(a);
      const go = () => { location.href = a.href; };
      matchMedia("(prefers-reduced-motion: reduce)").matches ? go() : setTimeout(go, 380);
    });
  });
  list.addEventListener("mouseleave", () => moveTo(current));
  list.addEventListener("focusout", e => { if (!list.contains(e.relatedTarget)) moveTo(current); });

  // ---------- exposure dial above the nav ----------
  // One bead per page. The red light marks the page; − / + step to the previous /
  // next available page. The dial is centred on the page.
  const nav = list.closest(".site-nav");
  const dial = document.createElement("div");
  dial.className = "nav-dial";
  dial.innerHTML = `
    <button type="button" class="dial-step" data-step="-1" aria-label="Previous page">&minus;</button>
    <span class="dial-well"><span class="dial-slot"><span class="dial-track" aria-hidden="true"></span></span></span>
    <button type="button" class="dial-step" data-step="1" aria-label="Next page">+</button>`;
  nav.prepend(dial);
  const track = dial.querySelector(".dial-track");
  const W = 150, PAD = 26, n = links.length;
  const xOf = i => PAD + (W - 2 * PAD) * (n > 1 ? i / (n - 1) : .5);
  const STEP = n > 1 ? (W - 2 * PAD) / (n - 1) : W;
  // The beads sit on a row that rolls when the bar is dragged. It carries extra beads
  // past both ends (hidden in the dark of the slot), so after rolling a whole number of
  // steps it looks exactly like it did at rest and can jump back to 0 unseen.
  const row = document.createElement("span");
  row.className = "dial-row";
  track.appendChild(row);
  for (let j = -6; j < n + 6; j++) {
    const b = document.createElement("span");
    b.className = "dial-bead";
    b.style.setProperty("--x", PAD + j * STEP + "px");
    row.appendChild(b);
  }
  // Shift the link row so its middle item (Other Work) sits at the page centre,
  // right under the dial.
  const middle = links[Math.floor(n / 2)];
  const centre = () => {
    list.style.transform = "";
    const m = middle.getBoundingClientRect(), d = dial.getBoundingClientRect();
    list.style.transform = `translateX(${(d.left + d.width / 2) - (m.left + m.width / 2)}px)`;
  };
  document.fonts.ready.then(centre);
  centre();
  addEventListener("resize", centre);
  const light = document.createElement("span");
  light.className = "dial-light no-anim";
  track.appendChild(light);
  const lightTo = a => light.style.setProperty("--x", xOf(links.indexOf(a)) + "px");
  lightTo(current);
  light.offsetWidth;
  light.classList.remove("no-anim");

  const enabled = a => a.getAttribute("aria-disabled") !== "true";
  const bump = dir => {
    light.style.setProperty("--bump", dir * 4 + "px");
    light.classList.remove("bump"); light.offsetWidth; light.classList.add("bump");
  };
  dial.querySelectorAll(".dial-step").forEach(btn => btn.addEventListener("click", () => {
    const dir = Number(btn.dataset.step);
    let i = links.indexOf(current) + dir;
    while (links[i] && !enabled(links[i])) i += dir;
    links[i] ? links[i].click() : bump(dir);
  }));
  // Click the bar → nearest page. Press and drag → the whole bar rolls with the
  // pointer (beads, red light and knurling together) and the nav underline follows;
  // on release it clicks into the nearest step and goes to that page. Rolling onto a
  // "coming soon" page, or past either end, springs back.
  const nearestTo = x => links.reduce((best, a, i) => Math.abs(xOf(i) - x) < Math.abs(xOf(links.indexOf(best)) - x) ? a : best, links[0]);
  const setShift = (px, animate) => {
    dial.classList.toggle("is-rolling", !animate);
    row.style.transform = `translateX(${px}px)`;
    light.style.setProperty("--x", xOf(links.indexOf(current)) + px + "px");
    track.style.setProperty("--roll", roll + px + "px");
  };
  const goTo = target => {
    if (enabled(target) && target !== current) {
      // Land on the target step, then hand over to the normal nav click.
      setShift(xOf(links.indexOf(target)) - xOf(links.indexOf(current)), true);
      setTimeout(() => {
        // a whole number of steps looks the same as rest, so reset the row unseen
        roll += xOf(links.indexOf(target)) - xOf(links.indexOf(current));
        dial.classList.add("is-rolling");
        row.style.transform = "";
        target.click();
        row.offsetWidth; dial.classList.remove("is-rolling");
      }, 240);
      return;
    }
    setShift(0, true); moveTo(current);
    bump(target === current ? 1 : Math.sign(xOf(links.indexOf(target)) - xOf(links.indexOf(current))));
  };
  let drag = null, roll = 0;
  // "Click" when the bar passes a step: a quick jolt of the dial, a short buzz on
  // phones that support it, and a very quiet tick sound.
  let audio = null;
  const tick = () => {
    dial.classList.remove("tick"); dial.offsetWidth; dial.classList.add("tick");
    navigator.vibrate?.(8);
    try {
      audio ??= new (window.AudioContext || window.webkitAudioContext)();
      const t = audio.currentTime, len = Math.floor(audio.sampleRate * 0.012);
      const buf = audio.createBuffer(1, len, audio.sampleRate), d = buf.getChannelData(0);
      for (let j = 0; j < len; j++) d[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / len, 4);
      const src = audio.createBufferSource(), hp = audio.createBiquadFilter(), g = audio.createGain();
      hp.type = "highpass"; hp.frequency.value = 2500; g.gain.value = 0.12;
      src.buffer = buf; src.connect(hp).connect(g).connect(audio.destination); src.start(t);
    } catch {}
  };
  const scale = () => track.offsetWidth / track.getBoundingClientRect().width || 1; // undo any zoom
  track.addEventListener("pointerdown", e => {
    if (e.button !== 0) return;
    e.preventDefault();
    track.setPointerCapture(e.pointerId);
    drag = { id: e.pointerId, startX: e.clientX, moved: false, shift: 0, near: current };
  });
  track.addEventListener("pointermove", e => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved && Math.abs(e.clientX - drag.startX) < 3) return;
    if (!drag.moved) { drag.moved = true; dial.classList.add("is-dragging"); }
    const i = links.indexOf(current);
    const lo = xOf(0) - xOf(i), hi = xOf(n - 1) - xOf(i);
    let dx = (e.clientX - drag.startX) * scale();
    // past either end the bar resists, like a dial hitting its stop
    if (dx < lo) dx = lo + (dx - lo) * 0.25;
    if (dx > hi) dx = hi + (dx - hi) * 0.25;
    // Detents: the bar sticks a little around each step and hurries between them.
    if (dx > lo && dx < hi) {
      const st = dx / STEP, k = Math.round(st), f = st - k;          // f in −0.5…0.5
      dx = (k + Math.sign(f) * 0.5 * Math.pow(Math.abs(2 * f), 1.7)) * STEP;
    }
    drag.shift = dx;
    setShift(dx, false);
    const near = nearestTo(xOf(i) + dx);
    if (drag.near && near !== drag.near) tick();
    drag.near = near;
    moveTo(near);
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    dial.classList.remove("is-dragging");
    if (e.type === "pointercancel") { setShift(0, true); moveTo(current); return; }
    const x = d.moved ? xOf(links.indexOf(current)) + d.shift : (e.clientX - track.getBoundingClientRect().left) * scale();
    goTo(nearestTo(x));
  };
  track.addEventListener("pointerup", end);
  track.addEventListener("pointercancel", end);
  // The light follows the underline: hover / focus / click on nav links.
  links.forEach(a => {
    a.addEventListener("mouseenter", () => lightTo(a));
    a.addEventListener("focus", () => lightTo(a));
    a.addEventListener("click", () => { if (enabled(a)) lightTo(a); });
  });
  list.addEventListener("mouseleave", () => lightTo(current));
  list.addEventListener("focusout", e => { if (!list.contains(e.relatedTarget)) lightTo(current); });
  addEventListener("pageshow", () => { light.classList.add("no-anim"); lightTo(current); light.offsetWidth; light.classList.remove("no-anim"); });
})();
