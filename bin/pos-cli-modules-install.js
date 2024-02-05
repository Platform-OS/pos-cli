#!/usr/bin/env node

const program = require('commander');
const ora = require('ora');
const semver = require('semver');
const logger = require('../lib/logger');
const fetchAuthData = require('../lib/settings').fetchSettings;
const spinner = ora({ text: 'Setup', stream: process.stdout, spinner: 'bouncingBar' });
const configFiles = require('../lib/modules/configFiles');
const { findModuleVersion, resolveDependencies } = require('../lib/modules/dependencies')
const Portal = require('../lib/portal');

const addNewModule = async (moduleName, moduleVersion, localModules, getVersions) => {
  const newModule = await findModuleVersion(moduleName, moduleVersion, getVersions);
  let modules;
  if(newModule){
    if (moduleVersion || !localModules[moduleName]) {
      modules = {...localModules, ...newModule};
    } else {
      modules = {...localModules };
    }
    return modules;
  } else {
    throw new Error(`Can't find module ${moduleName} with version ${moduleVersion}`);
  }
};

program
  .name('pos-cli modules install')
  .arguments('[moduleNameWithVersion]', 'name of the module. Example: core. You can also pass version number: core@1.0.0')
  .action(async (moduleNameWithVersion) => {
    const spinner = ora({ text: "Modules install", stream: process.stdout, spinner: 'bouncingBar' }).start();

    try{
      let localModules = configFiles.readLocalModules();
      if(moduleNameWithVersion){
        const [moduleName, moduleVersion] = moduleNameWithVersion.split('@');
        localModules = await addNewModule(moduleName, moduleVersion, localModules, Portal.moduleVersions);
        configFiles.writePosModules(localModules);
        spinner.succeed(`Added module: ${moduleName}@${localModules[moduleName]}`);
      }

      if(!localModules) {
        spinner.stop();
      } else {
        spinner.start('Resolving module dependencies');
        const modulesLocked = await resolveDependencies(localModules, Portal.moduleVersions);
        configFiles.writePosModulesLock(modulesLocked);
        spinner.succeed(`Modules lock file generated: ${configFiles.posModulesLockFilePath}`);
      }
    } catch(e) {
      // throw e;
      logger.Debug(e);
      spinner.stopAndPersist();
      spinner.fail(e.message);
    }
  });

program.parse(process.argv);
