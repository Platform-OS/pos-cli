#!/usr/bin/env node

const program = require('commander'),
      Gateway = require('../lib/proxy'),
      queries = require('../lib/graph/queries'),
      fetchAuthData = require('../lib/settings').fetchSettings,
      logger = require('../lib/logger');

const success = (msg) => {
  msg.data.constants.results.forEach(x => console.log(x.name.padEnd(50), safe(x.value)))
  logger.Print("\n")
}

const safe = (str) => {
  if ( process.env.SAFE )
    return JSON.stringify(str)
  else
    return JSON.stringify(str.slice(0,2) + '...')
}

program
  .name('pos-cli constants list')
  .arguments('[environment]', 'name of environment. Example: staging')
  .action((environment, params) => {
    const authData = fetchAuthData(environment, program);
    const gateway = new Gateway(authData);

    gateway
      .graph({query: queries.getConstants()})
      .then(success)
      .catch(console.log);
  });

program.parse(process.argv);
