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
  .arguments('[from]', 'source environment. Example: staging')
  .arguments('[to]', 'target environment. Example: staging2')
  .action(async (from, to, params) => {

    await initializeEsmModules();
    const spinner = ora({ text: 'InstanceClone initilized', stream: process.stdout });

    try {
      const sourceAuthData = fetchAuthData(from, program);
      const targetAuthData = fetchAuthData(to, program);

      sourceGateway = new Gateway(sourceAuthData);
      targetGateway = new Gateway(targetAuthData);

      spinner.start();

      const payload = await sourceGateway.cloneInstanceInit()
      console.log(payload);

      const response = await targetGateway.cloneInstanceExport(payload)
      console.log(response);

      await sleep(1000);
      status = await sourceGateway.cloneInstanceStatus(payload['id']);
      console.log(status);

      spinner.stop("DONE");
    } catch(e) {
      spinner.stop();
      console.log(e);
    }
  });

program.parse(process.argv);
