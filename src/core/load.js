// Lazy loaders for the evaluators. Loading on first use keeps importing poker-rangeman cheap; `ready()` loads both
// up front so the core's board and equity calls can then run synchronously.

let bitval = null;
let extval = null;
let pending = null;

/** The poker-bitvaljs instance (fast evaluator, compareRange). */
export async function loadBitVal() {
  if (!bitval) {
    const mod = await import('poker-bitvaljs');
    const BitVal = mod.default || mod;
    bitval = new BitVal();
  }
  return bitval;
}

/** poker-extval's functions (evaluateHand, evaluate, board, FLAGS). */
export async function loadExtVal() {
  if (!extval) {
    const mod = await import('poker-extval');
    // poker-extval is CommonJS: Node exposes its functions as named exports, some bundlers only on default
    const pick = name => mod[name] || (mod.default && mod.default[name]);
    extval = { evaluateHand: pick('evaluateHand'), evaluate: pick('evaluate'), board: pick('board'), FLAGS: pick('FLAGS'), hasFlag: pick('hasFlag') };
  }
  return extval;
}

/** Loads both evaluators up front (otherwise they load on first use). After it resolves, Board.fromSync works. */
export function ready() {
  pending ||= Promise.all([loadBitVal(), loadExtVal()]).then(() => undefined);
  return pending;
}

/** The loaded evaluators; `need` names the ones the caller uses ('bitval', 'extval'). */
export function loaded(...need) {
  const missing = (need.length ? need : ['bitval', 'extval']).filter(name => (name === 'bitval' ? !bitval : !extval));
  if (missing.length) throw new Error('Call `await ready()` first: the evaluators load asynchronously');
  return { bitval, extval };
}

/** Stops the Web Workers poker-bitvaljs keeps between calls (browsers; they start again when needed). */
export function terminateWorkers() {
  if (bitval && typeof bitval.terminateWorkerPool === 'function') bitval.terminateWorkerPool();
}
