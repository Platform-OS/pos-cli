#!/usr/bin/env node

const APP_DIR = 'app';
const LEGACY_APP_DIR = 'marketplace_builder';
const MODULES_DIR = 'modules';

const program = require('commander'),
  sh = require('shelljs'),
  rules = require('./lib/audit/rules'),
  version = require('./package.json').version;

program.version(version);

const checkPath = ({ find, directory, message }) => {
  const dirGlob = `{${APP_DIR},${LEGACY_APP_DIR},${MODULES_DIR}/**}/${directory}`;

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
