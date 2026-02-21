#!/usr/bin/env node

const { program } = require('commander');
const Gateway = require('../lib/proxy');
const fetchSettings = require('../lib/settings').fetchSettings;
const logger = require('../lib/logger');

program
  .name('pos-cli fetch-logs')
  .argument('[environment]', 'name of environment. Example: staging')
  .option('--last-log-id <id>', 'return logs after provided id')
  .option('--endpoint <url>', 'override API base url')
  .option('-q, --quiet', 'suppress non-log output')
  .action(async (environment, options) => {
    try {
      const authData = fetchSettings(environment);
      if (!authData) {
        console.error('No auth data available. Set environment or MPKIT_* env vars.');
        process.exit(2);
      }

      if (options.endpoint) {
        authData.url = options.endpoint;
      }

      const gateway = new Gateway(authData);

      let lastId = options.lastLogId || options.lastLogId === 0 ? options.lastLogId : (options.lastLogId || options.lastLogId === 0 ? options.lastLogId : (options.lastLogId || options.lastLogId === 0 ? options.lastLogId : (options.lastLogId)));
      // commander converts option name to camelCase: lastLogId
      lastId = options.lastLogId || options.lastLogId === 0 ? options.lastLogId : (options.lastLogId);
      // fallback to the provided --last-log-id
      if (!lastId && options['last-log-id']) lastId = options['last-log-id'];

      // ensure lastId is either undefined or a number/string
      if (lastId !== undefined && lastId !== null) {
        lastId = String(lastId);
      }

      // fetch loop - call gateway.logs until no new logs are returned
      let seen = new Set();
      let latestId = lastId || '0';
      while (true) {
        const params = { lastId: latestId };
        const response = await gateway.logs(params).catch(err => { throw err; });
        const logs = response && response.logs;
        if (!logs || logs.length === 0) {
          break;
        }

        let maxId = latestId;
        for (let i = 0; i < logs.length; i++) {
          const row = logs[i];
          if (seen.has(row.id)) continue;
          seen.add(row.id);
          // Print each log as a JSON line
          process.stdout.write(JSON.stringify(row) + '\n');
          if (!isNaN(Number(row.id)) && Number(row.id) > Number(maxId)) {
            maxId = row.id;
          }
        }

        if (maxId === latestId) break;
        latestId = maxId;
      }

      process.exit(0);
    }
    catch (err) {
      if (!program.quiet) console.error('Error fetching logs:', err.message || err);
      process.exit(2);
    }
  });

program.parse(process.argv);
