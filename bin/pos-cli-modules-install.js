#!/usr/bin/env node

import { program } from 'commander';
import logger from '../lib/logger.js';
import { posConfigDirectory, posModulesFilePath, posModulesLockFilePath, readLocalModules, writePosModules, writePosModulesLock } from '../lib/modules/configFiles.js';
import { findModuleVersion, resolveDependencies } from '../lib/modules/dependencies.js';
import { downloadAllModules } from '../lib/modules/downloadModule.js';
import Portal from '../lib/portal.js';
import path from 'path';
import { createDirectory } from '../lib/utils/create-directory.js';
import ora from 'ora';

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
  .arguments('[module-name]', 'name of the module. Example: core. You can also pass version number: core@1.0.0')
  .action(async (moduleNameWithVersion) => {

    try {
      await createDirectory(path.join(process.cwd(), posConfigDirectory));

      const spinner = ora({ text: 'Modules install', stream: process.stdout });
      spinner.start();

      try {
        let localModules = readLocalModules();
        if(moduleNameWithVersion){
          const [moduleName, moduleVersion] = moduleNameWithVersion.split('@');
          localModules = await addNewModule(moduleName, moduleVersion, localModules, Portal.moduleVersions);
          writePosModules(localModules);
          spinner.succeed(`Added module: ${moduleName}@${localModules[moduleName]} to ${posModulesFilePath}`);
        }

        if(Object.keys(localModules).length === 0) {
          spinner.stop();
        } else {
          spinner.start('Resolving module dependencies');
          const modulesLocked = await resolveDependencies(localModules, Portal.moduleVersions);
          writePosModulesLock(modulesLocked);
          spinner.succeed(`Modules lock file updated: ${posModulesLockFilePath}`);

          spinner.start('Downloading modules');
          await downloadAllModules(modulesLocked);
          spinner.succeed('Modules downloaded successfully');
        }
      } catch(e) {
        logger.Debug(e);
        spinner.stopAndPersist();
        spinner.fail(e.message);
      }
    } catch {
      logger.Error(`Aborting - ${posConfigDirectory} directory has not been created.`);
    }
  });

program.parse(process.argv);
