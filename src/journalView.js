// The journal: a book in a <dialog>. DOM only. It reads the save's found list and changes no game state.
import { CONCEPTS, SPECIES } from './journal.js';
import { JOURNAL as T } from './strings.js';
import { animalSprite } from './render/iso.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
// The art is 16 px: the box scales it up, and CSS keeps the pixels sharp.
const art = (id, silhouette) => { const c = el('canvas'), s = animalSprite(id, silhouette); c.setAttribute('aria-hidden', 'true'); c.width = s.width; c.height = s.height; c.getContext('2d').drawImage(s, 0, 0); return c; };
const sources = e => el('small', 'jSrc', `${T.sources}: ${e.sources.join(', ')}`);

// found: species ids. page: a concept or species id, or null for the contents. onClose runs when the dialog closes, by any way.
export function openJournal({ found = [], page = null, onClose } = {}) {
  const $ = id => document.getElementById(id), dlg = $('dJournal'), has = new Set(found);
  const dyn = [...CONCEPTS, ...SPECIES], byId = id => dyn.find(e => e.id === id);
  // 0 and 1 are the two contents pages, then the concepts, then the species. 22 pages: an even count, so a spread never has a blank page.
  const pages = ['cc', 'cw', ...dyn.map(e => e.id)];
  let idx = Math.max(0, pages.indexOf(page)), focusId = null;
  const mq = matchMedia('(max-width:600px)');

  function entry(id) {
    const e = byId(id), p = el('section', 'jPage');
    p.dataset.id = id;
    if (!e) return p; // never: ids come from `pages`
    p.append(el('h3', '', SPECIES.includes(e) ? (has.has(id) ? e.name : T.unknown) : e.title));
    if (CONCEPTS.includes(e)) p.append(el('p', '', e.body), sources(e));
    else if (!has.has(id)) {
      const box = el('div', 'jSprite'); box.setAttribute('aria-hidden', 'true'); box.append(art(id, true));
      p.append(box, el('p', '', T.notFound));
    } else {
      const box = el('div', 'jSprite'); box.dataset.id = id; box.append(art(id, false)); // the alt text is the name in the heading above
      const line = el('p'); if (e.local) line.append(`${e.local} · `); line.append(el('em', '', e.sci));
      p.append(box, line);
      const st = el('p'); st.append(`${T.statusLabel}: `, el('span', 'jSt', `${e.status} ${T.status[e.status]}`));
      p.append(st, el('p', '', e.fact), sources(e));
    }
    return p;
  }
  function contents(kind) {
    const p = el('section', 'jPage'), list = kind === 'cc' ? CONCEPTS : SPECIES;
    p.append(el('h3', '', kind === 'cc' ? T.contentsConcepts : T.contentsWildlife));
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

  $('jTitle').textContent = T.title; $('jClose').textContent = T.close; $('jPrev').textContent = T.prev; $('jNext').textContent = T.next;
  $('jCount').textContent = T.count(SPECIES.filter(s => has.has(s.id)).length, SPECIES.length); $('jHint').textContent = T.hint;
  $('jClose').onclick = () => dlg.close();
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
