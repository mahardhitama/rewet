import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { CONCEPTS, SPECIES } from '../src/journal.js';

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

test('ids are unique and lowercase words', () => {
  const ids = [...CONCEPTS, ...SPECIES].map(e => e.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z]+$/);
});

test('a concept body is 2 to 4 sentences and has no t CO2 or hectare target', () => {
  for (const c of CONCEPTS) {
    assert.ok(c.title && c.body);
    assert.ok(sentences(c.body) >= 2 && sentences(c.body) <= 4, `${c.id}: ${sentences(c.body)} sentences`);
    assert.doesNotMatch(c.body, /t CO2(?!-?C)|million hectares? (target|by 2020)/i);
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
