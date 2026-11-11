// Headless Chrome over the DevTools protocol, for the screenshot scripts (og-image.js, press-kit.js).
// Set CHROME to the Chrome binary if it is not in the macOS default place.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const GAME_URL = 'http://localhost:8765/';
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
// The menu with only the title and the subtitle on the map.
export const TITLE_ONLY = '#menu>:not(h1,.sub),#ver{display:none!important}#menu,#menu *{opacity:1!important;transition:none!important;animation:none!important}#menu{background:none!important;border:0!important}';
export const sleep = ms => new Promise(r => setTimeout(r, ms));

// Starts Chrome at w×h, gives run() a page with send(method, params), evaluate(js), shot(), transparent(on), outline(on),
// key(k) and size(w, h),
// then closes Chrome.
// Reduced motion skips the intro, so the menu shows at once. motion: true keeps the animations (rain, ripples, particles).
export async function withPage(w, h, run, { motion = false } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'rewet-shot-'));
  const chrome = spawn(CHROME, ['--headless=new', '--hide-scrollbars', '--mute-audio', ...(motion ? [] : ['--force-prefers-reduced-motion']),
    `--user-data-dir=${profile}`, `--remote-debugging-port=${PORT}`, `--window-size=${w},${h}`, 'about:blank'], { stdio: 'ignore' });
  try {
    if (!(await fetch(GAME_URL).then(r => r.ok, () => false))) throw new Error(`No game at ${GAME_URL}. Run: python3 -m http.server 8765`);
    let tabs = null;
    for (let k = 0; k < 50 && !tabs; k++) { await sleep(200); tabs = await fetch(`http://127.0.0.1:${PORT}/json`).then(r => r.json(), () => null); }
    if (!tabs) throw new Error('Chrome did not start. Set CHROME to the Chrome binary.');
    const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0; const wait = new Map();
    ws.onmessage = e => { const m = JSON.parse(e.data); wait.get(m.id)?.(m.result ?? m.error); };
    const send = (method, params = {}) => new Promise(r => { wait.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
    const evaluate = async js => {
      const r = await send('Runtime.evaluate', { expression: js, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(`Page error: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
      return r.result?.value;
    };
    // Transparent background: no page colour and no map backdrop, so the PNG keeps an alpha channel.
    const transparent = async on => {
      await send('Emulation.setDefaultBackgroundColorOverride', on ? { color: { r: 0, g: 0, b: 0, a: 0 } } : {});
      await evaluate(`(async () => {
        (await import('/src/render/fx.js')).setBackdrop(${!on});
        document.getElementById('shotBg')?.remove();
        if (${on}) document.head.insertAdjacentHTML('beforeend', '<style id="shotBg">html,body{background:transparent!important}</style>');
      })()`);
    };
    // A dark frame around the whole screen, for the screenshots in the README.
    const outline = on => evaluate(`document.getElementById('shotLine')?.remove();
      if (${on}) document.body.insertAdjacentHTML('beforeend', '<div id="shotLine" style="position:fixed;inset:0;border:4px solid #2e271d;pointer-events:none;z-index:9999"></div>')`);
    const key = async k => { for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: k, text: type === 'keyDown' ? k : undefined }); };
    const size = (width, height) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    const shot = async () => Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64');
    await size(w, h);
    try { await run({ send, evaluate, shot, transparent, outline, key, size }); } finally { ws.close(); }
  } finally {
    chrome.kill();
    await sleep(300); // Chrome lets go of the profile folder
    rmSync(profile, { recursive: true, force: true });
  }
}
