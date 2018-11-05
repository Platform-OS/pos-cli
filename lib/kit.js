const instance = process.env.NO_COLOR ? require('./logger/simple.js') : require('./logger/rainbow.js');

const formatter = (msg, opts = { hideTimestamp: false }) => {
  let message = msg;

  if (typeof msg != 'string') {
    message = JSON.stringify(msg, null, 2);
  }

  if (!opts.hideTimestamp) {
    const HHMMSS = new Date().toTimeString().split(' ')[0];
    message = `[${HHMMSS}] ${message}`;
  }

  return message;
};

const logger = {
  Error: (message, opts) => {
    const options = Object.assign({}, { exit: true }, opts);
    instance.Print('\n');
    instance.Error(formatter(message, options));

    if (options.exit) {
      process.exit(1);
    }
  },
  Success: (message, opts = {}) => instance.Success(formatter(message, opts)),
  Quiet: (message, opts = {}) => instance.Quiet(formatter(message, opts)),
  Info: (message, opts = {}) => instance.Info(formatter(message, opts)),
  Warn: (message, opts = {}) => instance.Warn(formatter(message, opts)),
  Print: (message, opts = {}) => instance.Print(message, opts),
  Debug: (message, opts = {}) => process.env.DEBUG && instance.Quiet(formatter(message, opts))
};

module.exports = { logger };
