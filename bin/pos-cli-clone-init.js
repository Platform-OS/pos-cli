#!/usr/bin/env node

import { program } from '../lib/program.js';
import Gateway from '../lib/proxy.js';
import { fetchSettings } from '../lib/settings.js';
import waitForStatus from '../lib/data/waitForStatus.js';
import logger from '../lib/logger.js';
import ora from 'ora';

program.showHelpAfterError();
program
  .name('pos-cli clone init')
  .arguments('[sourceEnv]', 'source environment. Example: staging')
  .arguments('[targetEnv]', 'target environment. Example: staging2')
  .action(async (sourceEnv, targetEnv, _params) => {

    const spinner = ora({ text: 'InstanceClone initilized', stream: process.stdout, interval: 500 });

    try {
      const sourceAuthData = await fetchSettings(sourceEnv, program);
      const targetAuthData = await fetchSettings(targetEnv, program);

      const sourceGateway = new Gateway(sourceAuthData);
      const targetGateway = new Gateway(targetAuthData);

      spinner.start();

      const payload = await targetGateway.cloneInstanceInit();
      await sourceGateway.cloneInstanceExport(payload);

      const checkInstanceCloneStatus = () => {
        return targetGateway.cloneInstanceStatus(payload.id);
      };
      const formatResponse = r => `${r.status.name} \n${r.statuses.map((item) => [item.created_at, item.name].join(' ')).join('\n')}`;
      await waitForStatus(checkInstanceCloneStatus, [], 'done', 2000, (msg) => {
        spinner.text = formatResponse(msg);
      });

      spinner.stopAndPersist().succeed(`${sourceEnv} instance clone to ${targetEnv} succeeded.`);
    } catch(e) {
      spinner.stop();
      logger.Error(e);
    }
  });

program.parse(process.argv);
