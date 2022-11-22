#!/usr/bin/env node

const program = require('commander'),
  degit = require('degit'),
  ora = require('ora'),
  validate = require('../lib/validators'),
  files = require('../lib/files'),
  Portal = require('../lib/portal'),
  rl = require('readline'),
  { performance } = require('perf_hooks');

const logger = require('../lib/logger'),
  report = require('../lib/logger/report'),
  duration = require('../lib/duration'),
  dir = require('../lib/directories'),
  modules = require('../lib/modules');

function publishVersion(token) {
  const t0 = performance.now();
  const spinner = ora({ text: 'Uploading', stream: process.stdout, spinner: 'bouncingBar' }).start();

  modules.publishVersion(token);
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

    reader._writeToOutput = stringToWrite => {
      (reader.stdoutMuted && reader.output.write('*')) || reader.output.write(stringToWrite);
    };
  });
};

const getToken = async (email, password) => {
  try {
    const token = await Portal.jwt_token(email, password)
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
  .action(async (params) => {
    // checkParams(params);
    // const password = await getPassword();
    // logger.Info(`Asking ${Portal.HOST} for access token...`);
    // const token = await getToken(params.email, password);
    const token = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoxNzgsImV4cCI6MTY2ODg2MzU4N30.qjIzVUPxnoBiWZtD6DcXS7tfxrSNvdGh24MkG5HX9CI';
    console.log(token);
    publishVersion(token);
  });

program.parse(process.argv);
