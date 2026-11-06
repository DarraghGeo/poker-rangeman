// Bundles the package for the browser with esbuild, runs tests/browser/scenarios.js in headless Chromium (with web
// poker-bitvaljs's workers option) and checks the results match Node. Needs a Playwright Chromium. Usage: npm run test:browser
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile, rm, mkdir, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';
import { RangeManager, Range, Board, ready, terminateWorkers } from '../../src/rangeManager.js';
import { scenarios } from './scenarios.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '.out');
await rm(out, { recursive: true, force: true });
await mkdir(path.join(out, 'bundle'), { recursive: true });

// The page bundle
const common = { bundle: true, format: 'esm', platform: 'browser', conditions: ['browser'], logLevel: 'error', target: 'es2022' };
await writeFile(path.join(out, 'entry.js'), `
  import { RangeManager, Range, Board, ready } from ${JSON.stringify(path.join(here, '../../src/rangeManager.js'))};
  import { scenarios } from ${JSON.stringify(path.join(here, 'scenarios.js'))};
  scenarios({ RangeManager, Range, Board, ready }).then(r => { window.__result = r; }, e => { window.__error = String(e && e.stack || e); });
`);
await build({ ...common, entryPoints: [path.join(out, 'entry.js')], outfile: path.join(out, 'bundle/app.js') });
await writeFile(path.join(out, 'index.html'), '<!doctype html><meta charset="utf-8"><script type="module" src="bundle/app.js"></script>');
const kb = async file => ((await stat(path.join(out, file))).size / 1024).toFixed(0);
console.log(`Bundled: app ${await kb('bundle/app.js')} KB`);

const server = createServer(async (req, res) => {
  try {
    const file = path.join(out, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    const body = await readFile(file.endsWith(path.sep) ? path.join(file, 'index.html') : file);
    res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript' : 'text/html' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;

// Playwright (or playwright-core) from node_modules or a global install
const require = createRequire(import.meta.url);
const loadPlaywright = () => { for (const name of ['playwright', 'playwright-core']) { try { return require(name); } catch {} } throw new Error('Install playwright-core and a Chromium (npx playwright-core install chromium)'); };
const { chromium } = loadPlaywright();
const browser = await chromium.launch();
let failed = false;
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForFunction(() => window.__result || window.__error, null, { timeout: 120000 });
  const { result, error } = await page.evaluate(() => ({ result: window.__result, error: window.__error }));
  if (error || errors.length) throw new Error(error || errors.join('\n'));
  const expected = await scenarios({ RangeManager, Range, Board, ready });
  const a = JSON.stringify(result), b = JSON.stringify(expected);
  if (a !== b) {
    failed = true;
    for (const key of Object.keys(expected)) {
      if (JSON.stringify(result[key]) !== JSON.stringify(expected[key])) console.log(`Mismatch in ${key}:\n  browser ${JSON.stringify(result[key]).slice(0, 300)}\n  node    ${JSON.stringify(expected[key]).slice(0, 300)}`);
    }
  } else {
    console.log(`Browser results match Node (${Object.keys(expected).length} scenarios; workers ${result.workersMatch ? 'match' : 'DO NOT match'} single-threaded)`);
    if (!result.workersMatch) failed = true;
  }
} finally {
  await browser.close();
  server.close();
  terminateWorkers();
}
process.exit(failed ? 1 : 0);
