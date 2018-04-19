const instance = process.env.NO_COLOR ? require('./logger/simple.js') : require('./logger/rainbow.js');

const formatter = (msg, opts = {}) => {
  const hideTimestamp = opts.hideTimestamp || false;

  let message = typeof msg === 'string' ? msg : JSON.stringify(msg);

  if(!hideTimestamp) {
    const HHMMSS = new Date().toTimeString().split(' ')[0];
    message = `[${HHMMSS}] ${message}`;
  }

  return message;
};

const logger = {
  Error: (message, opts = {}) => instance.Error(formatter(message, opts)),
  Success: (message, opts = {}) => instance.Success(formatter(message, opts)),
  Quiet: (message, opts = {}) => instance.Quiet(formatter(message, opts)),
  Info: (message, opts = {}) => instance.Info(formatter(message, opts)),
  Warn: (message, opts = {}) => instance.Warn(formatter(message, opts)),
  Print: (message, opts = {}) => instance.Print(message, opts)
};

module.exports = { logger };
