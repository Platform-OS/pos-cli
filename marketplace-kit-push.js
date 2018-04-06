#!/usr/bin/env node

const program = require('commander'),
  request = require('request'),
  fs = require('fs'),
  handleResponse = require('./lib/handleResponse'),
  logger = require('./lib/kit').logger,
  version = require('./package.json').version;

const fetchDeploymentStatus = (id, authData) => {
  return new Promise((resolve, reject) => {
    request(
      {
        uri: authData.url + 'api/marketplace_builder/marketplace_releases/' + id,
        method: 'GET',
        headers: { UserTemporaryToken: authData.token }
      },
      (error, response, body) => {
        if (error) {
          logger.Error(error);
          process.exit(1);
        } else {
          if (JSON.parse(body).status === 'ready_for_import') reject();
          else resolve(body);
        }
      }
    );
  });
};

const getDeploymentStatus = (id, authData) => {
  return new Promise((resolve, reject) => {
    (getStatus = () => {
      fetchDeploymentStatus(id, authData).then(
        status => {
          const jsonStatus = JSON.parse(status);
          if (jsonStatus.status === 'error') reject(jsonStatus.error);
          else resolve(status);
        },
        () => {
          logger.Print('.');
          setTimeout(getStatus, 1500);
        }
      );
    })();
  });
};

const pushFile = path => {
  request(
    {
      uri: program.url + 'api/marketplace_builder/marketplace_releases',
      method: 'POST',
      headers: { UserTemporaryToken: program.token },
      formData: {
        'marketplace_builder[zip_file]': fs.createReadStream(path),
        'marketplace_builder[force_mode]': (program.force || process.env.FORCE || '').toString()
      }
    },
    (error, response, body) => {
      handleResponse(error, response, body, body => {
        const responseBody = JSON.parse(body);
        getDeploymentStatus(responseBody.id, program).then(
          () => logger.Success('\nDONE'),
          error => {
            logger.Info('\n');
            logger.Error(error);
            process.exit(1);
          }
        );
      });
    }
  );
};

program
  .version(version)
  .option('--token <token>', 'authentication token', process.env.MARKETPLACE_TOKEN)
  .option('--url <url>', 'marketplace url', process.env.MARKETPLACE_URL)
  .option('-f --force', 'force update', process.env.FORCE); // not using force argument from parent process env

program.parse(process.argv);

if (typeof program.token === 'undefined') {
  logger.Error('no TOKEN given!');
  process.exit(1);
}
if (typeof program.url === 'undefined') {
  logger.Error('no URL given!');
  process.exit(1);
}

logger.Info(`Deploying to: ${program.url}`);

pushFile('./tmp/marketplace-release.zip');
