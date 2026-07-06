/* Public-safe identity data. Single source for every module.
   Privacy line: no address, no IDs, no grades, no amounts,
   no employer names inside the automation project. */

export const PROFILE = {
  name: 'Flavio Giorgio Guarini',
  callsign: 'FGG',
  base: 'Bari, Italy',
  birth: '2003-11', // month precision only, used to compute age
  kicker: 'Security · Sound · Systems',
  headline: ['Toward', 'the stars'],
  serif: 'Working with me means going beyond: response, then evolution.',
  lead: 'Two engineering tracks at once, cybersecurity by discipline and sound by instinct. The music you are hearing is mine.',
  rule: 'Anything I do twice gets automated, documented, and improved while I sleep.',
};

export const age = () => {
  const [y, m] = PROFILE.birth.split('-').map(Number);
  const now = new Date();
  return now.getFullYear() - y - (now.getMonth() + 1 < m ? 1 : 0);
};

export const STATS = [
  { num: 'Top <em>3%</em>', lbl: 'TryHackMe global' },
  { num: '<em>2</em>×', lbl: 'Degrees in parallel' },
  { num: '<em>6</em>+ yrs', lbl: 'Sound design' },
  { num: '<em>3</em>', lbl: 'Working languages' },
];

export const TIMELINE = [
  { year: '2003', place: 'Bari, Italy', title: 'Launch site',
    text: 'Born on the Adriatic. First language Italian, first horizon the sea.' },
  { year: '2017', place: 'Las Palmas de Gran Canaria', title: 'The crossing',
    text: 'A one-way flight to the Atlantic at thirteen. New language, new school, new gravity. The exact date is a story this site will make you earn.' },
  { year: '2019', place: 'The islands', title: 'Sound ignition',
    text: 'Official Ableton Live beta tester at fifteen. Bronze medal, 200 m butterfly, Tenerife. Discipline learned in water, applied to waveforms.' },
  { year: '2023', place: 'Las Palmas', title: 'Graduation, US-accredited',
    text: 'Diploma at The American School of Las Palmas. Co-founding Adhuna Collective, teaching English and Spanish, then the return to Italy.' },
  { year: '2024', place: 'Rome', title: 'The confidential year',
    text: 'Personal assistant to a high-profile confidential client. Discretion is a skill you can only prove by not talking about it.' },
  { year: '2025', place: 'Bari', title: 'The security pivot',
    text: 'Communication & Multimedia degree begins. VISIONOIR founded, then deliberately closed to focus. TryHackMe becomes a nightly ritual: Advent of Cyber completed.' },
  { year: '2026', place: 'Bari ↔ León', title: 'Two tracks, one vector',
    text: 'Computer Engineering starts in parallel with the first degree. Google AI certifications. Erasmus+ at Universidad de León, selected with scholarship. Front desk by day, systems by night.' },
  { year: '2027', place: 'Target orbit', title: 'Double graduation',
    text: 'Two bachelor degrees, one calendar, same person. Then the next burn.' },
];

export const PROJECTS = [
  {
    tag: 'Security · Flagship',
    title: 'SIEM 3D v2.0',
    text: 'A security information and event management console reimagined as a navigable 3D space: log rivers, alert constellations, threat topology you can fly through. Python at the core, web at the surface.',
    link: { href: 'https://github.com/FlavioGiorgioGuarini', label: 'GitHub' },
  },
  {
    tag: 'Classified · 2026',
    title: 'Second Brain AI',
    text: 'Coming soon.',
    locked: true,
  },
  {
    tag: 'Sound · Since 2019',
    title: 'DNS_1, the score',
    text: 'Official Ableton Live beta tester. The track breathing through this page is an original composition, mastered at 192 kHz and scored for this exact journey. Unmute and the space moves with it.',
  },
];

/* Skills constellation: orbit 1 = core discipline, orbit 3 = growing edge.
   size 1..3 relative presence. Rendered as an orbital system, not a bar chart. */
