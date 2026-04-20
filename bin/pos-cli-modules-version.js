#!/usr/bin/env node

import { program } from '../lib/program.js';
import { createNewVersion } from '../lib/modules/version.js';

program
  .name('pos-cli modules version')
  .arguments('[version]', 'a valid semver version')
  .option('-p, --package [file]', 'use version from file as latest release, default: package.json')
  .option('--path <path>', 'module root directory, default is current directory')
  .action(async (version, options) => {
    if (options.path) process.chdir(options.path);
    await createNewVersion(version, options);
  });

program.parse(process.argv);
