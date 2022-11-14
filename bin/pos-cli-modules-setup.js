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
const settings = require('../lib/settings');
const dir = require('../lib/directories');

const modulesPath = path.join(process.cwd(), dir.MODULES);

program
  .name('pos-cli modules setup')
  .arguments('[environment]', 'name of the environment. Example: staging')
  .action(async (environment) => {
    const authData = fetchAuthData(environment, program);
    const gateway = new Gateway(authData);
    const progress = {};
    const dependencies = {};
    const errors = [];
    const lock = {
      modules: {}
    };
    const localModules = fs.readdirSync(modulesPath, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .filter(d => fs.existsSync(path.join(modulesPath, d, 'template-values.json')))
      .map(name => ({
        name,
        deps: {}
      }));

    localModules.map(localModule => {
      progress[localModule.name] = spinner.start(localModule.name);
      const moduleSettings = settings.loadSettingsFileForModule(localModule.name);
      if (moduleSettings.version && moduleSettings.dependencies) {
        localModule.version = moduleSettings.version;
        localModule.deps = moduleSettings.dependencies;

        dependencies[localModule.name] = dependencies[localModule.name] || [];
        dependencies[localModule.name].push(localModule.version);
        for (dep of Object.keys(moduleSettings.dependencies)) {
          dependencies[dep] = dependencies[dep] || [];
          dependencies[dep].push(moduleSettings.dependencies[dep]);
        }
      }
    });

    // query module info
    progress.__moduleInfo = spinner.start('Loading module version info');
    let moduleVersions;
    try {
      moduleVersions = await gateway.getModuleVersions(Object.keys(dependencies));
      progress.__moduleInfo.succeed();
    } catch (e) {
      progress.__moduleInfo.fail();
      logger.Error('An error occured during module version request');
    }

    logger.Info('Resolving module dependencies', { hideTimestamp: true })
    // find fixed version for semver ranges
    Object.keys(dependencies).forEach(dep => {
      progress[dep] = spinner.start(dep);
      const maxSatisfying = [];
      const availableVersions = moduleVersions.find(m => m.module === dep)?.versions;
      if (availableVersions) {
        const availableVersionsList = Object.keys(availableVersions);
        for (d of dependencies[dep]) {
          const foundMaxVersion = semver.maxSatisfying(availableVersionsList, d);
          if (!foundMaxVersion) {
            progress[dep].fail();
            errors.push(`No available version of "${dep}" for range "${d}"`);
            continue;
          }
          maxSatisfying.push(foundMaxVersion);
        }
        lock.modules[dep] = maxSatisfying.sort(semver.compare)[0];
        lock.modules[dep] && progress[dep].succeed(`${dep} v${lock.modules[dep]}`);
      } else {
        progress[dep].fail(dep);
        errors.push(`No available versions of "${dep}"`);
      }
    });

    if (errors.length) {
      errors.map(e => logger.Warn(e, { hideTimestamp: true }));
      logger.Error('Some errors occured during module setup');
    } else {
      fs.writeFileSync(path.join(process.cwd(), 'pos-modules.lock.json'), JSON.stringify(lock, null, 2));
      logger.Info('Modules lock file created');
    }
  });

program.parse(process.argv);
