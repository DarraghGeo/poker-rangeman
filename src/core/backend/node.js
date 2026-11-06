// Worker backend for Node.js (worker_threads). Chosen through package.json "imports" (#pool-backend) under the
// "node" condition, so browser bundles never see a node: import.
import { Worker, parentPort, isMainThread } from 'node:worker_threads';
import { availableParallelism, cpus } from 'node:os';

export const threadCount = () => Math.max(1, (availableParallelism ? availableParallelism() : cpus().length) - 1);

/** A worker running src/core/worker.js. Unref'd, so an idle pool never keeps the process alive. */
export function createWorker() {
  // Flags meant for an eval'd entry point (--input-type) are invalid for a worker file
  const execArgv = process.execArgv.filter(flag => !flag.startsWith('--input-type') && flag !== '-e' && flag !== '--eval');
  const worker = new Worker(new URL('../worker.js', import.meta.url), { execArgv });
  // The pool refs a worker while it has a job and unrefs it when idle, so an idle pool never keeps the process alive
  return {
    post: (message, transfer) => worker.postMessage(message, transfer),
    onMessage: handler => worker.on('message', handler),
    onError: handler => worker.on('error', handler),
    ref: () => worker.ref(),
    unref: () => worker.unref(),
    terminate: () => worker.terminate()
  };
}

// Inside a worker: receive jobs, send results
export const inWorker = !isMainThread;
export const listen = handler => parentPort.on('message', handler);
export const reply = (message, transfer) => parentPort.postMessage(message, transfer);
