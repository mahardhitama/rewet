// A small diagram for each journal idea. Pure: each function returns SVG text, so node --test can run it.
// The art is rects and lines on a 200 x 100 grid, with crisp edges like the map sprites.
// Each value on a diagram comes from the body of its CONCEPTS entry. A curve with no value only shows a trend, so it has no numbers.
// Classes: w water, d dry peat, g plant, f fire, a accent, i ink, m dim, p people. index.html sets the colours.

const r = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="${c}"/>`;
const t = (x, y, s, c = 'i', a = 'start') => `<text x="${x}" y="${y}" class="${c}" text-anchor="${a}">${s}</text>`;
const ln = (x1, y1, x2, y2, c = 'm', dash = false) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="s${c}"${dash ? ' stroke-dasharray="3 2"' : ''}/>`;
// a stepped curve: one 2 px column for each x, from y = f(x) down to y1
const fillUnder = (x0, x1, f, y1, c) => { let s = ''; for (let x = x0; x < x1; x += 2) { const y = Math.round(f(x)); s += r(x, y, 2, y1 - y, c); } return s; };
const arrow = (x1, y, x2, c = 'a') => ln(x1, y, x2 - 3, y, c) + `<polygon points="${x2},${y} ${x2 - 4},${y - 3} ${x2 - 4},${y + 3}" class="${c}"/>`;
const tree = (x, y, c = 'g') => r(x - 1, y - 6, 2, 6, 'd') + r(x - 5, y - 13, 10, 7, c) + r(x - 3, y - 15, 6, 2, c);
const house = (x, y) => r(x - 6, y - 7, 12, 7, 'p') + r(x - 8, y - 9, 16, 2, 'a') + r(x - 6, y - 11, 12, 2, 'a') + r(x - 4, y - 13, 8, 2, 'a') + r(x - 1, y - 4, 3, 4, 'd');
const drop = (x, y) => r(x - 1, y - 12, 2, 2, 'w') + r(x - 2, y - 10, 4, 2, 'w') + r(x - 3, y - 8, 6, 2, 'w') + r(x - 4, y - 6, 8, 4, 'w') + r(x - 3, y - 2, 6, 2, 'w');
const fish = (x, y) => r(x - 4, y - 2, 7, 4, 'a') + r(x + 3, y - 3, 2, 2, 'a') + r(x + 3, y + 1, 2, 2, 'a');
const flame = (x, y) => r(x - 3, y - 4, 6, 4, 'f') + r(x - 2, y - 7, 4, 3, 'f') + r(x - 1, y - 9, 2, 2, 'f') + r(x - 1, y - 3, 2, 3, 'a');

