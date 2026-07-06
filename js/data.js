/* Structural data only — every human-readable string lives in i18n.js.
   Privacy line: no address, no IDs, no grades, no amounts,
   no employer names inside the automation project. */

export const PROFILE = {
  name: 'Flavio Giorgio Guarini',
  birth: '2003-11', // month precision only, used to compute age
};

export const age = () => {
  const [y, m] = PROFILE.birth.split('-').map(Number);
  const now = new Date();
  return now.getFullYear() - y - (now.getMonth() + 1 < m ? 1 : 0);
};

/* stat numerals are language-neutral; labels come from i18n sections.stats */
export const STAT_NUMS = ['Top <em>3%</em>', '<em>2</em>×', '<em>6</em>+ yrs', '<em>3</em>'];

/* skills orbital structure: names/notes localized in i18n by index */
export const SKILL_GEO = [
  { orbit: 1, size: 3 }, { orbit: 1, size: 3 }, { orbit: 1, size: 3 },
  { orbit: 2, size: 2 }, { orbit: 2, size: 2 }, { orbit: 2, size: 2 },
  { orbit: 3, size: 1 }, { orbit: 3, size: 1 },
];

export const PROJECT_LINKS = [
  { href: 'https://github.com/FlavioGiorgioGuarini', label: 'GitHub' },
  null,
  null,
];

/* arcade map geometry, 24x16 tile grid; stories localized in i18n.zones */
export const ZONE_GEO = [
  { id: 'bari', x: 3, y: 12, hue: '#3f6fae' },
  { id: 'canaria', x: 6, y: 6, hue: '#c9814f' },
  { id: 'sound', x: 10, y: 11, hue: '#7a5fd0' },
  { id: 'school', x: 10, y: 3, hue: '#b8b09a' },
  { id: 'university', x: 14, y: 7, hue: '#5e8f89' },
  { id: 'leon', x: 17, y: 3, hue: '#d0a94f' },
  { id: 'desk', x: 18, y: 12, hue: '#9a8f7c' },
  { id: 'cyber', x: 21, y: 8, hue: '#59e8d5' },
  { id: 'frontier', x: 21, y: 3, hue: '#9cfff1' },
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

/* CTF: answer is checked as SHA-256 of the normalized date, never stored in clear */
export const CTF = {
  hashHex: '2d2f7b8873a30d247df3ca507ab43e2f9d4f896505da3b5144a6670e0d696036',
  endpoint: 'https://formsubmit.co/ajax/guariniflavio@gmail.com',
};
