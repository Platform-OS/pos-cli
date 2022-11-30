#!/usr/bin/env node

const degit = require('degit');
const ora = require('ora');
const program = require('commander');
const rl = require('readline');
const { performance } = require('perf_hooks');

const dir = require('../lib/directories');
const duration = require('../lib/duration');
const files = require('../lib/files');
const logger = require('../lib/logger');
const modules = require('../lib/modules');
const portal = require('../lib/portal');
const report = require('../lib/logger/report');
const validate = require('../lib/validators');

const publishVersion = async (token) => {
  const t0 = performance.now();
  const spinner = ora({ text: 'Uploading', stream: process.stdout, spinner: 'bouncingBar' }).start();

  await modules.publishVersion(token);
  spinner.succeed(`Upload succeeded after ${duration(t0, performance.now())}`);
}

const getPassword = () => {
  return new Promise((resolve, reject) => {
    const reader = rl.createInterface({ input: process.stdin, output: process.stdout });
    reader.stdoutMuted = true;
    reader.question('Password: ', password => {
      reader.close();
      logger.Info('');
      resolve(password);
    });

    reader._writeToOutput = stringToWrite => (reader.stdoutMuted && reader.output.write('*')) || reader.output.write(stringToWrite);
  });
};

const getToken = async (email, password) => {
  try {
    const token = await portal.jwt_token(email, password)
    return token.auth_token;
  } catch (e) {
    if (e.statusCode === 401) {
      logger.Error('Either email or password is incorrect.');
    } else {
      logger.Error(e.message);
    }
    process.exit(1);
  }
};

const help = () => {
  program.outputHelp();
  process.exit(1);
}

const checkParams = params => {
  validate.existence({ argumentValue: params.email, argumentName: 'email', fail: help });
  validate.email(params.email);
};

program
  .name('pos-cli modules push')
  .option('--email <email>', 'Partner Portal account email. Example: foo@example.com')
  .option('--path <path>', 'module root directory, default is current directory')
  .action(async (params) => {
    if (params.path) process.chdir(params.path);
    checkParams(params);
    const password = await getPassword();
    logger.Info(`Asking ${portal.HOST} for access token...`);
    const token = await getToken(params.email, password);
    publishVersion(token);
  });

program.parse(process.argv);
