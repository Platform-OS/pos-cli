#!/usr/bin/env node

const EventEmitter = require('events'),
  path = require('path'),
  url = require('url');

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
    this.gateway.logs({ lastId: storage.lastId }).then((response) => {
      const logs = response && response.logs;
      if (!logs) {
        return false;
      }

      console.log('len', logs.length);

      for (let k in logs) {
        const row = logs[k];
        const filter = !!program.filter && program.filter.toLowerCase();
        const errorType = (row.error_type || 'error').toLowerCase();

        if (!!program.filter && filter !== errorType) continue;

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
  add: (item) => {
    storage.logs[item.id] = item;
    storage.lastId = item.id;
  },
  exists: (key) => storage.logs.hasOwnProperty(key),
};

const isError = (msg) => /error/.test(msg.error_type);

program
  .name('pos-cli logs')
  .arguments('[environment]', 'name of environment. Example: staging')
  .option('--interval <interval>', 'time to wait between updates in ms', 3000)
  .option('--filter <log type>', 'display only logs of given type, example: error')
  .option('-q, --quiet', 'show only log message, without context')
  .action((environment) => {
    const authData = fetchAuthData(environment, program);
    const stream = new LogStream(authData);

    stream.on('message', ({ created_at, error_type, message, data }) => {
      if (message == null) message = '';

      const text = `[${created_at.replace('T', ' ')}] - ${error_type}: ${message.replace(/\n$/, '')}`;
      const options = { exit: false, hideTimestamp: true };

      if (isError(message)) {
        notifier.notify({
          title: error_type,
          message: message.slice(0, 100),
          icon: path.resolve(__dirname, '../lib/pos-logo.png'),
          'app-name': 'pos-cli',
        });

        logger.Error(text, options);
      } else {
        logger.Info(text, options);
        if (!program.quiet) {
          let parts = [];
          if (data.url) {
            requestUrl = url.parse(`https://${data.url}`);
            let line = `path: ${requestUrl.pathname}`;
            if (requestUrl.search) line += `${requestUrl.search}`;
            parts.push(line);
          }
          if (data.page) parts.push(`page: ${data.page}`);
          if (data.partial) parts.push(`partial: ${data.partial}`);
          if (data.user && data.user.email) parts.push(`email: ${data.user.email}`);
          if (parts.length > 0) logger.Quiet(parts.join(' '), options);
        }
      }
    });

    stream.start();
  });

program.parse(process.argv);
