const ora = require('ora');
const archive = require('../archive');
const push = require('../push');

const logger = require('../logger'),
  report = require('../logger/report');

const createArchive = async (env) => {
  const numberOfFiles = await archive.makeArchive(env, { withoutAssets: false });
  if (numberOfFiles == 0) throw 'Archive failed to create.';
};

const uploadArchive = async (env) => {
  const res = await push.push(env);
  if (!res) throw 'Server did not accept release file.';

  return res;
};

const strategy = async ({ env, authData, params }) => {
  try {
    process.env.FORCE_COLOR = true;
    const url = env.MARKETPLACE_URL;
    const msg = (url) => `Deploying to: ${url}`;

    await createArchive(env);

    const spinner = ora({ text: msg(url), stream: process.stdout, spinner: 'bouncingBar' }).start();
    const duration = await uploadArchive(env);

    spinner.succeed(`Deploy succeeded after ${duration}`);
    report('Deploy: Default Strategy', {
      extras: [
        { key: 'status', value: 'Success' },
        { key: 'url', value: url },
      ],
    });
  } catch (e) {
    logger.Error(`Deploy failed. ${e}`);
    report('Deploy: Default Strategy', {
      extras: [
        { key: 'status', value: 'Error' },
        { key: 'url', value: url },
      ],
    });
  }
};

module.exports = strategy;
