// All UI copy (English). src/strings.id.js holds the Indonesian copy; src/i18n.js merges it in.
// PAGE: text of the static elements in index.html, as { 'selector' or 'selector@attribute': text }. English is in the HTML itself.
export const PAGE = {};
export const LINES = [[0, 'This peat swamp was once wet.'], [2.8, 'Canals drained it. Then it burned.'], [5.6, 'Block the canals. Rewet the peat. Replant.']];

// FX: words drawn in 3x5 pixel letters on the map. Use A-Z, 0-9 and spaces only.
export const FX = { cascade: 'CASCADE', dry: 'DRY SEASON' };

export const TOAST = {
  noSave: 'No save.',
  saveDeleted: 'Save deleted.',
  wet: n => `${n}% of the peat is wet now!`, // a milestone in a level
};

export const SELECT = {
  title: 'Choose a site', back: 'Back', years: n => `${n} ${n === 1 ? 'year' : 'years'}`,
  best: n => `${n} of 3 stars`,
  upTitle: 'Upgrades',
  stars: n => `Stars available: ${n}`,
  owned: 'Owned',
  buy: cost => `Buy · ★${cost}`,
  sandbox: 'Sandbox', sandboxNote: 'Random site, no pass mark, data view on',
};

export const UPGRADES = {
  crew: ['Extra crew', 'One more work crew on every site.'],
  cheapBlocks: ['Cheaper blocks', 'Blocks cost 25% less.'],
  fastCrew: ['Fast fire crews', 'Fire crews put fires out faster.'],
};

export const HUD = {
  time: (year, years, wet, week) => `Year ${year}/${years} · ${wet ? 'Wet' : 'Dry'} season · wk ${week}`,
  timeShort: (year, years, wet, week) => `${year}/${years} · ${wet ? 'Wet' : 'Dry'} · wk ${week}`, // phone: labels hidden
  // 6 parts, each { id, label, value, full }. full is the text for the screen reader and the tooltip.
  // time is { year, years, wet, week }. short is true when the labels are hidden.
  parts: (time, funds, crews, total, goodwill, wetNow, wetDry, short) => {
    const t = HUD.time(time.year, time.years, time.wet, time.week);
    const dry = wetDry == null ? '–' : `${wetDry}%`;
    const p = (id, label, value, full = `${label} ${value}`) => ({ id, label, value, full });
    return [
      p('time', '', short ? HUD.timeShort(time.year, time.years, time.wet, time.week) : t, t),
      p('funds', 'Funds', `${funds}`),
      p('crew', 'Crews', `${crews}/${total}`),
      p('goodwill', 'Goodwill', `${goodwill}`),
      p('wet', 'Wet now', `${wetNow}%`),
      p('score', 'Dry-season wet', dry, `Dry-season wet ${dry} (scored)`),
    ];
  },
  pause: 'Pause', x1: '×1', x2: '×2',
  legend: ['0 m', '40 cm', '1.5 m'], // water table below the surface
  legendTitle: 'Water table depth (data view). Wet = at or above 40 cm.',
  keys: 'P/Space pause · 1/2 speed · D data view · drag/arrows pan · +/- zoom · 0 full map · Esc menu',
  dataView: 'Data view',
  mapView: 'Map view',
};

// visible text, label for screen readers and the tooltip
export const ZOOM = {
  group: 'Zoom',
  in: ['+', 'Zoom in (+)'],
  out: ['−', 'Zoom out (-)'],
  fit: ['ALL', 'All of the map (0)'], // the name starts with the visible word (WCAG 2.5.3)
};

// the name line above the slots, and the accessible name of a slot
export const BAR = {
  name: (name, meta) => `${name}: ${meta}`,
  slot: (name, group, meta) => `${name}, ${group}, ${meta}`,
};

export const R_NAMES = { rewet: 'Rewetting', reveg: 'Revegetation', revit: 'Revitalisation', defense: 'Defense' };

// name, and the hint shown while the action is armed
// [name, how-to text, short tag shown above the slot icon]
export const ACTION_TEXT = {
  tempBlock: ['Temp block', 'Tap canal. Floods can break it.', 'Dam'],
  permBlock: ['Perm block', 'Makes a temp block permanent.', 'Dam+'],
  backfill: ['Backfill', 'Fills a canal tile with peat.', 'Fill'],
  well: ['Deep well', 'Crews in 3 tiles fight fire 2×.', 'Well'],
  plant: ['Plant', 'Plants 5×5. Lives at 0–40 cm.', 'Plant'],
  mound: ['Mound', 'Raises peat 20 cm over floods.', 'Mound'],
  palud: ['Paludiculture', 'Tap wet peat by the village.', 'Farm'],
  pond: ['Fish pond', 'Tap a canal upstream of a block.', 'Fish'],
  fireGroup: ['Fire group', 'Tap the village. Halves arson.', 'Watch'],
  fireCrew: ['Fire crew', 'Tap a fire. Puts out 3×3.', 'Fire'],
};
export const META = { until: 'until out', tile: 'tile', w: 'w' };
export const actionMeta = (cost, weeks, perTile = false) => weeks === Infinity ? META.until : perTile ? `${cost}/${META.tile} · 1–${weeks}${META.w}` : `${cost} · ${weeks}${META.w}`; // perTile: weeks is the longest job
export const SELECT_HINT = ['Pick an action, then tap a tile.', 'Tap the action again to cancel.']; // 2 lines, as the name and how-to lines of an action

