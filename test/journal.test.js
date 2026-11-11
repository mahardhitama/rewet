import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { CONCEPTS, SPECIES, sourceUrl } from '../src/journal.js';

const REFS = new URL('../docs/references/', import.meta.url);
const files = readdirSync(REFS).filter(f => f.endsWith('.md'));

// A source key is the first cell of a "| KEY | ... |" table row, for example "| H18 | ...".
const keys = new Set();
for (const f of files) for (const line of readFileSync(new URL(f, REFS), 'utf8').split('\n')) {
  const m = /^\|\s*([A-Z][A-Z0-9]*)\s*\|/.exec(line);
  if (m) keys.add(m[1]);
}
const sentences = s => s.split(/[.!?](?:\s|$)/).filter(Boolean).length;

test('the key parser finds the known source keys', () => {
  for (const k of ['H18', 'R14', 'IPCC13', 'PP57', 'W20', 'TC20', 'MB22', 'FAO16', 'P24', 'KFCP14', 'C19', 'PIN', 'KMP', 'WP']) assert.ok(keys.has(k), k);
});

test('each entry has sources and each source key is in docs/references', () => {
  for (const e of [...CONCEPTS, ...SPECIES]) {
    assert.ok(e.sources.length >= 1, `${e.id} has no source`);
    for (const k of e.sources) assert.ok(keys.has(k), `${e.id}: unknown source ${k}`);
  }
});

test('each source of each entry has an https link', () => {
  for (const e of [...CONCEPTS, ...SPECIES]) for (const k of e.sources) assert.match(sourceUrl(e, k) ?? '', /^https:\/\//, `${e.id}: ${k}`);
});

test('ids are unique and lowercase words', () => {
  const ids = [...CONCEPTS, ...SPECIES].map(e => e.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z]+$/);
});

test('a concept body is 2 to 4 sentences and has no t CO2 or hectare target', () => {
  for (const c of CONCEPTS) {
    assert.ok(c.title && c.body);
    assert.ok(sentences(c.body) >= 2 && sentences(c.body) <= 4, `${c.id}: ${sentences(c.body)} sentences`);
    assert.doesNotMatch(c.body, c.id === 'convert' ? /million hectares? (target|by 2020)/i : /t CO2(?!-?C)|million hectares? (target|by 2020)/i); // only the convert page explains t CO2
  }
});

test('SPECIES has one entry for each species heading in peat-swamp-wildlife.md', () => {
  const md = readFileSync(new URL('peat-swamp-wildlife.md', REFS), 'utf8');
  const heads = [...md.matchAll(/^### \d+\. (.+)$/gm)].map(m => m[1].trim());
  assert.equal(heads.length, 11);
  assert.deepEqual(SPECIES.map(s => s.name), heads);
});

test('each species has a valid status, a scientific name, a fact and a string local name', () => {
  for (const s of SPECIES) {
    assert.match(s.status, /^(LC|NT|VU|EN|CR)$/);
    assert.ok(s.sci && s.fact, s.id);
    assert.equal(typeof s.local, 'string');
  }
});

test('IUCN now statuses', () => {
  const st = Object.fromEntries(SPECIES.map(s => [s.id, s.status]));
  assert.deepEqual(st, { orangutan: 'CR', gibbon: 'EN', langur: 'VU', sunbear: 'VU', hornbill: 'VU', stork: 'EN', fishowl: 'LC', otter: 'VU', gharial: 'EN', monitor: 'LC', snakehead: 'LC' });
});

test('each concept has a diagram with alt text, and each diagram has a concept', async () => {
  const { conceptArt, ART_IDS } = await import('../src/journalArt.js');
  assert.deepEqual([...ART_IDS].sort(), CONCEPTS.map(c => c.id).sort());
  for (const c of CONCEPTS) {
    assert.ok(c.alt?.length > 20, `${c.id}: no alt text`);
    const svg = conceptArt(c.id, c.alt);
    assert.match(svg, /^<svg [^>]*role="img"/);
    assert.doesNotMatch(svg, /NaN|undefined/, c.id);
  }
});

test('each tile names real actions and real concept pages, and the journal has an even page count', async () => {
  const { TILES } = await import('../src/journal.js');
  const { ACTIONS } = await import('../src/sim/game.js');
  const concepts = new Set(CONCEPTS.map(c => c.id)), all = [...TILES, ...CONCEPTS, ...SPECIES].map(e => e.id);
  assert.equal(new Set(all).size, all.length);
  for (const t of TILES) {
    assert.ok(t.title && t.body && t.acts.length && t.see.length, t.id);
    for (const [a, text] of t.acts) assert.ok(ACTIONS[a] && text, `${t.id}: ${a}`);
    for (const id of t.see) assert.ok(concepts.has(id), `${t.id}: ${id}`);
  }
  assert.equal((2 + all.length) % 2, 0, 'a spread would have a blank page'); // 2 contents pages
});
