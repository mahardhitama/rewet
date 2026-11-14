// Pixel icons from pixelarticons 2.4.2 (MIT, (c) Gerrit Halfmann, https://github.com/halfmage/pixelarticons).
// Each value is the SVG path data of one 24x24 icon, drawn in the text colour (currentColor).
// The comment names the pixelarticons icon. A game action with no match uses the nearest icon in the set.
// Only icon() and withIcon() touch the DOM; the rest is pure, so node --test can run it.

export const ICONS = {
  tree: 'M6 4h2v2H6zm2-2h8v2H8zm10 4h2v4h-2zm2 4h2v6h-2zm-2 6h2v2h-2zM4 16h2v2H4zm-2-6h2v6H2zm4 8h12v2H6zM4 6h2v4H4z M11 18h2v4h-2zm5-14h2v2h-2z', // tree
  time: 'M6 2h12v2H6zM2 6h2v12H2zm18 0h2v12h-2zm-2-2h2v2h-2zM4 4h2v2H4zm2 18h12v-2H6zm12-2h2v-2h-2zM4 20h2v-2H4zm7-14h2v7h-2zm2 7h2v2h-2zm2 2h2v2h-2z', // clock
  funds: 'M6 2h6v2H6zM4 4h2v2H4zm8 0h2v2h-2zm-8 8h2v2H4zm8 0h2v2h-2zm-6 2h6v2H6zM2 6h2v6H2zm12 0h2v6h-2z M14 8h4v2h-4zm-4 10h2v2h-2zm8-8h2v2h-2zm-6 10h2v2h-2zm6-2h2v2h-2z M12 20h6v2h-6zm-4-6h2v4H8zm12-2h2v6h-2zM7 6h4v2H7z M9 6h2v6H9zm6 8h2v4h-2zm-1-2h3v2h-3z', // coins
  crew: 'M5 2h6v2H5zm10 0h4v2h-4zM5 10h6v2H5zm10 0h4v2h-4zm4-6h2v6h-2zm-8 0h2v6h-2zM3 4h2v6H3zM0 18h2v4H0zm14 0h2v4h-2zm8 0h2v4h-2zM4 14h8v2H4zm12 0h4v2h-4zM2 16h2v2H2zm10 0h2v2h-2zm8 0h2v2h-2z', // users
  goodwill: 'M13 22h-2v-2h2v2Zm-2-2H9v-2h2v2Zm4 0h-2v-2h2v2Zm-6-2H7v-2h2v2Zm8 0h-2v-2h2v2ZM7 16H5v-2h2v2Zm12 0h-2v-2h2v2ZM5 14H3v-2h2v2Zm16 0h-2v-2h2v2ZM3 12H1V6h2v6Zm20 0h-2V6h2v6ZM13 8h-2V6h2v2ZM5 6H3V4h2v2Zm6 0H9V4h2v2Zm4 0h-2V4h2v2Zm6 0h-2V4h2v2ZM9 4H5V2h4v2Zm10 0h-4V2h4v2Z', // heart
  wet: 'M2 18h4v-2H2zm0-6h4v-2H2zm0-6h4V4H2zm4 14h4v-2H6zm0-6h4v-2H6zm0-6h4V6H6zm4 10h4v-2h-4zm0-6h4v-2h-4zm0-6h4V4h-4zm4 14h4v-2h-4zm0-6h4v-2h-4zm0-6h4V6h-4zm4 10h4v-2h-4zm0-6h4v-2h-4zm0-6h4V4h-4z', // waves
  score: 'M16 17H13V19H15V21H9V19H11V17H8V15H16V17ZM18 5H22V11H20V7H18V11H20V13H18V15H16V5H8V15H6V13H4V11H6V7H4V11H2V5H6V3H18V5Z', // trophy
  pause: 'M10 20H4V4h6v16Zm8-16v16h-6V4h6Zm-4 2v12h2V6h-2ZM6 18h2V6H6v12Z', // pause
  play: 'M15 11h-2V9h2zm0 4h-2v-2h2zm-2 2h-2v-2h2zm0-8h-2V7h2zm-2-2H9V5h2zM9 21H7V3h2zm6-8h2v-2h-2zm-6 4h2v2H9z', // play
  fast: 'M5 19H3v-2h2v2Zm16 0h-2v-2h2v2ZM3 17H1v-6h2v6Zm11 0h-4v-4h4v4Zm9 0h-2v-6h2v6Zm-7-4h-2v-2h2v2ZM5 11H3V9h2v2Zm13 0h-2V9h2v2ZM9 9H5V7h4v2Zm11 0h-2V7h2v2Zm-5-2H9V5h6v2Z', // speed-fast
  data: 'M4 20h18v2H4zM2 2h2v18H2zm16 11v3h-2v-3zM8 13v3H6v-3zm8-2v2H8v-2zm0 5v2H8v-2zm4-12v3h-2V4zM8 4v3H6V4zm10-2v2H8V2zm0 5v2H8V7z', // chart-bar-big
  journal: 'M2 3h9v2H2zM0 19h11v2H0zM13 3h9v2h-9zm0 16h11v2H13zM11 5h2v18h-2zM0 5h2v14H0zm22 0h2v14h-2zm-7 2h5v2h-5zm0 4h5v2h-5zm0 4h2v2h-2z', // book-open
  tempBlock: 'M14 4h4v2h-4zm-4-2h4v2h-4zM6 8h4v2H6zm0 10h4v2H6zm4-8h4v2h-4zm0 10h4v2h-4zm4-12h4v2h-4zm0 10h4v2h-4zM6 4h4v2H6zM2 6h4v2H2zm0 10h4v2H2zM18 6h4v2h-4zm0 10h4v2h-4z M2 6h2v12H2zm18 0h2v12h-2zm-8 6h2v8h-2z', // box
  permBlock: 'M4 2h16v2H4zm0 18h16v2H4zM2 4h2v16H2zm18 0h2v16h-2zM4 8h16v2H4zm0 6h16v2H4zM6 4h2v4H6zm2 12h2v4H8zm6-12h2v4h-2zm2 12h2v4h-2zm-5-6h2v4h-2z', // wall
  backfill: 'M4 16h16v2H4zm4 4h8v2H8zm3-18h2v12h-2z M9 10h6v2H9zM7 8h10v2H7z', // flatten
  well: 'M2 21h4v-2H2zm0-6h4v-2H2zm4 8h4v-2H6zm0-6h4v-2H6zm4 4h4v-2h-4zm4 2h4v-2h-4zm0-6h4v-2h-4zm-4-2h4v-2h-4zm8 6h4v-2h-4zm0-6h4v-2h-4zm-7-4h2V1h-2z M9 5h6V3H9zM7 7h10V5H7z', // waves-arrow-up
  plant: 'M1 18h2v4H1zm2-2h2v2H3zm2-2h6v2H5zm6-2h2v2h-2zm-6 6h4v2H5zm4 2h4v2H9zm4-2h4v2h-4zm4-2h2v2h-2zm2-8h2v8h-2zm0-4h2v4h-2zm-2-2h2v2h-2zm-4 2h4v2h-4zM7 6h6v2H7zM5 8h2v2H5zm-2 2h2v4H3z', // leaf
  mound: 'M1 19h22v2H1z M3 17h2v3H3zm2-3h2v3H5zm2-3h2v3H7zm2-3h2v3H9zm2-3h2v3h-2zM9 3h2v2H9zm4 5h2v3h-2zm2 3h2v3h-2zm2 3h2v3h-2zm2 3h2v3h-2zM9 17h2v2H9zm4 0h2v2h-2zm-2-2h2v2h-2zm2-12h2v2h-2z', // tent
  palud: 'M11 2h2v2h-2zM9 4h2v2H9zm4 0h2v2h-2zm2 2h2v2h-2zM7 6h2v2H7zm0 4h2v2H7zm-2 2h2v2H5zm2 2h2v2H7zm-2 2h2v2H5zm-2 2h18v2H3zM13 8h2v2h-2zm2 2h2v2h-2zM9 8h2v2H9zm8 4h2v2h-2zm-2 2h2v2h-2zm2 2h2v2h-2zm-6 4h2v2h-2z', // tree-pine
  pond: 'M20 9h2v6h-2zm-2-2h2v2h-2zm0 8h2v2h-2zm-6 2h6v2h-6zm0-12h6v2h-6zM2 7h2v10H2zm2 2h2v2H4zm0 4h2v2H4zm2-2h2v2H6zm2-2h2v2H8zm0 4h2v2H8zm2 2h2v2h-2zm0-8h2v2h-2zm5 3h2v2h-2z', // fish
  fireGroup: 'M9 2h2v4H9zM7 6h2v2H7zM5 8h2v2H5zm8 2h2v2h-2zm2-2h2v2h-2zm2 2h2v2h-2zm2 2h2v6h-2zM3 10h2v8H3zm8-4h2v4h-2zm6 12h2v2h-2zM7 20h10v2H7zm-2-2h2v2H5zm4-2h6v4H9z M11 14h2v3h-2z', // fire
  fireCrew: 'M4 2h16v2H4zM2 4h2v10H2zm18 0h2v10h-2zM4 14h2v2H4zm2 2h2v2H6zm4 4h4v2h-4zm10-6h-2v2h2zm-2 2h-2v2h2zm-2 2h-2v2h2zm-6 0H8v2h2z', // shield
  zoomIn: 'M22 22h-2v-2h2v2Zm-2-2h-2v-2h2v2Zm-6-2H6v-2h8v2Zm4 0h-2v-2h2v2ZM6 16H4v-2h2v2Zm10 0h-2v-2h2v2ZM4 14H2V6h2v8Zm7-5h3v2h-3v3H9v-3H6V9h3V6h2v3Zm7 5h-2V6h2v8ZM6 6H4V4h2v2Zm10 0h-2V4h2v2Zm-2-2H6V2h8v2Z', // zoom-in
  zoomOut: 'M22 22h-2v-2h2v2Zm-2-2h-2v-2h2v2Zm-6-2H6v-2h8v2Zm4 0h-2v-2h2v2ZM6 16H4v-2h2v2Zm10 0h-2v-2h2v2ZM4 14H2V6h2v8Zm14 0h-2V6h2v8Zm-4-5v2H6V9h8ZM6 6H4V4h2v2Zm10 0h-2V4h2v2Zm-2-2H6V2h8v2Z', // zoom-out
  fit: 'M4 13h16v-2H4zm7-8h2V3h-2zM9 7h4V5H9zm4 0h2V5h-2zm2 2h2V7h-2zM7 9h8V7H7zm4 10h2v2h-2zm-2-2h4v2H9zm4 0h2v2h-2zm2-2h2v2h-2zm-8 0h8v2H7z', // expand
  'new': 'M13 11h7v2h-7v7h-2v-7H4v-2h7V4h2v7Z', // plus
  'continue': 'M2 11h2v6H2zm2 6h2v2H4zm2-2h4v2H6zm0-8h4v2H6zm4 8h2v6h-2zm0-12h2v6h-2zm2 16h2v2h-2zm2-2h2v2h-2zm2-2h2v2h-2zm2-2h2v2h-2zm2-2h2v2h-2zm-2-2h2v2h-2zm-2-2h2v2h-2zm-2-2h2v2h-2zm-2-2h2v2h-2zM4 9h2v2H4z', // forward
  settings: 'M18 22H13V24H11V22H6V20H18V22ZM4 22H2V20H4V22ZM22 22H20V20H22V22ZM6 20H4V18H6V20ZM20 20H18V18H20V20ZM4 18H2V13H0V11H2V6H4V18ZM8 18H6V16H8V18ZM22 11H24V13H22V18H20V13H16V16H8V8H16V11H20V6H22V11ZM10 10V14H14V10H10ZM8 8H6V6H8V8ZM6 6H4V4H6V6ZM20 6H18V4H20V6ZM4 4H2V2H4V4ZM13 2H18V4H6V2H11V0H13V2ZM22 4H20V2H22V4Z', // gear
  credits: 'M8 2h12v2H8zM6 4h2v16H6zm14 0h2v16h-2zM4 20h16v2H4zm-2-9h2v9H2zm2-2h2v2H4zm6-3h8v2h-8zm0 4h8v2h-8zm0-2h2v2h-2zm6 0h2v2h-2zm-6 5h8v2h-8zm0 3h4v2h-4z', // article
  back: 'M20 11v2H4v-2zM8 13v2H6v-2zm2 2v2H8v-2zm2 2v2h-2v-2zm-4-6V9H6v2z M10 15V7H8v8zm2 2V5h-2v12z', // arrow-left
  close: 'M7 19H5V17H7V19ZM19 19H17V17H19V19ZM9 15V17H7V15H9ZM17 17H15V15H17V17ZM11 15H9V13H11V15ZM15 15H13V13H15V15ZM13 13H11V11H13V13ZM11 11H9V9H11V11ZM15 11H13V9H15V11ZM9 9H7V7H9V9ZM17 9H15V7H17V9ZM7 7H5V5H7V7ZM19 7H17V5H19V7Z', // close
  sound: 'M11 22H9v-2H7v-2h2V6H7V4h2V2h2v20Zm8 0h-6v-2h6v2Zm2-2h-2v-2h2v2ZM7 18H5v-2h2v2Zm10 0h-4v-2h4v2Zm6 0h-2V6h2v12ZM5 10H3v4h2v2H1V8h4v2Zm14 6h-2V8h2v8Zm-4-2h-2v-4h2v4ZM7 8H5V6h2v2Zm10 0h-4V6h4v2Zm4-2h-2V4h2v2Zm-2-2h-6V2h6v2Z', // volume-3
  replay: 'M16 4h2v6h-2zm-2-2h2v2h-2zm0 2h2v8h-2zM4 8H2v5h2z M4 6h16v2H4zm4 14H6v-6h2zm2 2H8v-2h2zm0-2H8v-8h2zm10-4h2v-5h-2z M20 18H4v-2h16z', // reload
  delete: 'M18 22H6V20H18V22ZM9 6H15V4H17V6H22V8H20V20H18V8H6V20H4V8H2V6H7V4H9V6ZM15 4H9V2H15V4Z', // trash
  level: 'M4 2h2v20H4z M4 4h16v2H4zm12 2h2v2h-2zm-2 2h2v2h-2zm2 2h2v2h-2zM4 12h16v2H4z', // flag
  sandbox: 'M2 13h9v2H2zm0 2h2v5H2zm0 5h9v2H2zm7-5h2v5H9zm6-2h5v2h-5zm-2 2h2v5h-2zm2 5h5v2h-5zm5-5h2v5h-2zM7 9h10v2H7zm0-2h2v2H7zm2-3h2v3H9zm2-2h2v2h-2zm2 2h2v3h-2zm2 3h2v2h-2z', // shapes
  upgrade: 'M8 21h8v-2H8zm0-2h2v-6H8zm-5-6h5v-2H3zm0-2h2V9H3zm2-2h2V7H5zm2-2h2V5H7zm2-2h2V3H9zm2-2h2V1h-2zm2 2h2V3h-2zm2 2h2V5h-2zm2 2h2V7h-2zm2 4h2V9h-2zm-3 0h3v-2h-3zm-2 6h2v-6h-2z', // arrow-big-up
  menu: 'M20 18H4v-2h16v2Zm0-5H4v-2h16v2Zm0-5H4V6h16v2Z', // menu
  help: 'M8 3h8v2H8zM6 5h2v4H6zm10 0h2v5h-2zm-3 5h3v2h-3zm-2 2h2v3h-2zm0 6h2v2h-2z', // a question mark, drawn for this game (no match in the set)
  link: 'M11 5H5v2h6V5ZM5 7H3v12h2V7Zm12 12H5v2h12v-2Zm2-6h-2v6h2v-6Zm-8 0H9v2h2v-2Zm2-2h-2v2h2v-2Zm2-2h-2v2h2V9Zm2-2h-2v2h2V7Zm2-2h-2v2h2V5Zm2-2h-2v8h2V3Z M21 3h-8v2h8V3Z', // external-link
  star: 'M5 20H8V22H3V16H5V20ZM21 22H16V20H19V16H21V22ZM10 20H8V18H10V20ZM16 20H14V18H16V20ZM14 18H10V16H14V18ZM7 16H5V13H7V16ZM19 16H17V13H19V16ZM5 13H3V11H5V13ZM21 13H19V11H21V13ZM9 9H3V11H1V7H9V9ZM23 11H21V9H15V7H23V11ZM11 7H9V3H11V7ZM15 7H13V3H15V7ZM13 3H11V1H13V3Z', // star
  starOn: 'M11 1h2v1h-2zM11 2h2v1h-2zM9 3h6v1h-6zM9 4h6v1h-6zM9 5h6v1h-6zM9 6h6v1h-6zM1 7h22v1h-22zM1 8h22v1h-22zM1 9h22v1h-22zM1 10h22v1h-22zM3 11h18v1h-18zM3 12h18v1h-18zM5 13h14v1h-14zM5 14h14v1h-14zM5 15h14v1h-14zM3 16h18v1h-18zM3 17h18v1h-18zM3 18h7v1h-7zM14 18h7v1h-7zM3 19h7v1h-7zM14 19h7v1h-7zM3 20h5v1h-5zM16 20h5v1h-5zM3 21h5v1h-5zM16 21h5v1h-5z', // star, with the inside filled
};

