const rl = require('readline');

const files = require('./files');
const logger = require('./logger');
const portal = require('./portal');
const prepareArchive = require('./prepareArchive');
const presignUrl = require('./presignUrl').presignUrlForPortal;
const uploadFile = require('./s3UploadFile').uploadFile;
const waitForStatus = require('./data/waitForStatus');

const ServerError = require('../lib/ServerError');

let moduleId;
const archiveFileName = 'release.zip';
const archivePath = `./tmp/${archiveFileName}`;

const moduleConfig = () => {
  return files.readJSON('template-values.json', { throwDoesNotExistError: true, exit: true });
};

const createArchive = async (moduleName) => {
  return new Promise(async (resolve, reject) => {
    const releaseArchive = prepareArchive(archivePath, resolve, true);
    releaseArchive.glob(['{private,public}/**', 'template-values.json'], {}, { prefix: moduleName });
    await releaseArchive.finalize();
  });
};

const uploadArchive = async (token) => {
  const data = await presignUrl(token, moduleId, archiveFileName);
  logger.Debug(data);
  await uploadFile(archivePath, data.uploadUrl);
  logger.Info('Release Uploaded');
  return data.accessUrl;
};

const createVersion = async (token, accessUrl, moduleVersionName) => {
  const version = await portal.createVersion(token, accessUrl, moduleVersionName, moduleId)
  return version.id;
};

const waitForPublishing = async (token, moduleVersionId) => {
  try {
    await waitForStatus(() => portal.moduleVersionStatus(token, moduleId, moduleVersionId), 'pending', 'accepted');
    logger.Success('Module uploaded.');
  } catch(e) {
    throw new Error('Module not uploaded. Check email for errors.');
  }
};

const getModule = async (token, name) => {
  const modules = await portal.findModules(token, name);
  const module = modules[0];
  if (module){
    return module;
  } else {
    throw new Error(`Module "${name}" not found`);
  }
};

const getPassword = () => {
  return new Promise((resolve, reject) => {
    const reader = rl.createInterface({ input: process.stdin, output: process.stdout });
    reader.stdoutMuted = true;
    reader.question('Password: ', password => {
      reader.close();
      console.log('');
      resolve(password);
    });

    reader._writeToOutput = stringToWrite => (reader.stdoutMuted && reader.output.write('*')) || reader.output.write(stringToWrite);
  });
};

const getToken = async (params) => {
  let password;
  if (process.env.POS_PORTAL_PASSWORD) {
    password = process.env.POS_PORTAL_PASSWORD;
  } else {
    password = await getPassword();
  }
  logger.Info(`Asking ${portal.HOST} for access token...`);
  const token = await portalAuthToken(params.email, password);
  return token;
}

const portalAuthToken = async (email, password) => {
  try {
    const token = await portal.jwtToken(email, password)
    return token.auth_token;
  } catch (e) {
    if (ServerError.isNetworkError(e))
      ServerError.handler(e)
    else
      process.exit(1);
  }
};

const publishVersion = async (params) => {
  try {
    const config = moduleConfig();
    const moduleName = config['machine_name'];
    const moduleVersionName = config['version'];
    const numberOfFiles = await createArchive(moduleName);
    if (numberOfFiles > 0) {
      const token = await getToken(params);
      const module = await getModule(token, moduleName);
      moduleId = module.id;
      const archiveUrl = await uploadArchive(token);
      const posModuleVersionId = await createVersion(token, archiveUrl, moduleVersionName);
      await waitForPublishing(token, posModuleVersionId);
    } else {
      throw new Error('There are no files in module release');
    }

    return true;
  } catch (e) {
    if (ServerError.isNetworkError(e))
      ServerError.handler(e)
    else if (e.message){
      logger.Error(e.message);
    } else {
      logger.Error('Error');
    }
    process.exit(1);
  }
};

module.exports = {
  publishVersion: publishVersion
};
