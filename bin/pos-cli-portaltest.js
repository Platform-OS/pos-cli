#!/usr/bin/env node

const program = require('commander'),
  fs = require('fs'),
  rl = require('readline'),
  logger = require('../lib/logger'),
  validate = require('../lib/validators'),
  files = require('../lib/files'),
  Portal = require('../lib/portal');

// turn to promise
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

const help = () => {
  program.outputHelp();
  process.exit(1);
}

const checkParams = params => {
  validate.existence({ argumentValue: params.email, argumentName: 'email', fail: help });
  validate.email(params.email);
};

program
  .name('pos-cli env add')
  .arguments('[environment]', 'name of environment. Example: staging')
  .option('--email <email>', 'Partner Portal account email. Example: admin@example.com')
  .action((environment, params) => {
    checkParams(params);
    const settings = { email: params.email };

    getPassword().then(password => {
      logger.Info(`Asking ${Portal.HOST} for access token...`);

      Portal.jwt_token(params.email, password)
        .then(response => {
          const token = response;
          console.log(token);
          if (token) {
            logger.Success(`Environment ${params.url} as ${environment} has been added successfuly.`);
          }
        })
        .catch(e => {
          if (e.statusCode === 401) {
            logger.Error('Either email or password is incorrect.');
          } else {
            logger.Error(e.message);
          }
        });
    });
  });

program.parse(process.argv);