const ART = {
  threer: () => [
    [34, 'REWET', 'block canals', drop], [100, 'REPLANT', 'endemic trees', tree], [166, 'REVITALISE', 'livelihoods', house],
  ].map(([x, a, b, icon], k) => r(x - 30, 22, 60, 44, 'bx') + icon(x, 52) + t(x, 80, a, 'a', 'middle') + t(x, 92, b, 'm z', 'middle') + (k < 2 ? arrow(x + 31, 44, x + 36) : '')).join('')
    + t(100, 12, '3 steps of peat restoration', 'm', 'middle'),

  store: () => {
    // left: wet peat keeps its carbon. right: drained peat, oxygen in, CO2 out.
    const side = (x, wet) => {
      const wt = wet ? 34 : 64;
      let s = r(x, 32, 86, 54, 'd') + r(x, wt, 86, 86 - wt, 'w') + r(x, 30, 86, 2, 'g');
      for (const [dx, dy] of [[10, 44], [30, 58], [50, 48], [70, 62], [20, 74], [62, 78], [40, 40]]) if (wet || dy > wt) s += r(x + dx, dy, 4, 4, 'bgt'); else s += r(x + dx, dy, 4, 4, 'm');
      return s + t(x + 43, 98, wet ? 'carbon stays' : 'carbon lost', wet ? 'w' : 'f', 'middle');
    };
    let s = side(4, true) + side(110, false);
    for (const x of [126, 154, 182]) s += r(x, 16, 2, 12, 'f') + `<polygon points="${x + 1},12 ${x - 3},17 ${x + 5},17" class="f"/>` + r(x - 10, 14, 2, 10, 'w') + `<polygon points="${x - 9},28 ${x - 13},23 ${x - 5},23" class="w"/>`; // CO2 up, O2 down
    return s + t(47, 14, 'wet peat', 'm', 'middle') + t(108, 22, 'O2 in', 'w', 'end') + t(196, 10, 'CO2 out', 'f', 'end');
  },

  canals: () => {
    const wt = x => 52 + 18 * Math.exp(-(x - 24) / 40); // deepest at the canal, flat 1,000 m away
    return r(4, 26, 192, 60, 'd') + fillUnder(24, 196, wt, 86, 'wd') + r(4, 26, 20, 60, 'bg') + r(10, 40, 14, 46, 'w')
      + r(4, 24, 192, 2, 'g') + ln(24, wt(24), 196, 52, 'w')
      + ln(30, 52, 30, 70, 'a') + r(28, 52, 5, 1, 'a') + r(28, 70, 5, 1, 'a') + t(36, 82, '0.40-0.50 m deeper', 'a')
      + t(17, 18, 'canal', 'i', 'middle') + t(196, 18, '1,000 m away', 'i', 'end') + t(196, 48, 'water table', 'w', 'end') + t(196, 96, 'peat', 'm', 'end');
  },

  rule: () => {
    const col = (x, wtM, ok) => { const y = 24 + wtM * 60; return r(x, 24, 50, 64, 'd') + r(x, y, 50, 88 - y, 'w') + r(x, 22, 50, 2, 'g') + t(x + 25, 98, ok ? 'healthy' : 'damaged', ok ? 'w' : 'f', 'middle'); };
    return col(36, 0.2, true) + col(114, 0.8, false) + ln(4, 48, 170, 48, 'a', true) + t(196, 51, '0.4 m', 'a', 'end')
      + t(4, 26, '0 m', 'm') + t(100, 12, 'water-table depth on farmed peat', 'm', 'middle') + flame(139, 22) + flame(147, 22);
  },

  blocks: () => {
    // left: the depth as bars that hang down from the surface, 1 m = 55 px
    const bar = (x, m, c, s) => r(x, 20, 26, Math.round(m * 55), c) + t(x + 13, Math.max(54, 28 + Math.round(m * 55)), s, c === 'w' ? 'w' : 'a', 'middle');
    let s = r(4, 18, 82, 2, 'g') + bar(12, 1.12, 'f', '1.12 m') + bar(50, 0.37, 'w', '0.37 m') + ln(4, 42, 86, 42, 'a', true) + t(4, 12, 'before / after', 'm');
    // right: a cascade of blocks down a sloping canal, each step under 0.5 m of head
    for (let k = 0; k < 4; k++) { const x = 100 + k * 24, y = 30 + k * 14; s += r(x, y, 24, 90 - y, 'd') + r(x, y + 4, 22, 6, 'w') + r(x + 22, y, 3, 12, 'a'); }
    return s + t(148, 12, 'cascade', 'm', 'middle') + t(150, 98, 'each step < 0.5 m', 'a', 'middle');
  },

  fire: () => {
    const y = x => x < 80 ? 74 : 74 - (x - 80) * 0.45; // flat to 0.40 m, then up. A trend only: no source gives values.
    return fillUnder(80, 190, y, 80, 'fd') + ln(20, 80, 190, 80, 'm') + ln(20, 20, 20, 80, 'm') + fillUnder(20, 80, y, 80, 'wd')
      + ln(80, 18, 80, 80, 'a', true) + t(82, 26, '0.40 m', 'a') + t(24, 18, 'fire risk', 'i') + t(190, 92, 'water-table depth', 'i', 'end')
      + t(22, 92, 'wet', 'w') + flame(160, 40) + flame(172, 36);
  },

  carbon: () => {
    // left: subsidence in cm per year = 0.1 x the water-table depth in cm. 100 cm = 80 px across, 10 cm/yr = 60 px up.
    let s = ln(16, 80, 100, 80, 'm') + ln(16, 20, 16, 80, 'm') + ln(16, 80, 96, 20, 'a');
    s += t(98, 92, '100 cm deep', 'm', 'end') + t(14, 92, '0', 'm') + t(20, 16, '10 cm/yr sinks', 'a');
    // right: IPCC CO2 defaults in t C per hectare per year. 11 t C = 55 px.
    s += r(122, 25, 26, 55, 'f') + r(160, 79, 26, 1, 'w') + ln(116, 80, 196, 80, 'm');
    return s + t(135, 20, '11', 'f', 'middle') + t(173, 74, '0', 'w', 'middle') + t(135, 90, 'drained', 'm z', 'middle') + t(173, 90, 'rewet', 'm z', 'middle') + t(158, 99, 't C/ha/yr', 'm', 'middle');
  },

  seasons: () => {
    // R14 Table 4: depth in m at each distance, [dry, rainy]. 1 m = 70 px down from the surface.
    const rows = [['10 m', 0.88, 0.50], ['100 m', 0.54, 0.13], ['400 m', 0.35, 0.05], ['1,000 m', 0.33, 0.06]];
    let s = r(4, 20, 192, 2, 'g') + ln(4, 48, 196, 48, 'a', true) + t(196, 57, '0.4 m', 'a', 'end');
    rows.forEach(([d, dry, wet], k) => { const x = 18 + k * 46; s += r(x, 22, 12, Math.round(dry * 70), 'f') + r(x + 14, 22, 12, Math.max(1, Math.round(wet * 70)), 'w') + t(x + 13, 96, d, 'm', 'middle'); });
    return s + r(4, 6, 8, 6, 'f') + t(15, 12, 'dry', 'f') + r(44, 6, 8, 6, 'w') + t(55, 12, 'rainy', 'w') + t(196, 12, 'from canal', 'm', 'end');
  },

  burn: () => {
    // t C per hectare: one fire = 353 t d.m. x 0.464 = 164 t C. Oil palm 11 t C a year. 164 t C = 70 px.
    const k = 70 / 164, h = Math.round(164 * k);
    let s = ln(4, 86, 196, 86, 'm') + r(40, 86 - h, 30, h, 'f') + flame(55, 86 - h - 1);
    for (let y = 0; y < 15; y++) s += r(120, 86 - Math.round((y + 1) * 11 * k), 30, Math.round(11 * k) - 1, 'a');
    return s + t(55, 96, '1 fire', 'f', 'middle') + t(135, 96, '15 yr oil palm', 'a', 'middle') + t(80, 22, '164 t C', 'f') + t(156, 40, '11 t C', 'a') + t(156, 48, 'each year', 'a z') + t(4, 10, 't C per hectare', 'm');
  },

  landuse: () => {
    // IPCC13 Table 2.1 and Table 3.1, t C per hectare per year. 20 t C = 100 px.
    const rows = [['acacia', 20, 'f'], ['cropland', 14, 'f'], ['oil palm', 11, 'f'], ['paddy rice', 9.4, 'f'], ['sago', 1.5, 'g'], ['rewetted', 0, 'w']];
    let s = t(4, 10, 't C per hectare per year', 'm');
    rows.forEach(([n, v, c], k) => { const y = 18 + k * 13, w = Math.round(v * 5); s += t(4, y + 7, n, 'i') + r(66, y, Math.max(1, w), 8, c) + t(70 + w, y + 7, String(v), c); });
    return s;
  },

  convert: () => {
    const atom = (x, y, c, s) => r(x - 7, y - 7, 14, 14, c) + t(x, y + 3, s, 'bgt', 'middle');
    let s = atom(30, 30, 'm', 'C') + t(30, 50, '12', 'm', 'middle') + t(48, 33, '+', 'i', 'middle');
    s += atom(64, 30, 'w', 'O') + atom(80, 30, 'w', 'O') + t(72, 50, '32', 'w', 'middle') + arrow(96, 30, 114);
    s += atom(130, 30, 'm', 'C') + atom(146, 30, 'w', 'O') + atom(162, 30, 'w', 'O') + t(146, 50, '44', 'a', 'middle');
    // 1 t C = 30 px; 1 t C x 44/12 = 3.67 t CO2 = 110 px
    return s + r(4, 62, 30, 8, 'm') + t(38, 69, '1 t C', 'm') + r(4, 78, 110, 8, 'a') + t(118, 85, '3.67 t CO2', 'a') + t(196, 99, 'x 44/12', 'a', 'end');
  },

  baseline: () => {
    // emissions add up over time. A trend only: the slopes are not values.
    let s = ln(16, 86, 196, 86, 'm') + ln(16, 14, 16, 86, 'm');
    s += fillUnder(16, 190, x => 86 - (x - 16) * 0.38, 86, 'fd') + fillUnder(16, 190, x => 86 - (x - 16) * 0.06, 86, 'bg');
    s += ln(16, 86, 190, 20, 'a') + ln(16, 86, 190, 76, 'w') + ln(16, 86, 190, 70, 'p', true);
    return s + t(186, 18, 'baseline', 'a', 'end') + t(186, 66, 'leakage', 'p', 'end') + t(186, 84, 'project', 'w', 'end') + t(110, 52, 'reduction', 'f', 'middle')
      + t(20, 12, 'emissions so far', 'm') + t(196, 97, 'years', 'm', 'end');
  },

  plants: () => {
    const side = (x, trees) => {
      const wt = trees ? 46 : 66;
      let s = r(x, 40, 86, 46, 'd') + r(x, wt, 86, 86 - wt, 'w') + r(x, 38, 86, 2, trees ? 'g' : 'm');
      if (trees) for (const k of [12, 34, 56, 76]) s += tree(x + k, 38);
      else for (const k of [16, 44, 70]) s += r(x + k, 32, 3, 6, 'm');
      return s + t(x + 43, 98, trees ? 'water stays' : 'peat sinks', trees ? 'w' : 'f', 'middle');
    };
    return side(4, false) + side(110, true) + t(47, 14, 'rewet only', 'm', 'middle') + t(153, 14, 'rewet + plant', 'm', 'middle');
  },

  paludi: () => {
    let s = r(4, 50, 120, 40, 'd') + r(4, 50, 120, 6, 'w') + r(4, 48, 120, 2, 'g');
    for (const k of [20, 50, 80, 108]) s += tree(k, 48);
    s += arrow(128, 40, 150) + r(156, 30, 36, 20, 'bx') + t(174, 44, '?', 'a', 'middle');
    return s + t(64, 14, 'crops on wet peat', 'm', 'middle') + t(64, 99, 'the peat stays', 'w', 'middle') + t(174, 64, 'market', 'm', 'middle') + t(139, 32, 'sell', 'a', 'middle');
  },

  people: () => {
    let s = r(4, 50, 60, 30, 'd') + r(10, 56, 48, 18, 'w') + fish(24, 65) + fish(42, 63);
    s += arrow(68, 64, 88) + house(112, 72) + house(134, 72) + r(96, 72, 54, 2, 'g') + arrow(154, 64, 170) + fish(184, 64) + r(178, 70, 14, 2, 'a');
    return s + t(34, 92, 'beje pond', 'w', 'middle') + t(122, 92, 'village', 'p', 'middle') + t(184, 92, 'food', 'a', 'middle')
      + t(100, 14, 'fish farms in old canals', 'm', 'middle') + t(122, 30, 'Care Village funds', 'a', 'middle') + ln(122, 34, 122, 50, 'a');
  },
};

// id: a CONCEPTS id. label: the text that a screen reader reads. Returns '' for an id with no diagram.
export function conceptArt(id, label) {
  const f = ART[id];
  return f ? `<svg class="jArt" viewBox="0 0 200 100" role="img" aria-label="${label}" shape-rendering="crispEdges">${f()}</svg>` : '';
}
export const ART_IDS = Object.keys(ART);
