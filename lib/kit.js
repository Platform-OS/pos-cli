const instance = process.env.NO_COLOR ? require('./logger/simple.js') : require('./logger/rainbow.js');

const formatter = msg => {
  const HHMMSS = new Date().toTimeString().split(' ')[0];
  const message = typeof msg === 'string' ? msg : JSON.stringify(msg);

  return `[${HHMMSS}] ${message}`;
};

const logger = {
  Error: message => instance.Error(formatter(message)),
  Success: message => instance.Success(formatter(message)),
  Quiet: message => instance.Quiet(formatter(message)),
  Info: message => instance.Info(formatter(message)),
  Warn: message => instance.Warn(formatter(message)),
  Print: message => instance.Print(message)
};

module.exports = { logger };
