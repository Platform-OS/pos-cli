#!/usr/bin/env node

import { program } from '../lib/program.js';
import Gateway from '../lib/proxy.js';
import queries from '../lib/graph/queries.js';
import { fetchSettings } from '../lib/settings.js';
import logger from '../lib/logger.js';

const success = (msg) => {
  msg.data.constants.results.forEach(x => console.log(x.name.padEnd(50), safe(x.value)));
  logger.Print('\n');
};

const safe = (str) => {
  if ( process.env.SAFE )
    return JSON.stringify(str);
  else
    return JSON.stringify(str.slice(0,2) + '...');
};

program
  .name('pos-cli constants list')
  .arguments('[environment]', 'name of environment. Example: staging')
  .action(async (environment, _params) => {
    const authData = await fetchSettings(environment, program);
    const gateway = new Gateway(authData);

    gateway
      .graph({query: queries.getConstants()})
      .then(success)
      .catch(console.log);
  });

program.parse(process.argv);
