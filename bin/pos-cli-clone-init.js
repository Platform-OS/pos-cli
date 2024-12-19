#!/usr/bin/env node

const { program } = require('commander'),
  fs = require('fs'),
  shell = require('shelljs'),
  Gateway = require('../lib/proxy'),
  fetchAuthData = require('../lib/settings').fetchSettings,
  fetchFiles = require('../lib/data/fetchFiles'),
  waitForStatus = require('../lib/data/waitForStatus'),
  downloadFile = require('../lib/downloadFile');

const logger = require('../lib/logger'),
  report = require('../lib/logger/report');

// importing ESM modules in CommonJS project
let ora;
const initializeEsmModules = async () => {
  if(!ora) {
    await import('ora').then(imported => ora = imported.default);
  }

  return true;
}

let gateway;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

program.showHelpAfterError();
program
  .name('pos-cli clone init')
  .arguments('[sourceEnv]', 'source environment. Example: staging')
  .arguments('[targetEnv]', 'target environment. Example: staging2')
  .action(async (sourceEnv, targetEnv, params) => {

    await initializeEsmModules();
    const spinner = ora({ text: 'InstanceClone initilized', stream: process.stdout, interval: 500 });

    try {
      const sourceAuthData = fetchAuthData(sourceEnv, program);
      const targetAuthData = fetchAuthData(targetEnv, program);

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
