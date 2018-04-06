let instance, formatter;

if (process.env.NO_COLOR)
  instance = require('./logger/simple.js');
else
  instance = require('./logger/rainbow.js');

formatter = (message, timestamp = new Date().toString()) => {
  if (process.env.NO_TIMESTAMPS)
    text = '';
  else
    text = `[${timestamp}] `;

  if (typeof message === 'string')
    text = text + message;
  else
    text = text + JSON.stringify(message);

  return text;
};

logger = {
  Error: message => instance.Error(formatter(message)),
  Success: message => instance.Success(formatter(message)),
  Quiet: message => instance.Quiet(formatter(message)),
  Info: message => instance.Info(formatter(message)),
  Warn: message => instance.Warn(formatter(message)),
  Print: message => instance.Print(message)
};

module.exports = { logger };