export const SKILLS = [
  { name: 'Cybersecurity', orbit: 1, size: 3, note: 'TryHackMe top 3% worldwide · Advent of Cyber 2025 · SIEM design' },
  { name: 'AI Engineering', orbit: 1, size: 3, note: 'Google AI + Prompting certifications · agentic workflows, daily practice' },
  { name: 'Sound Design', orbit: 1, size: 3, note: 'Ableton official beta tester since 2019 · MPE · original scores' },
  { name: 'Software & 3D', orbit: 2, size: 2, note: 'Computer Engineering track · Python · the WebGL you are inside now' },
  { name: 'Communication', orbit: 2, size: 2, note: 'Multimedia degree track · Italian, English, Spanish at work level' },
  { name: 'Automation', orbit: 2, size: 2, note: 'Anything done twice gets automated, documented, improved while asleep' },
  { name: 'Deutsch', orbit: 3, size: 1, note: 'Daily study, in progress' },
  { name: 'Português', orbit: 3, size: 1, note: 'Daily study, early orbit' },
];

/* Mini game: a walkable map of the past. Coordinates on a 24x16 tile grid. */
export const ZONES = [
  { id: 'bari', name: 'Bari · Childhood', x: 3, y: 12, hue: '#3f6fae',
    story: 'Adriatic water, olive trees, first computer. Every trajectory has a launch pad.' },
  { id: 'canaria', name: 'Gran Canaria', x: 6, y: 6, hue: '#c9814f',
    story: 'Volcanic rock in the ocean. Landed at thirteen with one suitcase and zero Spanish. LANDING LOG: 09·08·2017.' },
  { id: 'sound', name: 'The Sound Lab', x: 10, y: 11, hue: '#7a5fd0',
    story: 'Fifteen years old, an inbox from Ableton HQ: welcome to the beta program. The lab never closed.' },
  { id: 'school', name: 'American School', x: 10, y: 3, hue: '#b8b09a',
    story: 'Final year at The American School of Las Palmas. US-accredited diploma, 2023. AP Spanish Literature: A.' },
  { id: 'university', name: 'Twin Towers', x: 14, y: 7, hue: '#5e8f89',
    story: 'Two bachelor programs at once: Computer Engineering and Communication & Multimedia. Target: double graduation 2027.' },
  { id: 'leon', name: 'León · Erasmus+', x: 17, y: 3, hue: '#d0a94f',
    story: 'Selected with scholarship. One intense week of EU labour-law fieldwork in Castilla y León, in Spanish, summer 2026.' },
  { id: 'desk', name: 'The Front Desk', x: 18, y: 12, hue: '#9a8f7c',
    story: 'Reception at a fitness club: people, payments, edge cases at 7 a.m. The place where the automation instinct was born.' },
  { id: 'cyber', name: 'Cyber Range', x: 21, y: 8, hue: '#59e8d5',
    story: 'Nights on TryHackMe, top 3% worldwide. Advent of Cyber 2025: 24 challenges, 24 mornings before work.' },
  { id: 'frontier', name: 'AI Frontier', x: 21, y: 3, hue: '#9cfff1',
    story: 'A sealed door hums here. SECOND BRAIN AI. Status: coming soon. This log has been redacted.' },
];

