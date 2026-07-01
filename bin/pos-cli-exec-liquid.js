#!/usr/bin/env node

import { program } from '../lib/program.js';
import logger from '../lib/logger.js';
import { execLiquid } from '../lib/exec/liquid.js';

program
  .name('pos-cli exec liquid')
  .argument('<environment>', 'name of environment. Example: staging')
  .argument('[code]', 'liquid code to execute as string')
  .option('-f, --file <path>', 'path to liquid file to execute')
  .action(async (environment, code, options) => {
    try {
      const { response, cancelled } = await execLiquid({
        environment,
        code,
        file: options.file,
        program,
      });

      if (cancelled) {
        logger.Info('Execution cancelled.');
        process.exit(0);
      }

      if (response.error) {
        await logger.Error(`Liquid execution error: ${response.error}`);
        process.exit(1);
      }

      if (response.result) {
        logger.Print(response.result);
      }
    } catch (error) {
      await logger.Error(`Failed to execute liquid: ${error.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
