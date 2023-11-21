#!/usr/bin/env node

<<<<<<< HEAD
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
      logger.Log('');
      resolve(password);
    });

    reader._writeToOutput = stringToWrite => {
      (reader.stdoutMuted && reader.output.write('*')) || reader.output.write(stringToWrite);
    };
  });
};

const storeEnvironment = settings => {
  logger.Debug(`[storeEnvironment] ${JSON.stringify(settings, null, 2)}`);

  const environmentSettings = {
    [settings.endpoint]: {
      url: settings.url,
      token: settings.token,
      email: settings.email
    }
  };

  const configPath = files.getConfigPath();
  logger.Debug(`[storeEnvironment] Current config path: ${configPath}`);

  const newSettings = Object.assign({}, files.getConfig(), environmentSettings);
  fs.writeFileSync(configPath, JSON.stringify(newSettings, null, 2));
};

const checkParams = (environment, params) => {
  validate.email(params.email);
  validate.url(params.url);
};

program.showHelpAfterError();
=======
const program = require('commander');
const logger = require('../lib/logger');
const validate = require('../lib/validators');
const Portal = require('../lib/portal');
const waitForStatus = require('../lib/data/waitForStatus');
const { readPassword } = require('../lib/utils/password');
const { storeEnvironment, deviceAuthorizationFlow } = require('../lib/environments');

const saveToken = (settings, token) => {
  storeEnvironment(Object.assign(settings, { token: token }));
  logger.Success(`Environment ${settings.url} as ${settings.environment} has been added successfuly.`);
};

const help = () => {
  program.outputHelp();
  process.exit(1);
}

const checkParams = params => {
  // validate.existence({ argumentValue: params.email, argumentName: 'email', fail: help });
  if (params.email) validate.email(params.email);

  validate.existence({ argumentValue: program.args[0], argumentName: 'environment', fail: help });

  validate.existence({ argumentValue: params.url, argumentName: 'URL', fail: help });
  if (params.url.slice(-1) != '/') {
    params.url = params.url + '/';
  }
  validate.url(params.url);
};


const login = async (email, password, url) => {
  return Portal.login(email, password, url)
    .then(response => {
      if (response) return Promise.resolve(response[0].token);
    })
}

>>>>>>> master
program
  .name('pos-cli env add')
  .argument('<environment>', 'name of environment. Example: staging')
  .requiredOption('--email <email>', 'Partner Portal account email. Example: admin@example.com')
  .requiredOption('--url <url>', 'marketplace url. Example: https://example.com')
  .option(
    '--token <token>',
    'if you have a token you can add it directly to pos-cli configuration without connecting to portal'
  )
<<<<<<< HEAD
  .action((environment, params) => {
    checkParams(environment, params);
    const settings = { url: params.url, endpoint: environment, email: params.email };

    if (params.token) {
      storeEnvironment(Object.assign(settings, { token: params.token }));
      logger.Success(`Environment ${params.url} as ${environment} has been added successfuly.`);
      process.exit(0);
    }

    logger.Info(
      `Please make sure that you have a permission to deploy. \nYou can verify it here: ${Portal.HOST}/me/permissions`,
      { hideTimestamp: true }
    );

    getPassword().then(password => {
=======
  .action(async (environment, params) => {
    checkParams(params);
    const settings = { url: params.url, environment: environment, email: params.email };

    if (params.token) {
      token = params.token;
    } else if (!params.email){
      token = await deviceAuthorizationFlow(params.url);
    } else {
      logger.Info(
        `Please make sure that you have a permission to deploy. \n You can verify it here: ${Portal.HOST}/me/permissions`,
        { hideTimestamp: true }
      );

      const password = await readPassword();
>>>>>>> master
      logger.Info(`Asking ${Portal.HOST} for access token...`);

      token = await login(params.email, password, params.url);
    }

<<<<<<< HEAD
          if (token) {
            storeEnvironment(Object.assign(settings, { token }));
            logger.Success(`Environment ${params.url} as ${environment} has been added successfuly.`);
          }
        })
        // .catch(e) { //wont fire, there is a default error handler
    });
=======
    if (token) saveToken(settings, token);
>>>>>>> master
  });

program.parse(process.argv);
