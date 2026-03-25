#!/usr/bin/env node

import { program } from '../lib/program.js';
import logger from '../lib/logger.js';
import { posConfigDirectory, readLocalModules, readRepositoryUrl, writePosModules } from '../lib/modules/configFiles.js';
import { updateModule, updateAllModules, resolveAndDownload } from '../lib/modules/installModule.js';
import Portal from '../lib/portal.js';
import path from 'path';
import { createDirectory } from '../lib/utils/create-directory.js';
import ora from 'ora';

program
  .name('pos-cli modules update')
  .arguments('[module-name]', 'name of the module. Example: core. You can also pass version number: core@1.0.0. Omit to update all modules.')
  .action(async (moduleNameWithVersion) => {
    try {
      await createDirectory(path.join(process.cwd(), posConfigDirectory));

      const spinner = ora({ text: 'Updating module', stream: process.stdout });
      spinner.start();

      try{
        const repositoryUrl = readRepositoryUrl();
        const getVersions = (names) => Portal.moduleVersions(names, repositoryUrl);
        let localModules = readLocalModules();

        if (moduleNameWithVersion) {
          const [moduleName, moduleVersion] = moduleNameWithVersion.split('@');
          localModules = await updateModule(moduleName, moduleVersion, localModules, getVersions, repositoryUrl);
          writePosModules(localModules, repositoryUrl);
          spinner.succeed(`Updated module: ${moduleName}@${localModules[moduleName]}`);
        } else {
          if (Object.keys(localModules).length === 0) {
            spinner.warn('No modules to update');
            return;
          }
          localModules = await updateAllModules(localModules, getVersions, repositoryUrl);
          writePosModules(localModules, repositoryUrl);
          spinner.succeed('Updated all modules to latest versions');
        }

        await resolveAndDownload(spinner, localModules, repositoryUrl, getVersions);
      } catch(e) {
        logger.Debug(e);
        spinner.fail(e.message);
      }
    } catch {
      logger.Error(`Aborting - ${posConfigDirectory} directory has not been created.`);
    }
  });

program.parse(process.argv);
