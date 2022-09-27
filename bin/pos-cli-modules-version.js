#!/usr/bin/env node

const program = require('commander');

const semver = require('semver');

const logger = require('../lib/logger'),
  report = require('../lib/logger/report'),
  files = require('../lib/files'),
  settings = require('../lib/settings'),
  dir = require('../lib/directories');


function crateNewVersion(moduleName, version, options) {
  const modulePath = `${dir.MODULES}/${moduleName}`
  const infoPath = `${modulePath}/template-values.json`;
  let moduleInfo = settings.loadSettingsFileForModule(moduleName);

  // Read the version from the package file.
  if (options.package) {
    let packageJSONPath = `${modulePath}/package.json`;
    if (typeof options.package === 'string') {
      packageJSONPath = `${modulePath}/${options.package}`;
    }
    version = files.readJSON(packageJSONPath).version;
  }

  // Validate versions.
  if (!semver.valid(moduleInfo.version)) {
    report('[ERR] The current version is not valid');
    logger.Error(`The "${moduleName}" module's version ("${moduleInfo.version}") is not valid`);
    return
  }
  if (!semver.valid(version)) {
    report('[ERR] The given version is not valid');
    logger.Error(`The "${moduleName}" module's new version ("${version}") is not valid`);
    return
  }
    
  // Store the new version.
  moduleInfo.version = version
  files.writeJSON(infoPath, moduleInfo);
}

program
  .name('pos-cli modules init')
  .arguments('<name>', 'name of the module. Example: profile')
  .arguments('[version]', 'a valid semver version')
  .option('-p, --package [file]', 'use version from file as latest release, default: package.json')
  .action((name, version, options) => {
    crateNewVersion(name, version, options);
  });

program.parse(process.argv);
