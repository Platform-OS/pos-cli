// GraphiQL 5 edits in Monaco, and Monaco does its language work (JSON parsing, and the
// schema-driven validation and completion that make this IDE worth opening) in web workers.
// Monaco asks `MonacoEnvironment.getWorker` for them, so this must be assigned before anything
// pulls in graphiql — hence a module of its own, imported first in index.jsx: ES imports are
// evaluated in order, while a bare assignment in the entry file would run after every import.
//
// Upstream ships setup-workers/{vite,webpack,esm.sh} and nothing for esbuild, which is what
// builds this bundle. The webpack one is the closest — it constructs plain `new Worker(url)` —
// so the workers are bundled here as three separate esbuild entry points (see package.json)
// and addressed by name, rather than through a bundler-specific `?worker` import.

// The worker files are emitted next to main.js, so resolve them against the script's own URL
// rather than the document's: that keeps them correct whether the page is served as
// /gui/graphql or /gui/graphql/, and if this ever moves behind a path prefix.
const base = new URL('.', document.currentScript?.src ?? window.location.href);
const workerUrl = (name) => new URL(name, base).href;

globalThis.MonacoEnvironment = {
  getWorker(_workerId, label) {
    switch (label) {
      case 'json':
        return new Worker(workerUrl('json.worker.js'));
      case 'graphql':
        return new Worker(workerUrl('graphql.worker.js'));
      default:
        return new Worker(workerUrl('editor.worker.js'));
    }
  }
};
