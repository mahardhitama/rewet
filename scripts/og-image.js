// Link preview image: node scripts/og-image.js [out.png]  (default og.png in the repo root)
// Serve the game first: python3 -m http.server 8765. Set CHROME to the Chrome binary if it is not in the macOS default place.
// The script opens the menu in headless Chrome at 1200x630, hides all but the title, and saves a PNG.
// Reduced motion skips the intro, so the menu shows at once.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = process.argv[2] ?? new URL('../og.png', import.meta.url).pathname;
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL_ = 'http://localhost:8765/', PORT = 9333, W = 1200, H = 630;
const HIDE = '#menu>:not(h1,.sub),#ver{display:none!important}#menu,#menu *{opacity:1!important;transition:none!important;animation:none!important}#menu{background:none!important;border:0!important}';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'rewet-og-'));
const chrome = spawn(CHROME, ['--headless=new', '--hide-scrollbars', '--mute-audio', '--force-prefers-reduced-motion',
  `--user-data-dir=${profile}`, `--remote-debugging-port=${PORT}`, `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });

try {
  if (!(await fetch(URL_).then(r => r.ok, () => false))) throw new Error(`No game at ${URL_}. Run: python3 -m http.server 8765`);
  let tabs = null;
  for (let k = 0; k < 50 && !tabs; k++) { await sleep(200); tabs = await fetch(`http://127.0.0.1:${PORT}/json`).then(r => r.json(), () => null); }
  if (!tabs) throw new Error('Chrome did not start. Set CHROME to the Chrome binary.');
  const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const wait = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); wait.get(m.id)?.(m.result); };
  const send = (method, params = {}) => new Promise(r => { wait.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });

  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_ });
  await sleep(4000); // the font and the map sprites load
  await send('Runtime.evaluate', { expression: `document.head.insertAdjacentHTML('beforeend', ${JSON.stringify(`<style>${HIDE}</style>`)})` });
  await sleep(1500);
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(out, Buffer.from(data, 'base64'));
  ws.close();
  console.log(`Wrote ${out}`);
} finally {
  chrome.kill();
  await sleep(300); // Chrome lets go of the profile folder
  rmSync(profile, { recursive: true, force: true });
}
