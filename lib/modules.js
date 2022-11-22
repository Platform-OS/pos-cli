const logger = require('./logger');
const portal = require('./portal');
const prepareArchive = require('./prepareArchive');
const presignUrl = require('./presignUrl').presignUrlForPortal;
const uploadFile = require('./s3UploadFile').uploadFile;
const waitForStatus = require('./data/waitForStatus');

const moduleName = () => {
  return '118';
};
const archiveFileName = 'release.zip';
const archivePath = `./tmp/${archiveFileName}`;

const createArchive = async () => {
  return new Promise(async (resolve, reject) => {
    const releaseArchive = prepareArchive(archivePath, resolve, true);
    const options = {};
    // Think and decide
    // Whitelist extensions that need to be included in deploy?
    // Blacklist extensions that are most likely to be problematic (ie. break deploy, like .zip)
    releaseArchive.glob('{private,public}/**', options);
    await releaseArchive.finalize();
  });
};

const uploadArchive = async (token) => {
  const data = await presignUrl(token, moduleName(), archiveFileName);
  console.log(data);
  await uploadFile(archivePath, data.uploadUrl);
  return data.accessUrl;
};

const createVersion = async (token, accessUrl) => {
  const version = await portal.createVersion(token, accessUrl, '0.0.1', moduleName())
  return version.id;
};

const waitForPublishing = async (token, moduleVersionId) => {
  await waitForStatus(() => portal.moduleVersionStatus(token, moduleName(), moduleVersionId), 'pending', 'accepted');
  logger.Success('Published');
};

const publishVersion = async (token) => {
  try {
    const numberOfFiles = await createArchive();
    if (numberOfFiles > 0) {
      const archiveUrl = await uploadArchive(token);
      const posModuleVersionId = await createVersion(token, archiveUrl);
      await waitForPublishing(token, posModuleVersionId);
    } else {
      logger.Warn('There are no files in release file, skipping.');
    }

    return true;
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
};

module.exports = {
  publishVersion: publishVersion
};
