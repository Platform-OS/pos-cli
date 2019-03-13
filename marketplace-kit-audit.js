#!/usr/bin/env node

const program = require('commander'),
  sh = require('shelljs'),
  rules = require('./lib/audit/rules'),
  version = require('./package.json').version;

program.version(version);

const checkPath = ({ find, directory, message }) => {
  const dirGlob = `{marketplace_builder,modules/**}/${directory}`;

  const matches = sh
    .grep('-l', find, dirGlob)
    .stdout.split('\n') // convert stdout to array of paths
    .filter(path => path) // filter out empty elements
    .map(path => path.replace('/./', '/')); // shorten path a little bit

  if (matches.length === 0) {
    return;
  }
  message(matches);
  console.log('\n');
};

const Audit = {
  run: () => rules.map(checkPath),
  runSingle: filePath => rules.map(options => checkPath({ ...options, directory: filePath }))
};

Audit.run();
