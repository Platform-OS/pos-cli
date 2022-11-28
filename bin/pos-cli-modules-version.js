#!/usr/bin/env node

const program = require('commander');
const semver = require('semver');

const dir = require('../lib/directories');
const files = require('../lib/files');
const logger = require('../lib/logger');
const report = require('../lib/logger/report');
const settings = require('../lib/settings');

const configPath = `template-values.json`;
const moduleConfig = () => {
  return files.readJSON(configPath, { throwDoesNotExistError: true });
};

const readVersionFromPackage = (options, version) => {
  let packageJSONPath = `package.json`;
  if (typeof options.package === 'string') {
    packageJSONPath = `${options.package}`;
  }
  return files.readJSON(packageJSONPath, { throwDoesNotExistError: true }).version;
};

const storeNewVersion = (config, version) => {
  config.version = version;
  files.writeJSON(configPath, config);
};

const validateVersions = (config, version) => {
  // Validate versions.
  if (!semver.valid(config.version)) {
    report('[ERR] The current version is not valid');
    logger.Error(`The "${moduleName}" module's version ("${config.version}") is not valid`);
    return
  }
  if (!semver.valid(version)) {
    report('[ERR] The given version is not valid');
    logger.Error(`The "${moduleName}" module's new version ("${version}") is not valid`);
    return
  }

  return true;
};

function crateNewVersion(version, options) {
  let config = moduleConfig();
  const moduleName = config['machine_name'];

  if (options.package) version = readVersionFromPackage(options);
  if (!validateVersions(config, version)) return;

  storeNewVersion(config, version);
}

program
  .name('pos-cli modules version')
  .arguments('[version]', 'a valid semver version')
  .option('-p, --package [file]', 'use version from file as latest release, default: package.json')
  .option('--path <path>', 'module root directory, default is current directory')
  .action((version, options) => {
    if (options.path) process.chdir(options.path);
    crateNewVersion(version, options);
  });

program.parse(process.argv);