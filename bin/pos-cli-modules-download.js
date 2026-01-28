#!/usr/bin/env node

import shell from 'shelljs';
import { program } from 'commander';
import logger from '../lib/logger.js';
import downloadFile from '../lib/downloadFile.js';
import { unzip } from '../lib/unzip.js';
import Portal from '../lib/portal.js';
import fs from 'fs';
import path from 'path';

const downloadModule = async (module, lockData) => {
  const filename = 'modules.zip';
  try {
    if (!module.includes('@') && lockData) {
      if (lockData[module] === undefined ) {
        logger.Warn(`Warning: Can't find ${module} in app/pos-modules.lock.json, will download the latest version`);
      }
      const moduleVersion = lockData[module];
      if (moduleVersion) {
        module = `${module}@${moduleVersion}`;
      }
    }

    logger.Info(`Searching for ${module}...`);
    const moduleVersion = await Portal.moduleVersionsSearch(module);
    const modulePath = `${process.cwd()}/modules/${module.split('@')[0]}`;
    logger.Info(`Downloading ${module}...`);
    await downloadFile(moduleVersion['public_archive'], filename);
    logger.Info(`Cleaning ${modulePath}...`);
    await fs.promises.rm(modulePath, { recursive: true, force: true });
    logger.Info(`Unzipping ${module}...`);
    await unzip(filename, `${process.cwd()}/modules`);
    shell.rm(filename);
  } catch (error) {
    if (error.statusCode === 404) {
      throw `${module}: 404 not found`;
    } else {
      throw `${module}: ${error.message}`;
    }
  }
};

program
  .name('pos-cli modules download')
  .arguments('<module>', 'module name, ex. core, core@1.0.0')
  .option('--force-dependencies', 'Force downloading dependencies, even if they are already present')
  .action(async (module, params) => {
    const lockFilePath = path.join('app', 'pos-modules.lock.json');
    const forceDependencies = params.forceDependencies;

    let lockData;

    if (fs.existsSync(lockFilePath)) {
      lockData = JSON.parse(fs.readFileSync(lockFilePath, 'utf-8'))['modules'];
    } else {
      logger.Warn('Warning: Can\'t find app/pos-modules.lock.json');
    }

    try {
      await downloadModule(module, lockData);
      logger.Info('Resolving dependencies...');
      const templateValuesPath = path.join('modules', module.split('@')[0], 'template-values.json');
      if (fs.existsSync(templateValuesPath)) {
        const templateValuesContent = fs.readFileSync(templateValuesPath, 'utf-8');
        const templateValues = JSON.parse(templateValuesContent);
        const dependencies = templateValues.dependencies || {};

        for (const depName of Object.keys(dependencies)) {
          if (forceDependencies || !fs.existsSync(`modules/${depName}`)) {
            await downloadModule(depName, lockData);
          }
        }
      } else {
        logger.Warn(`Warning: No template-values.json file for module ${module} - skipping dependencies`);
      }
      logger.Success(`Completed downloading ${module}`);
    } catch (error) {
      logger.Error(error);
    }
  });

program.parse(process.argv);
