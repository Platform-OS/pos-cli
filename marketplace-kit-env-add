#!/usr/bin/env node

const program = require('commander'),
  fs = require('fs'),
  rl = require('readline'),
  request = require('request'),
  handleResponse = require('./lib/handleResponse'),
  version = require('./package.json').version;

const checkParams = params => {
  if (!params.args.length) {
    params.help();
    process.exit(1);
  }
  if (typeof params.email === 'undefined') {
    console.error('no email given!');
    process.exit(1);
  }
  if (typeof params.url === 'undefined') {
    console.error('no URL given!');
    process.exit(1);
  }

  if (params.url.slice(-1) != '/') {
    params.url = params.url + '/';
  }
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
  request(
    {
      uri: settings.url + 'api/marketplace_builder/sessions',
      method: 'POST',
      json: { email, password }
    },
    function(error, response, body) {
      handleResponse(error, response, body, body => {
        if (body.token) {
          storeEnvironment(Object.assign(settings, { token: body.token }));
        } else {
          console.log('Error: response from server invalid, token is missing');
          process.exit(1);
        }
      });
    }
  );
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
  .option('--email <email>', 'admin account email. Example: admin@example.com')
  .option('--url <url>', 'marketplace url. Example: https://example.com')
  .option('-c --config-file <config-file>', 'config file path', '.marketplace-kit')
  .action((environment, params) => {
    process.env.CONFIG_FILE_PATH = params.configFile;
    checkParams(params);
    getPassword().then(password => {
      const settings = { url: params.url, endpoint: environment, email: params.email };
      login(params.email, password, settings);
    });
  });

program.parse(process.argv);
if (!program.args.length) {
  program.help();
  process.exit(1);
}
