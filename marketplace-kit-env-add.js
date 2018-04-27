#!/usr/bin/env node

const program = require('commander'),
  fs = require('fs'),
  rl = require('readline'),
  request = require('request'),
  handleResponse = require('./lib/handleResponse'),
  logger = require('./lib/kit').logger,
  validate = require('./lib/validators'),
  version = require('./package.json').version;

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
      resolve(password);
    });

    reader._writeToOutput = stringToWrite => {
      (reader.stdoutMuted && reader.output.write('*')) || reader.output.write(stringToWrite);
    };
  });
};

const login = (email, password, settings) => {
  const uri = partnerPortalHost() + '/api/user_tokens';
  logger.Info(`Asking ${partnerPortalHost()} for access token...`);
  request(
    {
      uri: uri,
      headers: { UserAuthorization: `${email}:${password}` },
      method: 'GET'
    },
    function(error, response, body) {
      handleResponse(error, response, body, body => {
        body = JSON.parse(body);
        const token = body[0].token;
        if (token) {
          storeEnvironment(Object.assign(settings, { token: token }));
        } else {
          logger.Error('Error: response from server invalid, token is missing');
          process.exit(1);
        }
      });
    }
  );
};

const partnerPortalHost = () => process.env.PARTNER_PORTAL_HOST || 'https://portal.apps.near-me.com';

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
  fs.writeFileSync(process.env.CONFIG_FILE_PATH, JSON.stringify(settings), err => {
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

program
  .version(version)
  .arguments('<environment>', 'name of environment. Example: staging')
  .option('--email <email>', 'Partner Portal account email. Example: admin@example.com')
  .option('--url <url>', 'marketplace url. Example: https://example.com')
  .option('-c --config-file <config-file>', 'config file path', '.marketplace-kit')
  .action((environment, params) => {
    process.env.CONFIG_FILE_PATH = params.configFile;
    checkParams(params);
    logger.Info(
      `Please make sure that you have a permission to deploy. You can verify it here: ${partnerPortalHost()}/me/permissions`,
      { hideTimestamp: true }
    );
    getPassword().then(password => {
      const settings = { url: params.url, endpoint: environment, email: params.email };
      login(params.email, password, settings);
    });
  });

program.parse(process.argv);

validate.existence({ argumentValue: program.environment, argumentName: 'environment', fail: program.help.bind(program) });
