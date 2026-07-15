#!/usr/bin/env node

import { program } from '../lib/program.js';
import glob from 'fast-glob';
import table from 'text-table';
import logger from '../lib/logger.js';

program
  .name('pos-cli generate')
  .description('List available generators')
  .action(async () => {
    const files = await glob('**/generators/*/index.js');
    if (files.length > 0) {
      await logger.Info('List of available generators:');
      const generators = files.map((file) => {
        const generatorPath = file.replace('/index.js', '');
        const generatorName = generatorPath.split('/').pop();
        return [generatorName, `pos-cli generate run ${generatorPath} --generator-help`];
      });
      await logger.Print(table(generators) + '\n');
    } else {
      await logger.Info("Can't find any generators");
    }

  });

program.parse(process.argv);
