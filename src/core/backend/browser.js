// Worker backend for browsers and other web runtimes (module Workers). The default for #pool-backend.
export const threadCount = () => Math.max(1, ((globalThis.navigator && globalThis.navigator.hardwareConcurrency) || 2) - 1);

export function createWorker(url) {
  if (typeof Worker === 'undefined') throw new Error('Web Workers are not available here');
  // Written out in full so bundlers (Vite, webpack, esbuild plugins) see and bundle the worker
  const worker = url ? new Worker(url, { type: 'module' }) : new Worker(new URL('../worker.js', import.meta.url), { type: 'module' });
  return {
    post: (message, transfer) => worker.postMessage(message, transfer),
    onMessage: handler => worker.addEventListener('message', event => handler(event.data)),
    onError: handler => worker.addEventListener('error', handler),
    ref: () => {},
    unref: () => {},
    terminate: () => worker.terminate()
  };
}

export const inWorker = typeof WorkerGlobalScope !== 'undefined' && globalThis instanceof WorkerGlobalScope;
export const listen = handler => globalThis.addEventListener('message', event => handler(event.data));
export const reply = (message, transfer) => globalThis.postMessage(message, transfer);
