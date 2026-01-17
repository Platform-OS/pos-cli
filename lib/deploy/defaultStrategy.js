import { makeArchive } from '../archive.js';
import { push } from '../push.js';

import logger from '../logger.js';
import report from '../logger/report.js';

let ora;
const initializeEsmModules = async () => {
  if(!ora) {
    await import('ora').then(imported => ora = imported.default);
  }

  return true;
}

const createArchive = async (env) => {
  const numberOfFiles = await makeArchive(env, { withoutAssets: false });
  if (numberOfFiles == 0) throw 'Archive failed to create.';
};

const uploadArchive = async (env) => {
  const res = await push(env);
  if (!res) throw 'Server did not accept release file.';

  return res;
};

const strategy = async ({ env, authData, params }) => {
  try {
    process.env.FORCE_COLOR = true;
    const url = env.MARKETPLACE_URL;
    const msg = (url) => `Deploying to: ${url}`;

    await createArchive(env);

    await initializeEsmModules();
    const spinner = ora({ text: msg(url), stream: process.stdout });
    spinner.start();

    const duration = await uploadArchive(env);

    spinner.succeed(`Deploy succeeded after ${duration}`);
    report('[OK] Deploy: Default Strategy');
  } catch (e) {
    logger.Error(`Deploy failed. ${e}`);
    report('[ERR] Deploy: Default Strategy');
  }
};

export default strategy;
