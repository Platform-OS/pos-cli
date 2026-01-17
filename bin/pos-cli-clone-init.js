#!/usr/bin/env node

import fs from 'fs';
import { program } from 'commander';
import shell from 'shelljs';
import Gateway from '../lib/proxy.js';
import { fetchSettings } from '../lib/settings.js';
import fetchFiles from '../lib/data/fetchFiles.js';
import waitForStatus from '../lib/data/waitForStatus.js';
import downloadFile from '../lib/downloadFile.js';
import logger from '../lib/logger.js';
import report from '../lib/logger/report.js';
import ora from 'ora';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

program.showHelpAfterError();
program
  .name('pos-cli clone init')
  .arguments('[sourceEnv]', 'source environment. Example: staging')
  .arguments('[targetEnv]', 'target environment. Example: staging2')
  .action(async (sourceEnv, targetEnv, params) => {

    const spinner = ora({ text: 'InstanceClone initilized', stream: process.stdout, interval: 500 });

    try {
      const sourceAuthData = fetchSettings(sourceEnv, program);
      const targetAuthData = fetchSettings(targetEnv, program);

      sourceGateway = new Gateway(sourceAuthData);
      targetGateway = new Gateway(targetAuthData);

      spinner.start();

      const payload = await targetGateway.cloneInstanceInit();
      const response = await sourceGateway.cloneInstanceExport(payload);

      const checkInstanceCloneStatus = () => { return targetGateway.cloneInstanceStatus(payload.id) }
      const formatResponse = r => `${r.status.name} \n${r.statuses.map((item) => [item.created_at, item.name].join(" ")).join("\n")}`
      await waitForStatus(checkInstanceCloneStatus, [], 'done', 2000, (msg) => { spinner.text = formatResponse(msg) })

      spinner.stopAndPersist().succeed(`${sourceEnv} instance clone to ${targetEnv} succeeded.`);
    } catch(e) {
      spinner.stop();
      logger.Error(e);
    }
  });

program.parse(process.argv);
