/* Hero — custom 3D particle waveform sphere.
   Hand-rolled perspective projection on Canvas 2D: zero dependencies,
   runs everywhere WebGL doesn't. Fallback: static CSS glow. */
(function () {
  "use strict";

  var canvas = document.getElementById("hero-canvas");
  var hero = document.querySelector(".hero");
  if (!canvas || !canvas.getContext) { if (hero) hero.classList.add("hero--flat"); return; }

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ctx = canvas.getContext("2d", { alpha: true });
  var DPR = Math.min(window.devicePixelRatio || 1, 2);

  // Adaptive particle budget: fewer on small / low-core devices.
  var cores = navigator.hardwareConcurrency || 4;
  var small = Math.min(window.innerWidth, window.innerHeight) < 640;
  var COUNT = reduced ? 420 : (small || cores <= 4 ? 700 : 1300);

  var W, H, CX, CY, R;
  var FOV = 340;

  // Particles distributed on a sphere (Fibonacci lattice) + a thin orbital ring.
  var pts = [];
  var GOLDEN = Math.PI * (3 - Math.sqrt(5));
  for (var i = 0; i < COUNT; i++) {
    if (i % 5 === 0) {
      var a = Math.random() * Math.PI * 2;
      pts.push({ x: Math.cos(a) * 1.55, y: (Math.random() - 0.5) * 0.06, z: Math.sin(a) * 1.55, ring: true, ph: Math.random() * Math.PI * 2 });
    } else {
      var t = i / COUNT;
      var inc = Math.acos(1 - 2 * t);
      var az = GOLDEN * i;
      pts.push({ x: Math.sin(inc) * Math.cos(az), y: Math.cos(inc), z: Math.sin(inc) * Math.sin(az), ring: false, ph: Math.random() * Math.PI * 2 });
    }
  }

  var rotY = 0.6, rotX = -0.18;
  var velY = 0.0016, targX = rotX;
  var mx = 0, my = 0, cursorX = -1e4, cursorY = -1e4;
  var dragging = false, lastTX = 0;

  function resize() {
    var r = hero.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    CX = W > 820 ? W * 0.66 : W * 0.5;
    CY = H * 0.48;
    R = Math.min(W, H) * (W > 820 ? 0.3 : 0.34);
  }

  function frame(now) {
    ctx.clearRect(0, 0, W, H);
    var t = now * 0.001;

    rotY += velY;
    rotX += (targX - rotX) * 0.04;

    var sy = Math.sin(rotY), cy_ = Math.cos(rotY);
    var sx = Math.sin(rotX), cx_ = Math.cos(rotX);

    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      // breathing displacement — a slow waveform over the sphere surface
      var d = p.ring ? 1 : 1 + Math.sin(t * 1.4 + p.ph) * 0.055 + Math.sin(t * 0.5 + p.y * 3) * 0.04;
      var x = p.x * d, y = p.y * d, z = p.z * d;

      // rotate Y then X
      var x1 = x * cy_ - z * sy, z1 = x * sy + z * cy_;
      var y1 = y * cx_ - z1 * sx, z2 = y * sx + z1 * cx_;

      var scale = FOV / (FOV + z2 * R);
      var px = CX + x1 * R * scale + mx * 14 * scale;
      var py = CY + y1 * R * scale + my * 14 * scale;

      // magnetic cursor repulsion (desktop)
      var dx = px - cursorX, dyp = py - cursorY;
      var dist2 = dx * dx + dyp * dyp;
      if (dist2 < 16900) {
        var f = (130 - Math.sqrt(dist2)) / 130;
        px += dx * f * 0.55; py += dyp * f * 0.55;
      }

      var depth = (z2 + 1.6) / 3.2; // 0 near … 1 far
      var size = Math.max(0.4, (p.ring ? 1.5 : 1.9) * scale * (1.15 - depth));
      var alpha = Math.max(0.05, 0.85 - depth * 0.75);

      if (p.ring || i % 11 === 0) {
        ctx.fillStyle = "rgba(255,90,31," + (alpha * 0.9).toFixed(3) + ")";
      } else {
        ctx.fillStyle = "rgba(245,245,240," + alpha.toFixed(3) + ")";
      }
      ctx.fillRect(px - size / 2, py - size / 2, size, size);
    }
  }

  // input — pointer parallax + magnetic field
  window.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch") return;
    mx = (e.clientX / W - 0.5) * 2;
    my = (e.clientY / H - 0.5) * 2;
    targX = -0.18 + my * 0.22;
    var r = canvas.getBoundingClientRect();
    cursorX = e.clientX - r.left; cursorY = e.clientY - r.top;
  }, { passive: true });
  window.addEventListener("pointerleave", function () { cursorX = cursorY = -1e4; });

  // touch — horizontal drag rotates the sphere
  canvas.addEventListener("touchstart", function (e) { dragging = true; lastTX = e.touches[0].clientX; }, { passive: true });
  canvas.addEventListener("touchmove", function (e) {
    if (!dragging) return;
    var x = e.touches[0].clientX;
    velY = (x - lastTX) * 0.00028 + 0.0012;
    lastTX = x;
  }, { passive: true });
  canvas.addEventListener("touchend", function () { dragging = false; velY = 0.0016; });

  window.addEventListener("resize", resize);
  resize();

  var running = false;
  function loop(now) { running = true; if (document.hidden) { running = false; return; } frame(now); if (!reduced) requestAnimationFrame(loop); else running = false; }

  if (reduced) {
    frame(0); // render a single static frame
  } else {
    requestAnimationFrame(loop);
  }

  // pause when tab hidden, resume once on return (battery)
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && !reduced && !running) requestAnimationFrame(loop);
  });
})();
