#!/usr/bin/env node

const semver = require('semver');
const engines = require('../package.json').engines;
const logger = require('./logger');
const version = engines.node;

if (!semver.satisfies(process.version, version)) {
  logger.Error(`Required node version ${version} not satisfied with current version ${process.version}.`);
}
