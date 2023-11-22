#!/usr/bin/env node

const program = require('commander');
const ora = require('ora');
const semver = require('semver');
const fs = require('fs');
const path = require('path');
const logger = require('../lib/logger');
const fetchAuthData = require('../lib/settings').fetchSettings;
const spinner = ora({ text: 'Setup', stream: process.stdout, spinner: 'bouncingBar' });
const files = require('../lib/files');
const { findModuleVersion, resolveDependencies } = require('../lib/modules/dependencies')
const Portal = require('../lib/portal');

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

const writePosModules = (modules) => {
  fs.writeFileSync(
    path.join(process.cwd(), posModulesFilePath),
    JSON.stringify({ modules: modules }, null, 2)
  );
}

const writePosModulesLock = (modules) => {
  fs.writeFileSync(
    path.join(process.cwd(), posModulesLockFilePath),
    JSON.stringify({ modules: modules }, null, 2)
  );
}

program
  .name('pos-cli modules setup')
  .arguments('[moduleNameWithVersion]', 'name of the module. Example: core. You can also pass version number: core@1.0.0')
  .action(async (moduleNameWithVersion) => {
    const spinner = ora({ text: "Modules install", stream: process.stdout, spinner: 'bouncingBar' }).start();

    try{
      let localModules = readLocalModules();
      if(moduleNameWithVersion){
        const [moduleName, moduleVersion] = moduleNameWithVersion.split('@');
        localModules = await addNewModule(moduleName, moduleVersion, localModules, Portal.moduleVersions);
        writePosModules(localModules);
        spinner.succeed(`Added module: ${moduleName}@${localModules[moduleName]}`);
      }

      if(!localModules) {
        spinner.stop();
      } else {
        spinner.start('Resolving module dependencies');
        const modulesLocked = await resolveDependencies(localModules, Portal.moduleVersions);
        writePosModulesLock(modulesLocked);
        spinner.succeed(`Modules lock file generated: ${posModulesLockFilePath}`);
      }
    } catch(e) {
      // throw e;
      logger.Debug(e);
      spinner.stopAndPersist();
      spinner.fail(e.message);
    }
  });

program.parse(process.argv);
