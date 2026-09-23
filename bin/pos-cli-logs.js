#!/usr/bin/env node

import EventEmitter from 'events';

import { program } from '../lib/program.js';

import { fetchSettings } from '../lib/settings.js';
import logger from '../lib/logger.js';
import Gateway from '../lib/proxy.js';
import ServerError from '../lib/ServerError.js';
import { formatDiagnostic } from '../lib/diagnostics.js';
import { newerOf } from '../lib/logRowId.js';

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

          // Read first, filter second. `--filter` decides what is printed, never how far the
          // stream has read: advancing only on matching rows left the cursor where the last match
          // was, so a run whose filter matched nothing re-read one page for ever.
          if (storage.exists(row.id)) continue;
          storage.record(row);

          if (this.filterByLogType(row)) continue;
          this.emit('message', row);
        }
      })
      .catch(async (e) => {
        if (ServerError.isNetworkError(e)) {
          await ServerError.handler(e);
          process.exit(1);
        }
      });
  }
}

// Ids only: the rows themselves were kept for the life of the process and never read back, which
// on a tail left running all day is unbounded. A row id is a microsecond epoch and is never parsed.
const storage = {
  seen: new Set(),
  lastId: '0',
  record: (row) => {
    storage.seen.add(row.id);
    storage.lastId = newerOf(storage.lastId, row.id);
  },
  exists: (id) => storage.seen.has(id)
};

// The row's type, not its text. This was handed the message string in 2019 when the handler began
// destructuring the row, so it read `undefined` and no row has taken the error branch since.
const isError = (errorType) => /error/.test(errorType || '');

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

      // One printer for the whole row. `logger.Error` is red and writes to stderr, so a row's
      // detail block follows its line there rather than being split across two streams.
      // `notify: false` because logger.Error raises a desktop notification by default, and one per
      // error row on a tail that prints every row is a stream of them for what is already on screen.
      const print = isError(error_type)
        ? (msg) => logger.Error(msg, { ...options, notify: false })
        : (msg) => logger.Info(msg, options);

      print(text);

      // For every row, not only the ones that are not errors: the diagnostic is the compiler-style
      // location of a Liquid failure, which is the part of an error row worth reading.
      if (!program.quiet && data) {
        // A structured Liquid diagnostic (errors, TASK-18.2) renders as a
        // compiler-style block; the legacy {% log %} context hash keeps its
        // existing one-line url/page/partial/email rendering.
        const diagnostic = formatDiagnostic(data);
        if (diagnostic) {
          print(diagnostic);
        } else {
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
          if (parts.length > 0) print(parts.join(' '));
        }
      }
    });

    stream.start();
  });

program.showHelpAfterError();
program.parse(process.argv);
