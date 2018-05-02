#!/usr/bin/env node

const program = require('commander'),
  path = require('path'),
  shell = require('shelljs'),
  logger = require('./lib/kit').logger,
  version = require('./package.json').version;

program
  .version(version)
  .arguments('<module-name>', 'module name', 'mp-admin')
  .option('-s --slug <slug>', 'TODO: install module under slug', 'mp-admin-index')
  .action((moduleName, params) => {
    const path = 'marketplace_builder/pages/' + moduleName;
    shell.mkdir('-p', path);
    shell.cp(__dirname + '/gui/src/mp-admin.liquid', path + '/index.liquid');
    shell.cp(__dirname + '/gui/public/app.js', 'marketplace_builder/assets/mp-admin-app.js');

    logger.Success('GUI installed under pages/' + moduleName);
    logger.Info('Please head to YOUR-HOST/mp-admin-index');
  });

program.parse(process.argv);
if (!program.args.length) {
  program.help();
  process.exit(1);
}
