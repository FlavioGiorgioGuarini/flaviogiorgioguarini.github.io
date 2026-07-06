/* CTF Moon: the answer never exists in clear text here; the input is
   normalized and compared as SHA-256. Spam defences on the reward form:
   honeypot, minimum-time gate, client rate limit, hard length caps.
   (Client-side checks deter bots; FormSubmit adds its own server-side line.) */

import { CTF, CONTACT } from './data.js';
import { t } from './i18n.js';

const enc = new TextEncoder();
async function sha256hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* accept 9/8/2017, 09-08-2017, 09.08.2017 … all collapse to DD/MM/YYYY */
function normalizeDate(raw) {
  const parts = raw.trim().replace(/[.\-\s]+/g, '/').split('/').filter(Boolean);
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  if (!/^\d{1,2}$/.test(d) || !/^\d{1,2}$/.test(m) || !/^\d{4}$/.test(y)) return null;
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
}

export function initCTF() {
  const form = document.getElementById('ctf-form');
  const answerEl = document.getElementById('ctf-answer');
  const errEl = document.getElementById('ctf-err');
  const field = answerEl.closest('.field');
  const winForm = document.getElementById('win-form');
  const winDone = document.getElementById('win-done');
  const winStatus = document.getElementById('win-status');
  const sendBtn = document.getElementById('win-send');

  const attempts = [];
  let revealedAt = 0, sending = false;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const now = Date.now();
    while (attempts.length && now - attempts[0] > 60000) attempts.shift();
    if (attempts.length >= 6) {
      field.classList.add('invalid');
      errEl.textContent = t('ctf.lock');
      return;
    }
    attempts.push(now);

    const norm = normalizeDate(answerEl.value);
    const ok = norm && (await sha256hex(norm)) === CTF.hashHex;
    if (!ok) {
      field.classList.add('invalid');
      errEl.textContent = t('ctf.err');
      answerEl.value = '';
      return;
    }
    field.classList.remove('invalid');
    form.hidden = true;
    winForm.hidden = false;
    revealedAt = now;
    winForm.querySelector('input[name="name"]').focus();
  });

  answerEl.addEventListener('input', () => field.classList.remove('invalid'));

  winForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;
    const fd = new FormData(winForm);
    const name = String(fd.get('name') || '').trim().slice(0, 80);
    const email = String(fd.get('email') || '').trim().slice(0, 120);
    const message = String(fd.get('message') || '').trim().slice(0, 1000);
    const honey = String(fd.get('_honey') || '');

    if (honey || Date.now() - revealedAt < 3000) return; // bot signatures
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      winStatus.textContent = t('ctf.invalid');
      return;
    }

    sending = true;
    sendBtn.disabled = true;
    winStatus.textContent = t('ctf.sending');
    try {
      const res = await fetch(CTF.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name, email, message,
          _subject: 'CTF Moon solved — coffee protocol initiated',
          _template: 'table',
          solved_at: new Date().toISOString(),
          device: navigator.userAgentData?.platform || navigator.platform || 'unknown',
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      winForm.hidden = true;
      winDone.hidden = false;
    } catch {
      winStatus.textContent = t('ctf.fail') + CONTACT.email;
      sendBtn.disabled = false;
      sending = false;
    }
  });
}
