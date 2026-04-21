#!/usr/bin/env node

import { program } from '../lib/program.js';
import { createNewVersion } from '../lib/modules/version.js';

program
  .name('pos-cli modules version')
  .arguments('[version]', 'semver bump type (major|minor|patch) or an explicit semver version (default: patch)')
  .option('-p, --package [file]', 'use version from file as latest release, default: package.json')
  .option('--path <path>', 'module root directory, default is current directory')
  .option('--no-git', 'skip git commit and tag creation')
  .action(async (version, options) => {
    if (options.path) process.chdir(options.path);
    await createNewVersion(version, options);
  });

program.parse(process.argv);
