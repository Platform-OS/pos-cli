#!/usr/bin/env node
import { program } from '../lib/program.js';
import logger from '../lib/logger.js';
import ora from '../lib/ora.js';
import { MISSING_PACKAGE_MESSAGE } from '../lib/check-messages.js';

program
  .name('pos-cli check update-docs')
  .description('download the latest platformOS Liquid documentation used by the linter')
  .action(async () => {
    let platformosCheck;
    try {
      platformosCheck = await import('@platformos/platformos-check-node');
    } catch {
      await logger.Error(MISSING_PACKAGE_MESSAGE);
      return;
    }

    const spinner = ora({ text: 'Downloading platformOS Liquid docs...', stream: process.stdout });
    spinner.start();

    try {
      await platformosCheck.updateDocs((msg) => {
        if (msg) spinner.text = msg;
      });
      spinner.succeed('platformOS Liquid docs updated successfully.');
    } catch (error) {
      spinner.fail('Failed to update docs.');
      await logger.Error(error.message);
    }
  });

program.parse(process.argv);
