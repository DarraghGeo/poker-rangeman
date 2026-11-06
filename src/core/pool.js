// Splits an equity job across worker threads when it is big enough to pay for the messaging. Workers are created on
// first use and kept for later jobs. In Node they are unref'd, so an idle pool never keeps the process alive.
import { rangeEquity, runoutCount } from './equity.js';
import { loaded } from './load.js';

// Combo evaluations (runouts x live combos) above which `workers: undefined` uses the pool: about 50-100 ms of work
export const AUTO_WORK = 3e6;

let backend = null;
const pool = [];
const waiting = new Map();
let nextId = 1;

async function getBackend() {
  backend ||= await import('#pool-backend');
  return backend;
}

function estimateWork(job) {
  const runs = runoutCount(job.board, job.dead) || job.iterations;
  return runs * (job.heroIds.length + job.villainIds.length);
}

/** How many workers a job gets: workers is false/0 (none), true (all threads), a count, or undefined (auto). */
async function workersFor(job, workers) {
  if (workers === false || workers === 0) return 0;
  if (workers === undefined && estimateWork(job) < AUTO_WORK) return 0;
  let threads = 1;
  try { threads = (await getBackend()).threadCount(); } catch { return 0; }
  const wanted = workers === true || workers === undefined ? threads : Math.max(0, Math.floor(workers));
  return wanted >= 2 || (wanted === 1 && workers !== undefined) ? wanted : 0;
}

function acquire(count) {
  while (pool.length < count) {
    const worker = backend.createWorker();
    worker.busy = 0;
    worker.onMessage(({ id, result, error }) => {
      const task = waiting.get(id);
      if (!task) return;
      waiting.delete(id);
      if (--worker.busy === 0) worker.unref();
      if (error) task.reject(new Error(error)); else task.resolve(result);
    });
    worker.onError(error => {
      for (const task of waiting.values()) task.reject(error instanceof Error ? error : new Error(String(error.message || error)));
      waiting.clear();
      worker.busy = 0;
      worker.unref();
    });
    worker.unref();
    pool.push(worker);
  }
  return pool.slice(0, count);
}

function send(worker, job) {
  const id = nextId++;
  if (worker.busy++ === 0) worker.ref();
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    worker.post({ id, job });
  });
}

// The job without the Range objects (only plain data crosses to a worker)
const plainJob = job => ({
  heroIds: job.heroIds, villainIds: job.villainIds, heroWeight: job.heroWeight, villainWeight: job.villainWeight,
  board: job.board, dead: job.dead, iterations: job.iterations, both: job.both, seed: job.seed
});

/** Runs rangeEquity, in workers when it pays (see workersFor), else on this thread. */
export async function runPooled(job, workers) {
  const count = await workersFor(job, workers);
  if (count === 0) return rangeEquity(loaded().bitval, job);
  let threads;
  try { threads = acquire(count); } catch { return rangeEquity(loaded().bitval, job); }
  const base = plainJob(job);
  const total = runoutCount(job.board, job.dead);
  const parts = threads.map((worker, k) => {
    if (total > 0) {
      const from = Math.floor((total * k) / count), to = Math.floor((total * (k + 1)) / count);
      return send(worker, { ...base, from, to });
    }
    // Sampled (preflop): each worker draws its share of the boards with its own seed
    const iterations = Math.floor(job.iterations / count) + (k < job.iterations % count ? 1 : 0);
    const seed = job.seed === undefined ? undefined : (job.seed + k * 0x9e3779b1) | 0;
    return send(worker, { ...base, iterations: Math.max(1, iterations), seed });
  });
  const results = await Promise.all(parts);
  const merged = results[0];
  for (const result of results.slice(1)) {
    merged.runouts += result.runouts;
    for (const side of ['hero', 'villain']) {
      if (!result[side]) continue;
      for (const key of ['win', 'tie', 'lose']) {
        const into = merged[side][key], from = result[side][key];
        for (let i = 0; i < into.length; i++) into[i] += from[i];
      }
    }
  }
  return merged;
}

/** Stops the pool's workers (they are recreated on the next pooled job). */
export function terminateWorkers() {
  for (const worker of pool.splice(0)) worker.terminate();
}
