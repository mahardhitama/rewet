// The language. English is the copy in the modules themselves. For 'id', applyLang merges src/strings.id.js over it.
// main.js imports this module first, so every module reads the merged copy. A switch of language reloads the page.
import * as S from './strings.js';
import { CONCEPTS, TILES, SPECIES } from './journal.js';
import { LEVELS } from './levels.js';
import { ART_TEXT } from './journalArt.js';
import { browserStorage, loadSave } from './save.js';
import * as ID from './strings.id.js';

const plain = v => v && typeof v === 'object' && !Array.isArray(v);
// Objects merge key by key, so a missing key keeps its English text. Arrays and functions are replaced whole.
function merge(to, from) {
  if (Array.isArray(to)) return to.splice(0, to.length, ...from);
  for (const [k, v] of Object.entries(from)) if (plain(v) && plain(to[k])) merge(to[k], v); else to[k] = v;
}

// Mutates the English modules in place. Run it once, before any UI reads them.
export function applyLang(lang) {
  if (lang !== 'id') return;
  for (const [k, v] of Object.entries(ID.STRINGS)) merge(S[k], v);
  for (const e of CONCEPTS) Object.assign(e, ID.CONCEPTS[e.id]);
  for (const e of TILES) Object.assign(e, ID.TILES[e.id]);
  for (const e of LEVELS) Object.assign(e, ID.LEVELS[e.id]);
  for (const e of SPECIES) {
    Object.assign(e, ID.SPECIES[e.id]);
    if (e.local) [e.name, e.local] = [e.local, e.name]; // the sourced Indonesian name is the heading; the English name goes on the second line
  }
  Object.assign(ART_TEXT, ID.ART);
}

export const LANG = loadSave(browserStorage).settings.lang; // node: no localStorage, so 'en'
applyLang(LANG);
