// Link preview image: node scripts/og-image.js [out.png]  (default og.png in the repo root)
// Serve the game first: python3 -m http.server 8765. Set CHROME to the Chrome binary if it is not in the macOS default place.
// The script opens the menu in headless Chrome at 1200x630, hides all but the title, and saves a PNG.
import { writeFileSync } from 'node:fs';
import { withPage, sleep, GAME_URL, TITLE_ONLY } from './chrome.js';

const out = process.argv[2] ?? new URL('../og.png', import.meta.url).pathname;

await withPage(1200, 630, async ({ send, evaluate, shot }) => {
  await send('Page.navigate', { url: GAME_URL });
  await sleep(4000); // the font and the map sprites load
  await evaluate(`document.head.insertAdjacentHTML('beforeend', ${JSON.stringify(`<style>${TITLE_ONLY}</style>`)})`);
  await sleep(1500);
  writeFileSync(out, await shot());
});
console.log(`Wrote ${out}`);