export const REASON = {
  busy: 'Work already under way here.',
  funds: 'Not enough funds.',
  crew: 'No free crew.',
  invalid: 'Not possible on this tile.',
  mounded: 'This tile already has a mound.',
  nothingToPlant: 'Nothing left to plant here.',
};

export const REPORT = {
  title: year => `Year ${year} complete`,
  chart: 'Mean peat water depth, past year',
  chartAria: 'Chart of mean peat water-table depth per week over the past year, with the 40 cm wet line',
  line40: '40 cm',
  // each row is [label, value]
  rows: (burntPct, sv, goodwill, grant, funds) => [
    ['Burnt so far', `${burntPct}% of the site`],
    ['Seedling survival', sv.planted ? `${sv.alive}/${sv.planted} planted this year` : 'none planted this year'],
    ['Village goodwill', `${goodwill}`],
    ['Grant received', `+${grant} · Funds now ${funds}`],
  ],
  speciesRow: names => ['Species seen', `${names.length}`, names.join(', ')], // [label, count, namesText]
  elNino: 'Warning: El Niño next year. The dry season starts 10 weeks early. Get blocks and wells in place.',
  cont: 'Continue',
};

export const DEBRIEF = {
  title: 'Debrief',
  stars: n => `${n} of 3 stars`,
  before: 'Start', after: 'End',
  thumbs: 'Water depth at start and end (blue wet, brown dry)',
  goalHead: ['Goal', 'Result', 'Pass mark'],
  // each row is [goal, result, pass mark]
  goalRows: (r, p) => [
    [`${r.rewetPct >= p.rewet ? '✓' : '✗'}\u00a0Rewetting`, `${r.rewetPct.toFixed(0)}% of the peat stayed wet through the last dry season`, `${p.rewet}%`],
    [`${r.coverPct >= p.reveg ? '✓' : '✗'}\u00a0Revegetation`, `new forest cover is ${r.coverPct.toFixed(0)}%`, `${p.reveg}%`],
    [`${r.goodwill >= p.revit ? '✓' : '✗'}\u00a0Revitalisation`, `village goodwill is ${r.goodwill.toFixed(0)}`, `${p.revit}`],
  ],
  goalsTitle: 'Goal status',
  dataTitle: 'Data',
  dataRows: (co2, sv) => [
    ['Drainage emissions avoided', `${co2.avoidedTCO2.toFixed(1)} t CO2`],
    ['Fire emissions', `${co2.fireTCO2.toFixed(1)} t CO2`],
    ['Seedling survival', sv.planted ? `${sv.alive}/${sv.planted}` : 'none planted'],
  ],
  allMet: 'All goals met. Well done.',
  passed: 'Site restored.',
  failed: 'Site not restored.',
  loss: { fire: 'Too much of the site burnt.', funds: 'Out of funds in the final year, with no grant left to come.', goodwill: 'The village lost its trust in you.' },
  lossHint: {
    fire: 'Wet peat does not burn. Block canals early so the water stays high through the dry season.',
    funds: 'Each year brings a new grant, but the last year has none. Spend in the wet season, when work costs less, and block before you backfill.',
    goodwill: 'Keep fire away from the village and build ponds, fire groups and paludiculture.',
  },
  menu: 'Menu',
  view: 'Look at the map',
  back: 'Back to results',
  viewHint: 'Drag to look around. Scroll or pinch to zoom.',
  sandbox: seed => `Sandbox (seed ${seed}): figures only, no pass mark.`,
  figureHead: ['Goal', 'Result'],
  figureRows: r => [
    ['Rewetting', `${r.rewetPct.toFixed(0)}% of the peat stayed wet through the last dry season`],
    ['Revegetation', `new forest cover is ${r.coverPct.toFixed(0)}%`],
    ['Revitalisation', `village goodwill is ${r.goodwill.toFixed(0)}`],
  ],
};

// keyed by evaluate().hints
export const HINTS = {
  rewet: 'Rewet more peat: block canals and keep water high through the dry season.',
  reveg: 'Plant more trees on wet peat.',
  revit: 'Earn more goodwill: build ponds, fire groups and paludiculture.',
};

