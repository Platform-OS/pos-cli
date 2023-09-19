const path = require('path');
const notifier = require('node-notifier');

const instance =
  !!process.env.NO_COLOR || !!process.env.CI ? require('./logger/simple.js') : require('./logger/rainbow.js');

const showNotification = (message) => {
  if (!!process.env.CI) {
    return;
  }
  const icon = path.resolve(__dirname, '../lib/pos-logo.png');
  notifier.notify({ title: 'Error', message, icon, 'app-name': 'pos-cli' });
};

const formatter = (msg, opts = { hideTimestamp: false }) => {
  let message = msg;

  if (msg instanceof Error) {
    message = JSON.stringify(msg.message, null, 2);
  }
  else if(typeof msg != 'string') {
    message = JSON.stringify(msg, null, 2);
  }

  if (!opts.hideTimestamp) {
    const HHMMSS = new Date().toTimeString().split(' ')[0];
    message = `[${HHMMSS}] ${message}`;
  }

  return message.trim();
};

const logger = {
  Error: (message, opts) => {
    const options = Object.assign({}, { exit: true, notify: true }, opts);
    const msg = formatter(message, options);
    instance.Error(msg);

    if (msg && options.notify) {
      try {
        showNotification(msg.slice(0, 100));
      } catch(e) { console.error(e) }
    }

    if (options.exit) {
      process.exit(1);
    } else {
      return false;
    }
  },
  Log: (message, opts = {}) => instance.Log(message),
  Success: (message, opts = {}) => instance.Success(formatter(message, opts)),
  Quiet: (message, opts = {}) => instance.Quiet(formatter(message, opts)),
  Info: (message, opts = {}) => instance.Info(formatter(message, opts)),
  Warn: (message, opts = {}) => instance.Warn(formatter(message, opts)),
  News: (message, opts = {}) => instance.News(formatter(message, opts)),
  Print: (message, opts = {}) => instance.Print(message, opts),
  Debug: (message, opts = {}) => {
    if (process.env.DEBUG) {
      instance.Warn(formatter(message, opts));
    }
  },
};

module.exports = logger;
