// Home animation: the camera starts lens-forward. The first click presses the shutter,
// the line draws in, the four project cards drop onto their pegs one by one, and the
// camera turns round to show its back (my photo). Later clicks just turn it again.
(() => {
  const stage = document.getElementById("stage");
  if (!stage) return;
  const camera = document.getElementById("camera");
  const cam3d = document.getElementById("cam3d");
  const lift = camera.querySelector(".cam-lift");
  const shadow = camera.querySelector(".cam-shadow");
  const shutters = camera.querySelectorAll(".shutter");
  const burst = document.getElementById("burst");
  const hint = document.getElementById("hint");
  const rope = document.getElementById("rope");
  const swings = [...stage.querySelectorAll(".card-swing")];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Scale the 900 × 790 canvas to the stage width (the stage is 1160 wide, 130px margin each side).
  const fit = () => stage.style.setProperty("--k", stage.clientWidth / 1160);
  new ResizeObserver(fit).observe(stage);
  fit();

  // Lens barrel: thin discs stacked from the body to the lens front, so it has depth
  // when the camera turns. A lighter band in the middle reads as the focus ring.
  const DEPTH = 55; // half the body depth, matches --d in index.html
  const lensFront = cam3d.querySelector('.face.lens[style*="34px"]');
  for (let z = 1; z < 34; z += 2) {
    const disc = document.createElement("span");
    disc.className = "disc";
    disc.style.setProperty("--z", `${z}px`);
    if (z >= 17 && z <= 25) disc.style.setProperty("--c", "#2C2C2A");
    cam3d.insertBefore(disc, lensFront);
  }
  const at = deg => `translateZ(${-DEPTH}px) rotateY(${deg}deg)`;

  const T = {
    rope: 250,          // line starts drawing
    cards: 600,         // first card starts dropping
    stagger: 160,       // gap between cards
    drop: 750,          // one card's fall + swing
    flip: 1000,         // camera turn
  };
  const flipStart = T.cards + 3 * T.stagger + T.drop - 250;

  let opened = false, angle = 0, busy = false;
  // Shared with js/camera3d.js (the WebGL camera), which takes over once it has loaded
  // and exposes window.cam3d = { turn, press, set }.
  const state = window.camState = { angle: 0, busy: false };
  const setBusy = b => { busy = state.busy = b; };
  const setAngle = deg => {
    angle = state.angle = deg;
    cam3d.style.transform = at(deg);
    window.cam3d?.set(deg);
    const back = (deg / 180) % 2 === 1;
    camera.setAttribute("aria-label", back ? "Turn the camera to the front" : "Turn the camera to the back");
  };

  const pressShutter = () => {
    window.cam3d?.press();
    shutters.forEach(s => s.animate(
      [{ transform: "translateY(0)" }, { transform: "translateY(10px)", offset: 0.35 }, { transform: "translateY(0)" }],
      { duration: 320, easing: "ease-out" }));
    burst.animate(
      [{ opacity: 0, transform: "scale(.6)" }, { opacity: 1, transform: "scale(1)", offset: 0.35 }, { opacity: 0, transform: "scale(1.15)" }],
      { duration: 520, delay: 60, easing: "ease-out" });
  };

  const turn = (delay = 0) => {
    setBusy(true);
    const from = angle, to = angle + 180;
    const opts = { duration: T.flip, delay, easing: "cubic-bezier(.65,0,.35,1)", fill: "both" };
    const gl = window.cam3d;
    const spin = gl ? null : cam3d.animate([{ transform: at(from) }, { transform: at(to) }], opts);
    const rise = lift.animate([{ transform: "translateY(0)" }, { transform: "translateY(-16px)" }, { transform: "translateY(0)" }], opts);
    // the shadow narrows to the camera's depth (body + lens) at the quarter turn
    const squeeze = shadow.animate(
      [{ transform: "scaleX(1)", opacity: 1 }, { transform: "scaleX(.34)", opacity: .75 }, { transform: "scaleX(1)", opacity: 1 }], opts);
    (gl ? gl.turn(from, to, delay, T.flip) : spin.finished).then(() => {
      setAngle(to);
      [spin, rise, squeeze].forEach(a => a?.cancel());
      setBusy(false);
    });
  };

  const open = () => {
    opened = true;
    stage.classList.add("is-open");
    if (reduce) { setAngle(180); return; }
    hint.style.visibility = "visible";
    hint.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: "forwards" })
      .finished.then(() => { hint.style.visibility = ""; });
    rope.animate([{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }],
      { duration: 550, delay: T.rope, easing: "cubic-bezier(.3,0,.2,1)", fill: "backwards" });
    swings.forEach((el, i) => el.animate([
      { transform: "translateY(-170px) rotate(0deg)", opacity: 0 },
      { transform: "translateY(6px) rotate(-5deg)", opacity: 1, offset: 0.5 },
      { transform: "translateY(-2px) rotate(3deg)", offset: 0.72 },
      { transform: "translateY(0) rotate(-1deg)", offset: 0.88 },
      { transform: "translateY(0) rotate(0deg)", opacity: 1 },
    ], { duration: T.drop, delay: T.cards + i * T.stagger, easing: "cubic-bezier(.3,.7,.4,1)", fill: "backwards" }));
    turn(flipStart);
  };

  // Cards 01–02: without hover (touch screens) the first tap pops the shots out,
  // a second tap opens the project.
  const popCards = [...stage.querySelectorAll(".card.has-pop")];
  const noHover = matchMedia("(hover: none)");
  popCards.forEach(card => card.addEventListener("click", e => {
    if (!noHover.matches || card.classList.contains("is-peek")) return;
    e.preventDefault();
    popCards.forEach(c => c.classList.toggle("is-peek", c === card));
  }));
  document.addEventListener("click", e => {
    if (!e.target.closest(".card.has-pop")) popCards.forEach(c => c.classList.remove("is-peek"));
  });

  camera.addEventListener("click", () => {
    if (busy) return;
    if (!reduce) pressShutter();
    if (!opened) open();
    else if (reduce) setAngle(angle + 180);
    else turn(120);
  });
})();
