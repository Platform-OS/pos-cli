#!/usr/bin/env node

import { program } from '../lib/program.js';
import logger from '../lib/logger.js';
import { posConfigDirectory, posModulesFilePath, readLocalModules, readRepositoryUrl, writePosModules } from '../lib/modules/configFiles.js';
import { addNewModule, resolveAndDownload } from '../lib/modules/installModule.js';
import Portal from '../lib/portal.js';
import path from 'path';
import { createDirectory } from '../lib/utils/create-directory.js';
import ora from 'ora';

program
  .name('pos-cli modules install')
  .arguments('[module-name]', 'name of the module. Example: core. You can also pass version number: core@1.0.0')
  .action(async (moduleNameWithVersion) => {

    try {
      await createDirectory(path.join(process.cwd(), posConfigDirectory));

      const spinner = ora({ text: 'Modules install', stream: process.stdout });
      spinner.start();

      try {
        const repositoryUrl = readRepositoryUrl();
        const getVersions = (names) => Portal.moduleVersions(names, repositoryUrl);
        let localModules = readLocalModules();
        if(moduleNameWithVersion){
          const [moduleName, moduleVersion] = moduleNameWithVersion.split('@');
          const updated = await addNewModule(moduleName, moduleVersion, localModules, getVersions, repositoryUrl);
          if (updated) {
            localModules = updated;
            writePosModules(localModules, repositoryUrl);
            spinner.succeed(`Added module: ${moduleName}@${localModules[moduleName]} to ${posModulesFilePath}`);
          }
        }

        if(Object.keys(localModules).length === 0) {
          spinner.stop();
        } else {
          await resolveAndDownload(spinner, localModules, repositoryUrl, getVersions);
        }
      } catch(e) {
        logger.Debug(e);
        spinner.fail(e.message);
      }
    } catch {
      logger.Error(`Aborting - ${posConfigDirectory} directory has not been created.`);
    }
  });

program.parse(process.argv);