const NS = 'http://www.w3.org/2000/svg';
// 24 CSS px, so each icon pixel is a whole number of screen pixels at 1x, 2x and 3x.
export function icon(name) {
  const s = document.createElementNS(NS, 'svg'), p = document.createElementNS(NS, 'path');
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', width: 24, height: 24, fill: 'currentColor', 'shape-rendering': 'crispEdges', 'aria-hidden': 'true' })) s.setAttribute(k, v);
  p.setAttribute('d', ICONS[name]);
  s.append(p);
  return s;
}

// Fill el with 3 star icons, the first n filled.
export function starIcons(el, n) {
  el.replaceChildren(...[0, 1, 2].map(k => { const e = icon(k < n ? 'starOn' : 'star'); e.classList.toggle('on', k < n); return e; }));
}

// A link to an original source, opened in a new tab. label names the source for screen readers.
export function sourceLink(url, label) {
  const a = document.createElement('a');
  a.className = 'srcLink'; a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
  a.setAttribute('aria-label', label); a.title = label;
  a.append(icon('link'));
  return a;
}

// Set the text of a button that withIcon wrapped. textContent on the button would remove the icons.
export const setText = (button, text) => { button.querySelector('.t').textContent = text; };

// The purpose icon goes at the left, the button text in .t, and the hover tree at the right.
// Set the text later through .t, not textContent: textContent removes the icons.
export function withIcon(button, name) {
  const t = document.createElement('span'), tree = document.createElement('span'), pic = document.createElement('span');
  t.className = 't'; tree.className = 'tree'; pic.className = 'pic';
  t.append(...button.childNodes);
  tree.append(icon('tree')); pic.append(icon(name));
  button.append(pic, t, tree);
  return button;
}
