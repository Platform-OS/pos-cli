const files = require('../lib/files');
const logger = require('./logger');
const portal = require('./portal');
const prepareArchive = require('./prepareArchive');
const presignUrl = require('./presignUrl').presignUrlForPortal;
const uploadFile = require('./s3UploadFile').uploadFile;
const waitForStatus = require('./data/waitForStatus');

let moduleId;
const archiveFileName = 'release.zip';
const archivePath = `./tmp/${archiveFileName}`;

const moduleConfig = () => {
  return files.readJSON('template-values.json', { throwDoesNotExistError: true });
};

const createArchive = async (moduleName) => {
  return new Promise(async (resolve, reject) => {
    const releaseArchive = prepareArchive(archivePath, resolve, true);
    releaseArchive.glob('{private,public}/**', {}, { prefix: moduleName });
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
  try {
    const version = await portal.createVersion(token, accessUrl, moduleVersionName, moduleId)
    return version.id;
  } catch(e) {
    let errorMessage;
    if (e.statusCode === 422){
      errorMessage = e.error.errors.join(', ');
    }
    throw new Error(`Module Version not created: ${errorMessage}`);
  }
};

const waitForPublishing = async (token, moduleVersionId) => {
  try {
    await waitForStatus(() => portal.moduleVersionStatus(token, moduleId, moduleVersionId), 'pending', 'accepted');
    logger.Success('Module Published');
  } catch(e) {
    throw new Error('Module not published. Check email for errors.');
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

const publishVersion = async (token) => {
  try {
    const config = moduleConfig();
    const moduleName = config['machine_name'];
    const moduleVersionName = config['version'];
    const numberOfFiles = await createArchive(moduleName);
    if (numberOfFiles > 0) {
      const module = await getModule(token, moduleName);
      moduleId = module.id;
      const archiveUrl = await uploadArchive(token);
      const posModuleVersionId = await createVersion(token, archiveUrl, moduleVersionName);
      await waitForPublishing(token, posModuleVersionId);
    } else {
      logger.Warn('There are no files in release file, skipping.');
    }

    return true;
  } catch (e) {
    if (e.message){
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
