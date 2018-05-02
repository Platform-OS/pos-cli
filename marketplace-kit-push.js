#!/usr/bin/env node

const program = require('commander'),
  validate = require('./lib/validators'),
  Gateway = require('./lib/proxy'),
  fs = require('fs'),
  logger = require('./lib/kit').logger,
  version = require('./package.json').version;


const getDeploymentStatus = (id) => {
  return new Promise((resolve, reject) => {
    (getStatus = () => {
      gateway.getStatus(id).then(
        response => {
          if (response.status === 'ready_for_import') {
            logger.Print('.');
            setTimeout(getStatus, 1500);
          } else if (response.status === 'error')
            reject(response);
          else
            resolve(response);
        },
        error => reject(error)
      );
    })();
  });
};

const checkParams = params => {
  validate.existence({ argumentValue: params.token, argumentName: 'token', fail: program.help.bind(program) });
  validate.existence({ argumentValue: params.url, argumentName: 'url', fail: program.help.bind(program) });
};

program
  .version(version)
  .option('--email <email>', 'developer email', process.env.MARKETPLACE_EMAIL)
  .option('--token <token>', 'authentication token', process.env.MARKETPLACE_TOKEN)
  .option('--url <url>', 'marketplace url', process.env.MARKETPLACE_URL);

program.parse(process.argv);

checkParams(program);

logger.Info(`Deploying to: ${program.url}`);

const gateway = new Gateway(program);

const formData = {
  'marketplace_builder[force_mode]': process.env.FORCE || 'false',
  'marketplace_builder[zip_file]': fs.createReadStream('./tmp/marketplace-release.zip')
};

logger.Debug('FormData:');
logger.Debug(formData);

gateway
  .push(formData)
  .then(
    body => {
      const responseBody = JSON.parse(body);

      getDeploymentStatus(responseBody.id).then(
        response => {
          logger.Print('\n');
          logger.Success('DONE')
        },
        error =>{
          logger.Print('\n');
          logger.Error(error.error);
        }
      )
    },
    error => {
      logger.Info('\n');
      logger.Error(error);
      process.exit(1);
    }
  );
