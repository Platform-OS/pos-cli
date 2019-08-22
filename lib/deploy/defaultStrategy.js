const logger = require('../logger');
const archive = require('../archive');
const push = require('../push');

const createArchive = async(env) => {
  const res = await archive.makeArchive(env, { withoutAssets: false });
  if (!res) throw 'Archive failed to create.';
};

const uploadArchive = async(env) => {
  const res = await push.push(env);
  if (!res) throw 'Server did not accept release file.';
};

const strategy = async ({env, authData, params}) => {
  try{
    process.env.FORCE_COLOR = true;
    await createArchive(env);
    await uploadArchive(env);
  } catch(e) {
    logger.Error(`Deploy failed. ${e}`);
  };
};

module.exports = strategy;
