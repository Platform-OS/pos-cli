#!/usr/bin/env node

const program = require('commander'),
  chalk = require('chalk'),
  sh = require('@platform-os/shelljs'),
  version = require('./package.json').version,
  dir = require('./lib/directories');

const tags = require('./lib/audit/tags').getRules(),
  filters = require('./lib/audit/filters').getRules(),
  detailed = require('./lib/audit/detailed');

const rules = [...tags, ...filters, ...detailed];

program.version(version);

const getOffendingFiles = rule => {
  const findGlob = `{${dir.APP},${dir.LEGACY_APP},${dir.MODULES}/**}/${rule.glob}`;

  sh.config.silent = true;

  const files = sh
    .grep('-l', rule.test, findGlob)
    .stdout.split('\n') // convert stdout to array of paths
    .filter(path => path) // filter out empty elements
    .map(path => path.replace('/./', '/')) // shorten path a little bit
    .filter((value, index, self) => self.indexOf(value) === index); // unique only

  return files.length ? { rule, files } : null;
};

const printReport = report => {
  const filesFormatted = report.files.join('\n\t');
  const message = `${report.rule.message} \n\n\tAffected files:\n\t${filesFormatted}`;

  console.log(`${chalk.yellow('[Audit] ')}${message} \n`);
};

const Audit = {
  run: () => {
    rules
      .map(getOffendingFiles)
      .filter(r => r)
      .map(printReport);
  }
};

Audit.run();
