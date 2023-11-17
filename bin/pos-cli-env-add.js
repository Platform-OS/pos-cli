#!/usr/bin/env node

const program = require('commander'),
  fs = require('fs'),
  rl = require('readline'),
  logger = require('../lib/logger'),
  validate = require('../lib/validators'),
  files = require('../lib/files'),
  Portal = require('../lib/portal');
const waitForStatus = require('../lib/data/waitForStatus');
const open = require('open');

// TODO: extract to module
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

// TODO: extract to module
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

// TODO: extract to module
const waitForAccessToken = async (deviceCode, interval) => {
  const tokenResponse = await waitForStatus(
    () => {
      return Portal.fetchDeviceAccessToken(deviceCode).then(response => {
        let token;
        if (response['access_token']) {
          token = { ...response, status: 'success' };
        } else {
          // TODO: use node-fetch instead of request-promise
          const responseBody = response.response.body;
          switch(response.response.statusCode){
            case 400:
              token = { status: responseBody.error };
              break;
            case 200:
              token = { ...responseBody, status: 'success' };
              break;
            default:
              throw `Unhandled response: ${response.statusCode}`
          }
        }

        return Promise.resolve(token);
      })
    }, 'authorization_pending', 'success', interval
  );

  return tokenResponse['access_token'];
};

// TODO: extract to module
const deviceAuthorizationFlow = async (instanceUrl) => {
  const instanceDomain = (new URL(instanceUrl)).hostname;
  const deviceAuthorizationResponse = await Portal.requestDeviceAuthorization(instanceDomain);
  logger.Debug('deviceAuthorizationResponse', deviceAuthorizationResponse);

  const deviceAuthorization = JSON.parse(deviceAuthorizationResponse);
  const verificationUrl = deviceAuthorization['verification_uri_complete'];
  const deviceCode = deviceAuthorization['device_code']
  const interval = (deviceAuthorization['interval'] || 5) * 1000;

  await open(verificationUrl);

  const accessToken = await waitForAccessToken(deviceCode, interval);
  return accessToken;
};

const login = async (email, password, url) => {
  return Portal.login(email, password, url)
    .then(response => {
      if (response) Promise.resolve(response[0].token);
    })
}

program
  .name('pos-cli env add')
  .arguments('[environment]', 'name of environment. Example: staging')
  .option('--email <email>', 'Partner Portal account email. Example: admin@example.com')
  .option('--url <url>', 'marketplace url. Example: https://example.com')
  .option(
    '--token <token>',
    'if you have a token you can add it directly to pos-cli configuration without connecting to portal'
  )
  .action(async (environment, params) => {
    checkParams(params);
    const settings = { url: params.url, endpoint: environment, email: params.email };

    if (params.token) {
      token = params.token;
    } else if (!params.email){
      token = await deviceAuthorizationFlow(params.url);
    } else {
      logger.Info(
        `Please make sure that you have a permission to deploy. \n You can verify it here: ${Portal.HOST}/me/permissions`,
        { hideTimestamp: true }
      );

      const password = await getPassword();
      logger.Info(`Asking ${Portal.HOST} for access token...`);

      token = await login(params.email, password, params.url);
    }

    if (token) saveToken(settings, token);
  });

program.parse(process.argv);
