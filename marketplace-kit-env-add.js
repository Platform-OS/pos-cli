#!/usr/bin/env node

const program = require('commander'),
  fs = require('fs'),
  rl = require('readline'),
  request = require('request'),
  Gateway = require('./lib/proxy'),
  logger = require('./lib/kit').logger,
  validate = require('./lib/validators'),
  version = require('./package.json').version,
  Portal = require('./lib/portal');

const checkParams = params => {
  validate.existence({ argumentValue: params.email, argumentName: 'email', fail: program.help.bind(program) });
  validate.existence({ argumentValue: params.url, argumentName: 'URL', fail: program.help.bind(program) });
  validate.email(params.email);

  if (params.url.slice(-1) != '/') {
    params.url = params.url + '/';
  }

  validate.url(params.url);
};

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

const storeEnvironment = settings => {
  const environmentSettings = {
    [settings.endpoint]: {
      url: settings.url,
      token: settings.token,
      email: settings.email
    }
  };
  saveFile(Object.assign(existingSettings(), environmentSettings));
};

const saveFile = settings => {
  fs.writeFileSync(process.env.CONFIG_FILE_PATH, JSON.stringify(settings, null, 2), err => {
    if (err) throw err;
  });
};

const existingSettings = () => {
  if (fs.existsSync(process.env.CONFIG_FILE_PATH)) {
    return JSON.parse(fs.readFileSync(process.env.CONFIG_FILE_PATH));
  } else {
    return {};
  }
};

PARTNER_PORTAL_HOST = process.env.PARTNER_PORTAL_HOST || 'https://portal.apps.near-me.com';

program
  .version(version)
  .arguments('<environment>', 'name of environment. Example: staging')
  .option('--email <email>', 'Partner Portal account email. Example: admin@example.com')
  .option('--url <url>', 'marketplace url. Example: https://example.com')
  .option('--token <token>', 'if you have a token you can add it directly to mpkit configution without connecting to portal')
  .option('-c --config-file <config-file>', 'config file path', '.marketplace-kit')
  .action((environment, params) => {
    process.env.CONFIG_FILE_PATH = params.configFile;
    checkParams(params);
    const settings = { url: params.url, endpoint: environment, email: params.email };
    if (params.token) {
      storeEnvironment(Object.assign(settings, { token: params.token }));
      logger.Success(`Environment ${params.url} as ${environment} has been added successfuly.`);
      process.exit(0);
    }

    logger.Info(
      `Please make sure that you have a permission to deploy. You can verify it here: ${PARTNER_PORTAL_HOST}/me/permissions`,
      { hideTimestamp: true }
    );

    getPassword().then(password => {

      logger.Info(`Asking ${PARTNER_PORTAL_HOST} for access token...`);
      Portal.login(params.email, password).then(
        tokens => {
          if (tokens[0].token) {
            storeEnvironment(Object.assign(settings, { token: tokens[0].token }));
            logger.Success(`Environment ${params.url} as ${environment} has been added successfuly.`);
          }
          else
            logger.Error({error: "Response from server invalid, token is missing"})
        }, error => {
          logger.Error(error);
          process.exit(1);
        }
      );
    });
  });

program.parse(process.argv);

validate.existence({ argumentValue: program.args[0], argumentName: 'environment', fail: program.help.bind(program) });
