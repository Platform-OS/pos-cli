#!/usr/bin/env node

const program = require('commander');
const ora = require('ora');
const semver = require('semver');
const fs = require('fs');
const path = require('path');
const Gateway = require('../lib/proxy');
const logger = require('../lib/logger');
const fetchAuthData = require('../lib/settings').fetchSettings;
const spinner = ora({ text: 'Setup', stream: process.stdout, spinner: 'bouncingBar' });
const files = require('../lib/files');
const { findModuleVersion, resolveDependencies } = require('../lib/modules/dependencies')

const posModulesFilePath = 'app/pos-modules.json';
const posModulesLockFilePath = 'app/pos-modules.lock.json';

const readLocalModules = () => {
  const config = files.readJSON(posModulesFilePath, { throwDoesNotExistError: true });
  return config['modules'] || {};
};

const addNewModule = async (moduleName, moduleVersion, localModules, getVersions) => {
  const newModule = await findModuleVersion(moduleName, moduleVersion, getVersions);
  if(newModule){
    const modules = {...newModule, ...localModules};
    return modules;
  } else {
    throw new Error(`Can't find module ${moduleName} with version ${moduleVersion}`);
  }
};

program
  .name('pos-cli modules setup')
  .arguments('[environment]', 'name of the environment. Example: staging')
  .arguments('[moduleNameWithVersion]', 'name of the module. Example: core. You can also pass version number: core@1.0.0')
  .action(async (environment, moduleNameWithVersion) => {
    const authData = fetchAuthData(environment, program);
    const gateway = new Gateway(authData);
    const progress = {};
    const errors = [];
    const lock = {
      modules: {}
    };
    const spinner = ora({ text: "Modules install", stream: process.stdout, spinner: 'bouncingBar' }).start();

    try{
      const getVersions = async (list) => gateway.moduleVersions(list);
      let localModules = readLocalModules();
      if(moduleNameWithVersion){
        const [moduleName, moduleVersion] = moduleNameWithVersion.split('@');
        localModules = await addNewModule(moduleName, moduleVersion, localModules, getVersions);
        fs.writeFileSync(
          path.join(process.cwd(), posModulesFilePath),
          JSON.stringify({ modules: localModules }, null, 2)
        );

        spinner.succeed(`Added module: ${moduleName}@${localModules[moduleName]}`);
      }

      if(!localModules) {
          spinner.stop();
      } else {
        spinner.start('Resolving module dependencies');
        lock['modules'] = await resolveDependencies(localModules, getVersions);

        if (errors.length) {
          errors.map(e => logger.Warn(e, { hideTimestamp: true }));
          logger.Error('Some errors occured during module setup');
        } else {
          fs.writeFileSync(
            path.join(process.cwd(), posModulesLockFilePath),
            JSON.stringify(lock, null, 2)
          );
          spinner.succeed(`Modules lock file generated: ${posModulesLockFilePath}`);
        }
      }
    } catch(e) {
      // throw e;
      logger.Debug(e);
      spinner.stopAndPersist();
      spinner.fail(e.message);
    }
  });

program.parse(process.argv);
