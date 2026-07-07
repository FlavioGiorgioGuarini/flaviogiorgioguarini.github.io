/* Starting guide (v8): a brief, quiet four-step card shown once on first
   entry (and on demand from the ? control). It teaches the two-hand
   grammar — dominant hand selects, the other navigates — without ever
   blocking the page: the world keeps moving behind it. Dwell-clickable,
   keyboard-dismissable, fully localized. */

import { t } from './i18n.js';

const STEPS = 4;

export function startGuide() {
  if (window.__guide) window.__guide.close();

  const el = document.createElement('div');
  el.id = 'guide';
  el.innerHTML = `
    <div class="guide__card panel" role="dialog" aria-modal="false">
      <p class="tag tag--teal" id="guide-tag"></p>
      <h3 id="guide-title"></h3>
      <p class="small" id="guide-body"></p>
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
    window.__guide = null;
    setTimeout(() => el.remove(), 500);
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  $('#guide-skip').addEventListener('click', close);
  $('#guide-next').addEventListener('click', () => {
    if (step >= STEPS - 1) { close(); return; }
    step++;
    render();
  });
  addEventListener('keydown', onKey);
  addEventListener('langchange', render);

  window.__guide = { close: () => { close(); return true; } };
  return window.__guide;
}
