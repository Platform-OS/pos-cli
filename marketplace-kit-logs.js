#!/usr/bin/env node

const program = require('commander'),
  EventEmitter = require('events'),
  fetchAuthData = require('./lib/settings').fetchSettings,
  notifier = require('node-notifier'),
  logger = require('./lib/logger'),
  Gateway = require('./lib/proxy'),
  validate = require('./lib/validators');

class LogStream extends EventEmitter {
  constructor(authData) {
    super();
    this.authData = authData;
    this.gateway = new Gateway(authData);
  }

  start() {
    const t = this;
    setInterval(() => t.fetchData(), process.env.INTERVAL);
    logger.Info('Live logging is starting. \n');
  }

  fetchData() {
    this.gateway.logs({ lastId: storage.lastId }).then(({ logs }) => {
      for (let k in logs) {
        let row = logs[k];

        if (!storage.exists(row.id)) {
          storage.add(row);
          this.emit('message', row);
        }
      }
    });
  }
}

const storage = {
  logs: {},
  lastId: 0,
  add: item => {
    storage.logs[item.id] = item;
    storage.lastId = item.id;
  },
  exists: key => storage.logs.hasOwnProperty(key)
};

const isError = msg => msg.error_type.match(/error/gi);

program
  .arguments('<environment>', 'name of environment. Example: staging')
  .option('-c --config-file <config-file>', 'config file path', '.marketplace-kit')
  .option('--interval <interval>', 'time to wait between updates in ms', 3000)
  .action((environment, params) => {
    process.env.CONFIG_FILE_PATH = params.configFile;
    process.env.INTERVAL = program.interval;

    const authData = fetchAuthData(environment);
    const stream = new LogStream(authData);

    stream.on('message', msg => {
      if (!msg.message) {
        return false;
      }

      const options = { exit: false, hideTimestamp: true };
      const text = `[${msg.created_at.replace('T', ' ')}] - ${msg.error_type}: ${msg.message.replace(/\n$/, '')}`;

      isError(msg) ? logger.Error(text, options) : logger.Info(text, options);
    });

    stream.on('message', msg => {
      if (!msg.message) {
        return false;
      }

      if (isError(msg)) {
        notifier.notify({ title: msg.error_type, message: msg.message });
      }
    });

    stream.start();
  });

program.parse(process.argv);

validate.existence({ argumentValue: program.args[0], argumentName: 'environment', fail: program.help.bind(program) });
