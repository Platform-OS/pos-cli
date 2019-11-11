#!/usr/bin/env node

const EventEmitter = require('events'),
  path = require('path');

const program = require('commander'),
  notifier = require('node-notifier');

const fetchAuthData = require('../lib/settings').fetchSettings,
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
    setInterval(() => t.fetchData(), program.interval);
    logger.Info('Starting live logging...');
  }

  fetchData() {
    this.gateway.logs({lastId: storage.lastId}).then(response => {
      const logs = response && response.logs;
      if (!logs) {
        return false;
      }

      for (let k in logs) {
        let row = logs[k];

        if (!!program.filter && program.filter != row.error_type) continue;
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
  exists: key => storage.logs.hasOwnProperty(key),
};

const isError = msg => /error/.test(msg.error_type);

program
  .name('pos-cli logs')
  .arguments('[environment]', 'name of environment. Example: staging')
  .option('--interval <interval>', 'time to wait between updates in ms', 3000)
  .option('--filter <log type>', 'display only logs of given type')
  .action(environment => {
    const authData = fetchAuthData(environment, program);
    const stream = new LogStream(authData);

    stream.on('message', ({created_at, error_type, message}) => {
      if (message == null) message = '';

      const text = `[${created_at.replace(
        'T',
        ' ',
      )}] - ${error_type}: ${message.replace(/\n$/, '')}`;
      const options = {exit: false, hideTimestamp: true};

      if (isError(message)) {
        notifier.notify({
          title: error_type,
          message: message.slice(0, 100),
          icon: path.resolve(__dirname, '../lib/pos-logo.png'),
        });

        logger.Error(text, options);
      } else {
        logger.Info(text, options);
      }
    });

    stream.start();
  });

program.parse(process.argv);