// The how-to dialog at the start of a level. items[level id]: level 1 shows the basics, a later level shows only what is new in it.
// icon: an ICONS name, the icon of the button that does it. key: the keyboard key, if there is one.
const act = (id, text) => ({ icon: id, name: `${ACTION_TEXT[id][0]} (${ACTION_TEXT[id][2]})`, text });
export const HOWTO = {
  title: L => `Level ${L.id}: ${L.name}`,
  sub: 'What to do on this site',
  newHere: 'New on this site',
  go: 'Start',
  hint: 'The level stays paused until you close this. Esc also closes it.',
  items: {
    1: [
      act('tempBlock', 'Tap a canal tile. The block keeps the water in the peat. Floods can break it.'),
      act('permBlock', 'Tap a temp block to make it permanent. Floods do not break it.'),
      { icon: 'wet', name: 'The 40 cm line', text: 'Peat with the water table 40 cm or less below the surface is wet. Wet peat does not burn. Keep it wet through the dry season.' },
      { icon: 'tempBlock', name: 'Distance', text: 'A block rewets the peat near the canal most. Peat far from a block stays dry. Put blocks along all of the canal.' },
      act('fireCrew', 'Tap a fire to send a crew to it.'),
      { icon: 'data', name: 'Data view', text: 'Shows the water-table depth. Blue is wet. Brown is dry.', key: 'D' },
      { icon: 'pause', name: 'Pause, ×1, ×2', text: 'Stop or change the speed of time.', key: 'P, 1, 2' },
      { icon: 'fit', name: 'Move the map', text: 'Drag or use the arrows to move. Zoom in, zoom out, or show all of the map.', key: '+, −, 0' },
    ],
    2: [
      act('plant', 'Tap peat to plant seedlings. They live only when the water table is 0 to 40 cm below the surface.'),
      act('mound', 'Seedlings in a low tile drown in a flood. A mound raises the tile 20 cm.'),
    ],
    3: [
      { icon: 'goodwill', name: 'Goodwill', text: 'The village trusts you more when you help it. At 0 goodwill, you lose the level.' },
      act('palud', 'Tap wet peat next to the village. The village farms it and gives goodwill.'),
      act('pond', 'Tap a canal tile upstream of a block. It gives goodwill.'),
      act('fireGroup', 'Tap the village. Fires near it are found at once, and there is less arson.'),
    ],
    4: [
      { icon: 'tempBlock', name: 'Cascades', text: 'One block holds water for only a short length of canal. Put a cascade of blocks along a long canal.' },
      act('backfill', 'Tap a canal tile to fill it with peat. The canal stops drainage there. It costs a lot.'),
      { icon: 'tempBlock', name: 'Illegal canals', text: 'People dig new illegal canals from the edge. Block an illegal canal early, when it is short.' },
    ],
    5: [
      { icon: 'time', name: 'El Niño', text: 'In El Niño years the dry season starts 10 weeks early. The year report tells you one year before.' },
      act('well', 'Fire crews near a well put fires out 2 times faster.'),
      { icon: 'fireCrew', name: 'Smouldering fire', text: 'A fire can burn under the surface. It starts again if the peat stays dry. Rewet the peat to stop it.' },
    ],
    6: [
      { icon: 'score', name: 'Higher pass marks', text: 'This site is large and has all of the problems. Use all that you know.' },
    ],
  },
};

export const QUIT ={ title: 'Leave this level?', body: 'Progress on this site will be lost.', yes: 'Leave', no: 'Stay' };

export const INTRO = { skip: 'Skip' };

export const MENU = {
  label: 'Progress',
  stars: (x, n) => ['Stars', `${x} of ${n}`],
  found: (x, n) => ['Wildlife found', `${x} of ${n}`],
};

export const JOURNAL = {
  title: 'Journal', open: 'Journal', close: 'Close', prev: 'Prev', next: 'Next', home: 'Home',
  pos: (a, b, n) => (a === b ? `Page ${a} of ${n}` : `Pages ${a}-${b} of ${n}`),
  contentsTiles: 'Contents: tiles', contentsConcepts: 'Contents: ideas', actionsHere: 'Actions on this tile', seeAlso: 'See also', contentsWildlife: (x, n) => `Contents: wildlife (${x}/${n})`,
  found: name => `New in your journal: ${name}`, openEntry: 'Open', notFound: 'Not found yet', unknown: '?',
  hidden: (k, n) => `Unknown species ${k} of ${n}, not found yet`,
  status: { LC: 'Least Concern', NT: 'Near Threatened', VU: 'Vulnerable', EN: 'Endangered', CR: 'Critically Endangered' },
  statusLabel: 'IUCN status', habitatLabel: 'Habitat', protectedNote: 'Protected in Indonesia.', endemicNote: 'This species lives only on Borneo.', sources: 'Sources', openSource: 'Open source', hint: 'Left and Right arrows turn pages. Esc closes.',
};
