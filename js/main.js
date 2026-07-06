/* main — i18n switching, scroll reveal, nav behavior, magnetic buttons */
(function () {
  "use strict";

  /* ——— i18n ——— */
  var SUPPORTED = ["it", "en", "es"];
  function pickLang() {
    var saved = null;
    try { saved = localStorage.getItem("lang"); } catch (e) {}
    if (saved && SUPPORTED.indexOf(saved) !== -1) return saved;
    var nav = (navigator.language || "en").slice(0, 2).toLowerCase();
    return SUPPORTED.indexOf(nav) !== -1 ? nav : "en";
  }

  function applyLang(lang) {
    var dict = window.I18N && window.I18N[lang];
    if (!dict) return;
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (dict[key]) el.innerHTML = dict[key];
    });
    var meta = document.querySelector('meta[name="description"]');
    if (meta && dict["meta.desc"]) meta.setAttribute("content", dict["meta.desc"]);
    document.querySelectorAll(".nav__lang button").forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-lang") === lang ? "true" : "false");
    });
    try { localStorage.setItem("lang", lang); } catch (e) {}
  }

  document.querySelectorAll(".nav__lang button").forEach(function (b) {
    b.addEventListener("click", function () { applyLang(b.getAttribute("data-lang")); });
  });
  applyLang(pickLang());

  /* ——— scroll reveal ——— */
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
  }

  /* ——— nav hide on scroll down, show on scroll up ——— */
  var nav = document.getElementById("nav");
  var lastY = 0;
  window.addEventListener("scroll", function () {
    var y = window.scrollY;
    if (y > 140 && y > lastY) nav.classList.add("nav--hidden");
    else nav.classList.remove("nav--hidden");
    lastY = y;
  }, { passive: true });

  /* ——— timeline strip: drag-to-scroll (desktop) ——— */
  var strip = document.getElementById("tstrip");
  if (strip && window.matchMedia("(pointer: fine)").matches) {
    var down = false, startX = 0, startScroll = 0;
    strip.addEventListener("pointerdown", function (e) {
      down = true; startX = e.clientX; startScroll = strip.scrollLeft;
      strip.classList.add("tstrip--dragging");
    });
    window.addEventListener("pointermove", function (e) {
      if (down) strip.scrollLeft = startScroll - (e.clientX - startX);
    });
    window.addEventListener("pointerup", function () {
      down = false; strip.classList.remove("tstrip--dragging");
    });
  }

  /* ——— magnetic elements (desktop pointer only) ——— */
  var fine = window.matchMedia("(pointer: fine)").matches;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (fine && !reduced) {
    document.querySelectorAll(".magnetic").forEach(function (el) {
      var strength = 0.28;
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = "translate(" + dx * strength + "px," + dy * strength + "px)";
      });
      el.addEventListener("pointerleave", function () { el.style.transform = ""; });
    });
  }
})();
