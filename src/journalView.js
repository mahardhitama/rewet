// The journal: a book in a <dialog>. DOM only. It reads the save's found list and changes no game state.
import { CONCEPTS, SPECIES, TILES, sourceUrl } from './journal.js';
import { conceptArt } from './journalArt.js';
import { JOURNAL as T, ACTION_TEXT } from './strings.js';
import { animalSprite, tileArt } from './render/iso.js';
import { icon, setText, sourceLink } from './icons.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
// The art is 16 px: the box scales it up, and CSS keeps the pixels sharp.
const art = (id, silhouette) => { const c = el('canvas'), s = animalSprite(id, silhouette); c.setAttribute('aria-hidden', 'true'); c.width = s.width; c.height = s.height; c.getContext('2d').drawImage(s, 0, 0); return c; };
const sources = e => {
  const s = el('small', 'jSrc', `${T.sources}: `);
  // nowrap keeps each icon on the line of its key
  e.sources.forEach((k, i) => { const one = el('span', 'nw', k); one.append(sourceLink(sourceUrl(e, k), `${T.openSource} ${k}`)); s.append(i ? ', ' : '', one); });
  return s;
};

// The page of a found species: name, sprite, names, IUCN status, habitat, fact and sources. The journal and the find card show it.
export function speciesPage(e) {
  const p = el('section', 'jPage'), box = el('div', 'jSprite');
  p.dataset.id = e.id;
  box.dataset.id = e.id; box.append(art(e.id, false)); // the alt text is the name in the heading above
  const line = el('p'); if (e.local) line.append(`${e.local} · `); line.append(el('em', '', e.sci));
  const st = el('p'); st.append(`${T.statusLabel}: `, el('span', 'jSt', `${e.status} ${T.status[e.status]}`));
  const hab = el('p'); hab.append(`${T.habitatLabel}: `, e.habitat);
  const notes = [e.protected && T.protectedNote, e.endemic && T.endemicNote].filter(Boolean).join(' ');
  p.append(el('h3', '', e.name), box, line, st, hab, el('p', '', e.fact));
  if (notes) p.append(el('p', '', notes));
  p.append(sources(e));
  return p;
}

