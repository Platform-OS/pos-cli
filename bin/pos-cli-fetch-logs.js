#!/usr/bin/env node

import { program } from 'commander';
import Gateway from '../lib/proxy.js';
import { fetchSettings } from '../lib/settings.js';
import { newerOf, OLDEST_RETAINED, NEWEST_PAGE } from '../lib/logRowId.js';

program
  .name('pos-cli fetch-logs')
  .argument('[environment]', 'name of environment. Example: staging')
  .option('--last-log-id <id>', `return logs after provided id; omit to read from the oldest row kept, or pass ${NEWEST_PAGE} for the newest page only`)
  .option('--endpoint <url>', 'send the request to this API base url instead of the environment\'s; your stored instance token is sent to it')
  .option('-q, --quiet', 'suppress non-log output')
  .action(async (environment, options) => {
    try {
      const authData = await fetchSettings(environment);
      if (!authData) {
        console.error('No auth data available. Set environment or MPKIT_* env vars.');
        process.exit(2);
      }

      if (options.endpoint) {
        // The stored token travels with the request, so say where it is going.
        if (!options.quiet) console.error(`Sending your stored instance token to ${options.endpoint}`);
        authData.url = options.endpoint;
      }

      const gateway = new Gateway(authData);

      // commander camel-cases the option, so `--last-log-id` arrives as `lastLogId`.
      const lastId = options.lastLogId === undefined || options.lastLogId === null
        ? undefined
        : String(options.lastLogId);

      // fetch loop - call gateway.logs until no new logs are returned
      let seen = new Set();
      // Not `0`: the platform reads that as *no cursor* and answers with the newest page alone
      // (measured 2026-09-25 — 20 rows of an instance holding 35), so a dump with no cursor
      // returned the tail and stopped. `pos-cli logs` starts there on purpose; this does not.
      let latestId = lastId || OLDEST_RETAINED;
      while (true) {
        const params = { lastId: latestId };
        const response = await gateway.logs(params).catch(err => { throw err; });
        const logs = response && response.logs;
        if (!logs || logs.length === 0) {
          break;
        }

        let maxId = latestId;
        let wroteRow = false;
        for (let i = 0; i < logs.length; i++) {
          const row = logs[i];
          if (seen.has(row.id)) continue;
          seen.add(row.id);
          wroteRow = true;
          // Print each log as a JSON line
          process.stdout.write(JSON.stringify(row) + '\n');
          maxId = newerOf(maxId, row.id);
        }

        if (maxId === latestId) {
          // Rows we had not seen, none of them newer than the cursor: the instance is not honouring
          // it, so the output is short rather than complete. A page of only already-seen rows is
          // just an inclusive `last_id` repeating the cursor row, which is the end of the log.
          if (wroteRow && !options.quiet) {
            console.error(`Stopped early at ${latestId}: the instance returned no row newer than the cursor.`);
          }
          break;
        }
        latestId = maxId;
      }

      process.exit(0);
    }
    catch (err) {
      // The parsed options, not the commander program: `program.quiet` is always undefined here,
      // so `-q` never suppressed anything.
      if (!options.quiet) console.error('Error fetching logs:', err.message || err);
      process.exit(2);
    }
  });

program.parse(process.argv);
