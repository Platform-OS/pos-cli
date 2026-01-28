import path from 'path';
import notifier from 'node-notifier';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const importMetaFilename = fileURLToPath(import.meta.url);
const importMetaDirname = dirname(importMetaFilename);

const isSimple = !!process.env.NO_COLOR || !!process.env.CI;

let instance = null;
let instancePromise = null;

const loadLogger = async () => {
  if (instance) return instance;
  if (instancePromise) return instancePromise;
  
  if (isSimple) {
    instancePromise = import('./logger/simple.js').then(mod => mod.default || mod);
  } else {
    instancePromise = import('./logger/rainbow.js').then(mod => mod.default || mod);
  }
  instance = await instancePromise;
  return instance;
};

// Pre-load synchronously for backward compatibility
loadLogger().catch(() => {});

const showNotification = (message) => {
  if (process.env.CI) {
    return;
  }
  const icon = path.resolve(importMetaDirname, '../lib/pos-logo.png');
  notifier.notify({ title: 'Error', message, icon, 'app-name': 'pos-cli' });
};

const formatter = (msg, opts = { hideTimestamp: false }) => {
  let message = msg;

  if (msg instanceof Error) {
    message = JSON.stringify(msg.message, null, 2);
  } else if(typeof msg != 'string') {
    message = JSON.stringify(msg, null, 2);
  }

  if (!opts.hideTimestamp) {
    const HHMMSS = new Date().toTimeString().split(' ')[0];
    message = `[${HHMMSS}] ${message}`;
  }

  return message.trim();
};

const callInstance = async (method, args) => {
  const inst = await loadLogger();
  return inst[method](...args);
};

const logger = {
  Error: async (message, opts) => {
    const options = Object.assign({}, { exit: true, notify: true }, opts);
    const msg = formatter(message, options);

    if (msg && options.notify) {
      try {
        showNotification(msg.slice(0, 100));
      } catch(e) {
        console.error(e);
      }
    }

    if (options.exit) {
      // Print to stderr synchronously and exit immediately
      console.error(msg);
      process.exit(1);
    }

    // For non-exit errors, use async logger to avoid duplication
    await callInstance('Error', [msg]).catch(() => {});
    return false;
  },
  Log: (message, _opts = {}) => callInstance('Log', [message]),
  Success: (message, opts = {}) => callInstance('Success', [formatter(message, opts)]),
  Quiet: (message, opts = {}) => callInstance('Quiet', [formatter(message, opts)]),
  Info: (message, opts = {}) => callInstance('Info', [formatter(message, opts)]),
  Warn: (message, opts = {}) => callInstance('Warn', [formatter(message, opts)]),
  News: (message, opts = {}) => callInstance('News', [formatter(message, opts)]),
  Print: (message, opts = {}) => callInstance('Print', [message, opts]),
  Debug: (message, opts = {}) => {
    if (process.env.DEBUG) {
      callInstance('Warn', [formatter(message, opts)]);
    }
  },
  programHelp: () => {
    program.outputHelp({error: true}); process.exit(1);
  }
};

export default logger;
