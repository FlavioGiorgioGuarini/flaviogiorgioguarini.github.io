/* Starting guide (v9): a compact coach chip docked bottom-left, shown once
   on first entry (and on demand from the ? control). It teaches the
   two-hand grammar without ever owning the frame: scroll past the hero and
   it folds to a single quiet line; keep going and it excuses itself.
   Dwell-clickable, keyboard-dismissable, announced politely, localized. */

import { t } from './i18n.js';

const STEPS = 4;

export function startGuide() {
  if (window.__guide) window.__guide.close();

  const el = document.createElement('div');
  el.id = 'guide';
  el.innerHTML = `
    <div class="guide__card panel" role="dialog" aria-modal="false"
         aria-labelledby="guide-title" aria-describedby="guide-body">
      <p class="tag tag--teal" id="guide-tag"></p>
      <h3 id="guide-title"></h3>
      <p class="small" id="guide-body" aria-live="polite"></p>
      <div class="guide__row">
        <span class="guide__dots" id="guide-dots" aria-hidden="true"></span>
        <span class="guide__btns">
          <button class="btn btn--quiet" id="guide-skip"></button>
          <button class="btn btn--solid" id="guide-next"></button>
        </span>
      </div>
    </div>`;
  document.body.appendChild(el);

  const $ = (s) => el.querySelector(s);
  const startY = scrollY;
  const returnFocus = document.activeElement;
  let step = 0, closed = false;

  function render() {
    $('#guide-tag').textContent = t('ui.guide.tag');
    $('#guide-title').textContent = t(`ui.guide.s${step + 1}t`);
    $('#guide-body').textContent = t(`ui.guide.s${step + 1}b`);
    $('#guide-skip').textContent = t('ui.guide.skip');
    $('#guide-next').textContent = t(step === STEPS - 1 ? 'ui.guide.done' : 'ui.guide.next');
    $('#guide-dots').innerHTML = Array.from({ length: STEPS },
      (_, i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('');
  }
  render();
  requestAnimationFrame(() => el.classList.add('on'));

  function close() {
    if (closed) return;
    closed = true;
    localStorage.setItem('fgg-guide', '1');
    el.classList.remove('on');
    removeEventListener('keydown', onKey);
    removeEventListener('langchange', render);
    removeEventListener('scroll', onScroll);
    window.__guide = null;
    if (el.contains(document.activeElement)) returnFocus?.focus?.();
    setTimeout(() => el.remove(), 500);
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
  }
  /* the page always outranks the coach: half a screen of scroll intent
     and the guide excuses itself — the ? control replays it any time */
  function onScroll() {
    if (scrollY - startY > innerHeight * 0.55) close();
  }

  $('#guide-skip').addEventListener('click', close);
  $('#guide-next').addEventListener('click', () => {
    if (step >= STEPS - 1) { close(); return; }
    step++;
    render();
  });
  addEventListener('keydown', onKey);
  addEventListener('langchange', render);
  addEventListener('scroll', onScroll, { passive: true });

  window.__guide = { close: () => { close(); return true; } };
  return window.__guide;
}
