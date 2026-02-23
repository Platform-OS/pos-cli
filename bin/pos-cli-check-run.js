#!/usr/bin/env node
import path from 'path';
import { program } from '../lib/program.js';
import { run } from '../lib/check.js';

program
  .name('pos-cli check run')
  .description('check Liquid code quality with platformos-check linter')
  .argument('[path]', 'path to check (defaults to current directory)', process.cwd())
  .option('-a', 'enable automatic fixing')
  .option('-f <format>', 'output format: text or json', 'text')
  .option('-s, --silent', 'only show errors, no success messages')
  .action(async (checkPath, options) => {
    const absolutePath = path.resolve(checkPath);

    await run({
      path: absolutePath,
      autoFix: options.a || false,
      format: options.f || 'text',
      silent: options.silent || false
    });
  });

program.parse(process.argv);
