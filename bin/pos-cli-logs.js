#!/usr/bin/env node

import EventEmitter from 'events';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { program } from 'commander';
import notifier from 'node-notifier';

import { fetchSettings } from '../lib/settings.js';
import logger from '../lib/logger.js';
import Gateway from '../lib/proxy.js';

class LogStream extends EventEmitter {
  constructor(authData, interval, filter) {
    super();
    this.authData = authData;
    this.gateway = new Gateway(authData);
    this.interval = interval;
    this.filter = !!filter && filter.toLowerCase();
  }

  start() {
    const t = this;
    setInterval(() => t.fetchData(), t.interval);
    logger.Debug('Starting live logging...');
  }

  filterByLogType(row) {
    if (!this.filter) return;

    try {
      return this.filter !== (row.error_type || 'error').toLowerCase();
    } catch {
      logger.Error(`${row.error_type} error`);
      return false;
    }
  }

  fetchData() {
    this.gateway.logs({ lastId: storage.lastId })
      .then((response) => {
        const logs = response && response.logs;
        if (!logs) {
          return false;
        }

        for (let k in logs) {
          const row = logs[k];

          if (this.filterByLogType(row)) continue;

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
  exists: (key) => storage.logs.hasOwnProperty(key)
};

const isError = (msg) => /error/.test(msg.error_type);

program
  .name('pos-cli logs')
  .argument('[environment]', 'name of environment. Example: staging')
  .option('-i, --interval <interval>', 'time to wait between updates in ms', 3000)
  .option('--filter <log type>', 'display only logs of given type, example: error')
  .option('-q, --quiet', 'show only log message, without context')
  .action(async (environment, program, _argument) => {
    const authData = await fetchSettings(environment, program);
    const stream = new LogStream(authData, program.interval, program.filter);

    stream.on('message', ({ created_at, error_type, message, data }) => {
      if (message == null) message = '';
      if (typeof(message) != 'string') message = JSON.stringify(message);

      const text = `[${created_at.replace('T', ' ')}] - ${error_type}: ${message.replace(/\r?\n$/, '')}`;
      const options = { exit: false, hideTimestamp: true };

      if (isError(message)) {
        notifier.notify({
          title: error_type,
          message: message.slice(0, 100),
          icon: path.resolve(__dirname, '../lib/pos-logo.png'),
          'app-name': 'pos-cli'
        });

        logger.Info(text, options);
      } else {
        logger.Info(text, options);
        if (!program.quiet && data) {
          let parts = [];
          if (data.url) {
            const requestUrl = new URL(`https://${data.url}`);
            let line = `path: ${requestUrl.pathname}`;
            if (requestUrl.search) line += `${requestUrl.search}`;
            parts.push(line);
          }
          if (data.page) parts.push(`page: ${data.page}`);
          if (data.partial) parts.push(`partial: ${data.partial}`);
          if (data.user && data.user.email) parts.push(`email: ${data.user.email}`);
          if (parts.length > 0) logger.Info(parts.join(' '), options);
        }
      }
    });

    stream.start();
  });

program.showHelpAfterError();
program.parse(process.argv);
