#!/usr/bin/env node

const program = require("commander");
const path = require("path");
const glob = require('fast-glob');
const table = require('text-table');

program
  .name('pos-cli generate')
  .description('List available generators')
  .action(async () => {
    const files = await glob('**/generators/*/index.js');
    if (files.length > 0) {
      console.log("List of available generators:");
      const generators = files.map((file) => {
        const generatorPath = file.replace('\/index.js', '')
        const generatorName = generatorPath.split('/').pop();
        return [generatorName, `pos-cli generate run ${generatorPath} --generator-help`];
      });
      console.log(table(generators));
    } else {
      console.log("Can't find any generators");
    }

  });

program.parse(process.argv);
