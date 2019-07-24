#!/usr/bin/env node

const program = require('commander'),
  EventEmitter = require('events'),
  fetchAuthData = require('../lib/settings').fetchSettings,
  notifier = require('node-notifier'),
  logger = require('../lib/logger'),
  Gateway = require('../lib/proxy');

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
  .name('pos-cli logs')
  .arguments('[environment]', 'name of environment. Example: staging')
  .option('--interval <interval>', 'time to wait between updates in ms', 3000)
  .action(environment => {
    process.env.INTERVAL = program.interval;

    const authData = fetchAuthData(environment, program);
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
        notifier.notify({ title: msg.error_type, message: msg.message.slice(0, 100) });
      }
    });

    stream.start();
  });

program.parse(process.argv);
