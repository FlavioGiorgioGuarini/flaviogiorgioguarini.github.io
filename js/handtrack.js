/* handtrack — optional camera-based hand control.
   Nothing loads and no permission is requested until the user clicks the pill.
   MediaPipe HandLandmarker (tasks-vision) runs 100% on-device; video frames
   never leave the browser. Deny/unsupported → clean fallback to cursor/touch.
   Gestures: index-tip drives a cursor dot · pinch (thumb+index) = click ·
   open palm = idle. Stop button tears everything down. */
(function () {
  "use strict";

  var ui = document.getElementById("hand-ui");
  var btn = document.getElementById("hand-toggle");
  var label = document.getElementById("hand-toggle-label");
  var cursor = document.getElementById("hand-cursor");
  if (!ui || !btn) return;

  var supported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) &&
                  typeof WebAssembly === "object" &&
                  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!supported) return;            // pill stays hidden — never beg
  ui.hidden = false;

  var CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
  var MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

  var state = "idle"; // idle | loading | on
  var stream = null, landmarker = null, video = null, raf = 0;
  var lastVideoTime = -1, pinched = false, lastClick = 0;
  var cx = innerWidth / 2, cy = innerHeight / 2;

  function t(key, fallback) {
    var lang = document.documentElement.lang || "en";
    var d = window.I18N && window.I18N[lang];
    return (d && d[key]) || fallback;
  }

  function setState(s, msg) {
    state = s;
    btn.setAttribute("aria-pressed", s === "on" ? "true" : "false");
    ui.classList.toggle("hand-ui--on", s === "on");
    ui.classList.toggle("hand-ui--loading", s === "loading");
    label.textContent = msg ||
      (s === "on" ? t("hand.stop", "Stop hand control")
       : s === "loading" ? t("hand.loading", "Waking the hand…")
       : t("hand.enable", "Hand control"));
  }

  /* finger curl from landmarks: 1 - normalized distance(tip, MCP) / reference */
  function curl(lm, tip, mcp, ref) {
    var dx = lm[tip].x - lm[mcp].x, dy = lm[tip].y - lm[mcp].y, dz = (lm[tip].z || 0) - (lm[mcp].z || 0);
    var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return Math.min(1, Math.max(0, 1.35 - d / ref * 1.35));
  }

  function loop() {
    if (state !== "on") return;
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      var res = landmarker.detectForVideo(video, performance.now());
      if (res.landmarks && res.landmarks.length) {
        var lm = res.landmarks[0];

        /* palm size as distance wrist→middle-MCP: scale-invariant reference */
        var ref = Math.hypot(lm[9].x - lm[0].x, lm[9].y - lm[0].y) || 0.25;

        var curls = [
          curl(lm, 8, 5, ref * 1.7),   // index
          curl(lm, 12, 9, ref * 1.85), // middle
          curl(lm, 16, 13, ref * 1.75),// ring
          curl(lm, 20, 17, ref * 1.5), // pinky
          curl(lm, 4, 2, ref * 1.1),   // thumb
        ];

        /* mirrored: camera x flipped so the hand moves like a mirror */
        var nx = 1 - lm[0].x, ny = lm[0].y;
        var rot = Math.atan2((1 - lm[9].x) - nx, ny - lm[9].y);

        if (window.HAND3D) {
          window.HAND3D.setCurls(curls);
          window.HAND3D.setWrist(nx, ny, rot * 0.5);
        }

        /* cursor from index tip, smoothed */
        var tx = (1 - lm[8].x) * innerWidth, ty = lm[8].y * innerHeight;
        cx += (tx - cx) * 0.35; cy += (ty - cy) * 0.35;
        cursor.style.transform = "translate(" + cx + "px," + cy + "px)";

        /* pinch = click (edge-triggered, 700 ms cooldown) */
        var pinchD = Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y);
        var isPinch = pinchD < ref * 0.55;
        cursor.classList.toggle("hand-cursor--pinch", isPinch);
        if (isPinch && !pinched && performance.now() - lastClick > 700) {
          lastClick = performance.now();
          if (window.HAND3D) window.HAND3D.pulse();
          cursor.hidden = true;
          var el = document.elementFromPoint(cx, cy);
          cursor.hidden = false;
          if (el && ui.contains(el) === false) {
            var target = el.closest("a, button") || el;
            target.click();
          }
        }
        pinched = isPinch;
      }
    }
    raf = requestAnimationFrame(loop);
  }

  function start() {
    setState("loading");
    navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      audio: false
    }).then(function (s) {
      stream = s;
      video = document.createElement("video");
      video.setAttribute("playsinline", ""); // iOS: never fullscreen
      video.muted = true;
      video.srcObject = s;
      return video.play().then(function () {
        return import(CDN + "/vision_bundle.mjs");
      });
    }).then(function (vision) {
      return vision.FilesetResolver.forVisionTasks(CDN + "/wasm").then(function (files) {
        function make(delegate) {
          return vision.HandLandmarker.createFromOptions(files, {
            baseOptions: { modelAssetPath: MODEL, delegate: delegate },
            runningMode: "VIDEO",
            numHands: 1
          });
        }
        return make("GPU").catch(function () { return make("CPU"); });
      });
    }).then(function (lmk) {
      landmarker = lmk;
      cursor.hidden = false;
      if (window.HAND3D) window.HAND3D.setTracking(true);
      setState("on");
      loop();
    }).catch(function () {
      stop(true);
      setState("idle", t("hand.denied", "Camera unavailable — cursor mode stays on"));
      setTimeout(function () { if (state === "idle") setState("idle"); }, 3500);
    });
  }

  function stop(silent) {
    cancelAnimationFrame(raf);
    if (stream) { stream.getTracks().forEach(function (tr) { tr.stop(); }); stream = null; }
    if (landmarker) { landmarker.close(); landmarker = null; }
    if (video) { video.srcObject = null; video = null; }
    cursor.hidden = true;
    if (window.HAND3D) window.HAND3D.setTracking(false);
    if (!silent) setState("idle");
  }

  btn.addEventListener("click", function () {
    if (state === "idle") start();
    else if (state === "on") stop();
  });

  addEventListener("pagehide", function () { stop(true); });
})();
