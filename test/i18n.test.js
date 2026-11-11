import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../src/strings.js';
import * as ID from '../src/strings.id.js';
import { CONCEPTS, TILES, SPECIES } from '../src/journal.js';
import { LEVELS } from '../src/levels.js';
import { ART_IDS, conceptArt } from '../src/journalArt.js';
import { LANG, applyLang } from '../src/i18n.js';

// numbers and units only: they read the same in both languages
const SAME = ['HUD.x1', 'HUD.x2', 'REPORT.line40'];
const kind = v => (Array.isArray(v) ? 'array' : typeof v);

// Every key of the English copy has an Indonesian value of the same kind. Functions take the same arguments.
function sameShape(en, id, path) {
  for (const [k, v] of Object.entries(en)) {
    if (!(k in id)) { if (SAME.includes(`${path}.${k}`)) continue; assert.fail(`${path}.${k} has no Indonesian text`); }
    assert.equal(kind(id[k]), kind(v), `${path}.${k}`);
    if (typeof v === 'function') assert.equal(id[k].length, v.length, `${path}.${k} arguments`);
    else if (v && typeof v === 'object' && !Array.isArray(v)) sameShape(v, id[k], `${path}.${k}`);
  }
}

test('node has no localStorage, so the language is English', () => assert.equal(LANG, 'en'));

test('the Indonesian copy covers every string group of the English copy', () => {
  for (const [k, v] of Object.entries(S)) {
    if (typeof v === 'function' || k === 'PAGE' || k === 'BAR') continue; // actionMeta reads META; PAGE is empty in English; BAR is punctuation only
    assert.ok(k in ID.STRINGS, `${k} is missing`);
    if (Array.isArray(v)) assert.equal(ID.STRINGS[k].length, v.length, k);
    else sameShape(v, ID.STRINGS[k], k);
  }
});

test('every journal entry and level has Indonesian text, with the same tile and action ids', () => {
  for (const c of CONCEPTS) for (const f of ['title', 'alt', 'body']) assert.ok(ID.CONCEPTS[c.id]?.[f], `${c.id}.${f}`);
  for (const t of TILES) {
    const i = ID.TILES[t.id];
    assert.ok(i.title && i.body, t.id);
    assert.deepEqual(i.art.map(a => a[0]), t.art.map(a => a[0]), `${t.id} art`);
    assert.deepEqual(i.acts.map(a => a[0]), t.acts.map(a => a[0]), `${t.id} acts`);
  }
  for (const s of SPECIES) assert.ok(ID.SPECIES[s.id]?.habitat && ID.SPECIES[s.id]?.fact, s.id);
  for (const L of LEVELS) assert.ok(ID.LEVELS[L.id]?.name && ID.LEVELS[L.id]?.teaches, `level ${L.id}`);
});

test('applyLang("id") swaps the copy in place', () => {
  const words = ART_IDS.map(id => conceptArt(id, '')).join('');
  applyLang('id');
  assert.equal(S.QUIT.yes, 'Tinggalkan');
  assert.equal(S.LINES[0][1], ID.STRINGS.LINES[0][1]);
  assert.equal(S.HUD.x1, '×1'); // a key with no Indonesian text stays English
  assert.equal(S.actionMeta(10, Infinity), 'sampai padam');
  assert.equal(S.actionMeta(10, 3, true), '10/petak · 1–3mg');
  assert.deepEqual(S.HUD.parts({ year: 1, years: 3, wet: true, week: 2 }, 5, 1, 2, 50, 40, null, false).map(p => p.label), ['', 'Dana', 'Regu', 'Dukungan', 'Basah kini', 'Basah kemarau']);
  assert.equal(S.DEBRIEF.dataRows({ avoidedTCO2: 4.25, fireTCO2: 0 }, { alive: 0, planted: 0 })[0][1], '4,3 t CO2'); // decimal comma
  assert.equal(LEVELS[0].name, ID.LEVELS[1].name);
  assert.equal(S.HOWTO.title(LEVELS[0]), `Level 1: ${ID.LEVELS[1].name}`);
  // a species with a sourced Indonesian name shows it; the English name moves to the second line
  const bear = SPECIES.find(s => s.id === 'sunbear'), owl = SPECIES.find(s => s.id === 'fishowl');
  assert.deepEqual([bear.name, bear.local], ['beruang madu', 'Sun bear']);
  assert.deepEqual([owl.name, owl.local], ['Buffy fish owl', '']);
  assert.notEqual(ART_IDS.map(id => conceptArt(id, '')).join(''), words);
  assert.ok(!/>(REWET|wet peat|carbon stays)</.test(ART_IDS.map(id => conceptArt(id, '')).join('')));
});
