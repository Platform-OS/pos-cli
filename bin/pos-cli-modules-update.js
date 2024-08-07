#!/usr/bin/env node

const { program } = require('commander');
const logger = require('../lib/logger');
const configFiles = require('../lib/modules/configFiles');
const { findModuleVersion, resolveDependencies } = require('../lib/modules/dependencies')
const Portal = require('../lib/portal');
const path = require('path');
const { createDirectory } = require('../lib/utils/create-directory');

// importing ESM modules in CommonJS project
let ora;
const initializeEsmModules = async () => {
  if(!ora) {
    await import('ora').then(imported => ora = imported.default);
  }

  return true;
}

const updateModule = async (moduleName, moduleVersion, localModules, getVersions) => {
  const newModule = await findModuleVersion(moduleName, moduleVersion, getVersions);
  if(newModule){
    const modules = {...localModules, ...newModule};
    return modules;
  } else {
    throw new Error(`Can't find module ${moduleName} with version ${moduleVersion}`);
  }
};


program
  .name('pos-cli modules update')
  .arguments('<module-name>', 'name of the module. Example: core. You can also pass version number: core@1.0.0')
  .action(async (moduleNameWithVersion) => {
    try {
      await createDirectory(path.join(process.cwd(), configFiles.posConfigDirectory));

      await initializeEsmModules();
      const spinner = ora({ text: 'Updating module', stream: process.stdout });
      spinner.start();

      try{
        let localModules = configFiles.readLocalModules();
        if(moduleNameWithVersion){
          const [moduleName, moduleVersion] = moduleNameWithVersion.split('@');
          localModules = await updateModule(moduleName, moduleVersion, localModules, Portal.moduleVersions);
          configFiles.writePosModules(localModules);
          spinner.succeed(`Updated module: ${moduleName}@${localModules[moduleName]}`);
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
        logger.Error(e.message);
      }
    }
    catch(error) {
      logger.Error(`Aborting - ${configFiles.posConfigDirectory} directory has not been created.`)
    }
  });

program.parse(process.argv);