export const CONTACT = {
  email: 'guariniflavio@gmail.com',
  whatsapp: '+39 349 544 6488',
  waLink: 'https://wa.me/393495446488',
  links: [
    { label: 'GitHub', href: 'https://github.com/FlavioGiorgioGuarini' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/flavioguarini' },
    { label: 'TryHackMe', href: 'https://tryhackme.com/p/FlavioGiorgioGuarini' },
  ],
};

/* CTF: answer is checked as SHA-256 of the normalized date, never stored in clear. */
export const CTF = {
  hashHex: '2d2f7b8873a30d247df3ca507ab43e2f9d4f896505da3b5144a6670e0d696036', // sha256 of the normalized date
  hint: 'The day I moved to Gran Canaria. Format DD/MM/YYYY. The arcade keeps a landing log.',
  endpoint: 'https://formsubmit.co/ajax/guariniflavio@gmail.com',
};

/* Robot companion: on-device knowledge. No network, no telemetry.
   ponytail: intent matching by keyword score beats shipping a 40MB model or
   leaking an API key; a real endpoint can be plugged at BOT.endpoint later. */
export const BOT = {
  name: 'CAERUS',
  tagline: 'Mission companion. Humor setting: 65%.',
  endpoint: null, // optional future serverless proxy; null = fully on-device
  intents: [
    { k: ['who', 'flavio', 'about', 'chi è', 'chi e'], a: () => `Flavio Giorgio Guarini, ${age()}, from Bari, Italy. Security by discipline, sound by instinct, systems by habit. He is completing two bachelor degrees in parallel while ranking top 3% on TryHackMe. I would call it overcommitment, but my humor setting forbids lying: it is momentum.` },
    { k: ['do', 'does', 'work', 'cosa fa', 'lavoro', 'job'], a: 'He builds and secures systems: cybersecurity training at competition pace, AI-driven automation, and full experiences like the one you are inside. Rule of the house: anything done twice gets automated.' },
    { k: ['study', 'degree', 'university', 'laurea', 'studia'], a: 'Two bachelor programs at once at Universitas Mercatorum: Computer Engineering (L-8) and Communication & Multimedia (L-20). Target: double graduation in 2027. Yes, simultaneously. No, he does not sleep less; he schedules better.' },
    { k: ['gran canaria', 'canaria', 'spain', 'spagna', 'island'], a: 'At thirteen he moved to Gran Canaria. New language in months, US-accredited diploma at The American School of Las Palmas in 2023. The exact landing date is the moon riddle. I am not allowed to spoil it, but the arcade keeps logs.' },
    { k: ['erasmus', 'leon', 'león'], a: 'Erasmus+ Blended Intensive Programme at Universidad de León, summer 2026, selected with scholarship. EU occupational-risk law, studied in Spanish. He collects languages the way others collect stickers.' },
    { k: ['security', 'cyber', 'tryhackme', 'hack', 'sicurezza'], a: 'Top 3% worldwide on TryHackMe. Advent of Cyber 2025 completed: 24 challenges. Flagship concept: SIEM 3D, a security console you fly through instead of scroll through.' },
    { k: ['sound', 'music', 'ableton', 'dns', 'musica', 'suono', 'track', 'song'], a: 'Official Ableton Live beta tester since 2019. The track playing here, DNS_1, is his own composition, mastered at 192 kHz. Unmute it: the particles around us follow the bass. I follow the treble. Personal preference.' },
    { k: ['second brain', 'secondbrain', 'brain'], a: 'SECOND BRAIN AI. That file is sealed. Status: coming soon. I could tell you more, but then my memory banks would need formatting. Ask about literally anything else.' },
    { k: ['hire', 'work with', 'collaborate', 'team', 'assumere', 'collaborare'], a: 'Working with Flavio means going beyond: fast response, honest engineering, and things that keep improving after delivery. Start with an email or a WhatsApp message from the Contact section. He answers like a receptionist and thinks like an engineer: quickly, then thoroughly.' },
    { k: ['contact', 'email', 'whatsapp', 'reach', 'contatto'], a: 'Direct channels only: guariniflavio@gmail.com or WhatsApp +39 349 544 6488. No forms pretending to be people. Except me. I am a form pretending to be a robot.' },
    { k: ['moon', 'ctf', 'flag', 'riddle', 'luna', 'challenge', 'hint', 'aiuto'], a: 'The moon asks for a date: the day he moved to Gran Canaria, DD/MM/YYYY. Solve it and you win his attention, a coffee, and my professional respect. Hint: play the arcade. Explorers get rewarded.' },
    { k: ['site', 'website', 'built', 'how', 'made', 'sito'], a: 'Static hand-written engineering: Three.js under everything, Web Audio analysing DNS_1 in real time, on-device hand and face tracking if you allow the camera, and me. No trackers, no analytics, nothing leaves your machine.' },
    { k: ['language', 'languages', 'lingue', 'speak'], a: 'Italian native. English and Spanish at working fluency, certified and lived. German and Brazilian Portuguese in daily training. I speak whatever the Web Speech API grants me.' },
    { k: ['you', 'robot', 'caerus', 'tars', 'who are you'], a: 'CAERUS, mission companion. Original design, distant cousin of certain monolithic film robots I am legally distinct from. Humor at 65%, honesty at 100%, cynicism adjustable on request.' },
    { k: ['hello', 'hi', 'hey', 'ciao', 'hola', 'buongiorno'], a: 'Acknowledged. Welcome aboard. Ask me who Flavio is, what he builds, or how to work with him. If you get bored, there is a moon to crack and an arcade of his past lives.' },
    { k: ['thanks', 'thank', 'grazie'], a: 'Logged with gratitude. Anything else? The moon is still unsolved, in case you enjoy winning things.' },
  ],
  fallback: [
    'That query exceeds my clearance. Try asking about Flavio, his projects, the score, or the moon riddle.',
    'I parsed that as static. Rephrase, or ask me who Flavio is and why the particles dance.',
    'Unknown vector. I am excellent at three topics: Flavio, this ship, and moderately dry humor.',
  ],
};
