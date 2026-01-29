#!/usr/bin/env node

import semver from 'semver';
import pkg from '../package.json' with { type: 'json' };
import logger from '../lib/logger.js';

const { engines } = pkg;
const version = engines.node;

if (!semver.satisfies(process.version, version)) {
  logger.Error(`Required node version ${version} not satisfied with current version ${process.version}.`);
}