// found: species ids. page: a concept or species id, or null for the contents. onClose runs when the dialog closes, by any way.
export function openJournal({ found = [], page = null, onClose } = {}) {
  const $ = id => document.getElementById(id), dlg = $('dJournal'), has = new Set(found);
  const dyn = [...TILES, ...CONCEPTS, ...SPECIES], byId = id => dyn.find(e => e.id === id);
  // 0 and 1 are the two contents pages, then the tiles, the concepts and the species. Keep the page count even, so a spread never has a blank page.
  const pages = ['cc', 'cw', ...dyn.map(e => e.id)];
  let idx = Math.max(0, pages.indexOf(page)), focusId = null;
  const mq = matchMedia('(max-width:600px)');

  function entry(id) {
    const e = byId(id), p = el('section', 'jPage');
    p.dataset.id = id;
    if (!e) return p; // never: ids come from `pages`
    if (SPECIES.includes(e) && has.has(id)) return speciesPage(e);
    p.append(el('h3', '', SPECIES.includes(e) ? (has.has(id) ? e.name : T.unknown) : e.title));
    if (TILES.includes(e)) {
      const box = el('div', 'jTiles'); box.setAttribute('aria-hidden', 'true'); box.append(...e.art.map(([n, cap]) => { const f = el('span'); f.append(tileArt(n)); if (cap) f.append(el('small', '', cap)); return f; })); // the heading names the tile
      const ul = el('ul', 'jActs');
      for (const [a, text] of e.acts) { const li = el('li'); li.append(icon(a), el('b', '', ACTION_TEXT[a][0]), ` ${text}`); ul.append(li); }
      p.append(box, el('p', '', e.body), el('h4', '', T.actionsHere), ul, el('h4', '', T.seeAlso));
      for (const id of e.see) { const b = el('button', 'jc', byId(id).title); b.type = 'button'; b.dataset.go = id; p.append(b); }
    } else if (CONCEPTS.includes(e)) { p.insertAdjacentHTML('beforeend', conceptArt(e.id, e.alt)); p.append(el('p', '', e.body), sources(e)); } // the SVG is our own text, not user input
    else { // a species not found yet
      const box = el('div', 'jSprite'); box.setAttribute('aria-hidden', 'true'); box.append(art(id, true));
      p.append(box, el('p', '', T.notFound));
    }
    return p;
  }
  function contents(kind) {
    const p = el('section', 'jPage'), list = kind === 'cc' ? CONCEPTS : SPECIES;
    if (kind === 'cc') { // the tiles come first on the ideas page, so the home spread stays 2 pages
      p.append(el('h3', '', T.contentsTiles));
      for (const e of TILES) { const b = el('button', 'jc', e.title); b.dataset.go = e.id; b.type = 'button'; p.append(b); }
    }
    p.append(el('h3', '', kind === 'cc' ? T.contentsConcepts : T.contentsWildlife(SPECIES.filter(s => has.has(s.id)).length, SPECIES.length)));
    list.forEach((e, k) => {
      const b = el('button', 'jc', SPECIES.includes(e) ? (has.has(e.id) ? e.name : `${T.unknown} ${T.notFound}`) : e.title);
      if (SPECIES.includes(e) && !has.has(e.id)) b.setAttribute('aria-label', T.hidden(k + 1, list.length)); // 11 buttons need 11 names
      b.dataset.go = e.id; b.type = 'button';
      p.append(b);
    });
    return p;
  }

  function render() {
    const one = mq.matches, step = one ? 1 : 2;
    if (!one) idx -= idx % 2; // a spread starts on an even page
    const shown = pages.slice(idx, idx + step);
    $('jBook').classList.toggle('one', one);
    $('jBook').replaceChildren(...shown.map(id => id === 'cc' || id === 'cw' ? contents(id) : entry(id)));
    $('jPos').textContent = T.pos(idx + 1, idx + shown.length, pages.length);
    $('jPrev').disabled = idx === 0; $('jNext').disabled = idx + step >= pages.length;
    if (document.activeElement?.disabled || document.activeElement === document.body) { const t = focusId && !$(focusId).disabled ? $(focusId) : $('jClose'); t.focus(); } // a disabled target cannot take focus
    $('jBook').scrollTop = 0;
  }
  const turn = d => { idx = Math.min(pages.length - 1, Math.max(0, idx + d * (mq.matches ? 1 : 2))); render(); };

  $('jTitle').textContent = T.title; for (const [id, text] of [['jClose', T.close], ['jHome', T.home], ['jPrev', T.prev], ['jNext', T.next]]) setText($(id), text);
  $('jHint').textContent = T.hint;
  $('jClose').onclick = () => dlg.close();
  $('jHome').onclick = () => { idx = 0; focusId = 'jNext'; render(); }; // home: the contents spread
  $('jPrev').onclick = () => { focusId = 'jNext'; turn(-1); };
  $('jNext').onclick = () => { focusId = 'jPrev'; turn(1); };
  $('jBook').onclick = e => { const b = e.target.closest('[data-go]'); if (b) { idx = pages.indexOf(b.dataset.go); focusId = 'jNext'; render(); } };
  dlg.onkeydown = e => { // the arrows turn pages; Esc is left to the dialog, which closes itself
    if (e.key === 'ArrowLeft') { e.preventDefault(); focusId = null; turn(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); focusId = null; turn(1); }
  };
  mq.onchange = render;
  dlg.onclose = () => { mq.onchange = null; dlg.onkeydown = dlg.onclose = null; onClose?.(); };
  render();
  dlg.showModal();
}
