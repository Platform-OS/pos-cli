#!/usr/bin/env node

import { program } from 'commander';
import logger from '../lib/logger.js';
import { posConfigDirectory, posModulesLockFilePath, readLocalModules, writePosModules, writePosModulesLock } from '../lib/modules/configFiles.js';
import { findModuleVersion, resolveDependencies } from '../lib/modules/dependencies.js';
import Portal from '../lib/portal.js';
import path from 'path';
import { createDirectory } from '../lib/utils/create-directory.js';
import ora from 'ora';

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
      await createDirectory(path.join(process.cwd(), posConfigDirectory));

      const spinner = ora({ text: 'Updating module', stream: process.stdout });
      spinner.start();

      try{
        let localModules = readLocalModules();
        if(moduleNameWithVersion){
          const [moduleName, moduleVersion] = moduleNameWithVersion.split('@');
          localModules = await updateModule(moduleName, moduleVersion, localModules, Portal.moduleVersions);
          writePosModules(localModules);
          spinner.succeed(`Updated module: ${moduleName}@${localModules[moduleName]}`);
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
        logger.Error(e.message);
      }
    } catch {
      logger.Error(`Aborting - ${posConfigDirectory} directory has not been created.`);
    }
  });

program.parse(process.argv);
