const fs = require('fs');
const rl = require('readline');
const glob = require('fast-glob');

const files = require('./files');
const logger = require('./logger');
const Portal = require('./portal');
const prepareArchive = require('./prepareArchive');
const presignUrl = require('./presignUrl').presignUrlForPortal;
const uploadFile = require('./s3UploadFile').uploadFile;
const waitForStatus = require('./data/waitForStatus');
const { readPassword } = require('./utils/password');
const ServerError = require('../lib/ServerError');

let moduleId;
const archiveFileName = 'release.zip';
const archivePath = `./tmp/${archiveFileName}`;
const moduleConfigFileName = 'template-values.json';
let filePath = moduleConfigFileName;

const moduleConfig = async (moduleName) => {
  if(!fs.existsSync(filePath)) {
    const moduleConfigPath = await moduleConfigFilePath(moduleName);
    if(moduleConfigPath) {
      filePath = moduleConfigPath
    } else if(moduleName) {
      filePath = `modules/${moduleName}/${moduleConfigFileName}`
    }
  }
  return files.readJSON(filePath, { throwDoesNotExistError: true, exit: true });
};

const moduleConfigFilePath = async (moduleName="*") => {
  const configFiles = await glob([`modules/${moduleName}/${moduleConfigFileName}`, moduleConfigFileName]);
  if(configFiles.length > 1) {
    throw new Error(`There is more than one modules/*/template-values.json, please use --name parameter or create template-values.json in the root of the project.`);
  }
  return configFiles[0];
}

const createArchive = async (moduleName) => {
  try {
    return new Promise(async (resolve, reject) => {
      const releaseArchive = prepareArchive(archivePath, resolve, true);
      if (fs.existsSync(moduleConfigFileName) && !fs.existsSync(`modules/`)){
        logger.Warn(`Cannot find modules/${moduleName}, creating archive with the current directory.`);
        releaseArchive.glob(['**/**', moduleConfigFileName], { ignore: ['**/node_modules/**', '**/tmp/**', 'app/'] }, { prefix: moduleName });
      } else if(fs.existsSync(`modules/${moduleName}/`)) {
        logger.Info(`Creating archive for modules/${moduleName}`);
        releaseArchive.glob(['**/**', moduleConfigFileName], { ignore: ['**/node_modules/**', '**/tmp/**'], cwd: `${process.cwd()}/modules/${moduleName}` }, { prefix: moduleName });
        releaseArchive.file(filePath, { name: moduleConfigFileName, prefix: moduleName });
      } else {
        reject(new Error(`There is no directory modules/${moduleName} - please double check the machine_name property in ${filePath}`))
      }
      await releaseArchive.finalize();
    });
  } catch(e) {
    throw e;
  }
}

const uploadArchive = async (token) => {
  const data = await presignUrl(token, moduleId, archiveFileName);
  logger.Debug(data);
  await uploadFile(archivePath, data.uploadUrl);
  logger.Info('Release Uploaded');
  return data.accessUrl;
};

const createVersion = async (token, accessUrl, moduleVersionName) => {
  const version = await Portal.createVersion(token, accessUrl, moduleVersionName, moduleId)
  return version.id;
};

const waitForPublishing = async (token, moduleVersionId) => {
  try {
    await waitForStatus(() => Portal.moduleVersionStatus(token, moduleId, moduleVersionId), 'pending', 'accepted');
    logger.Success('Module uploaded.');
  } catch(e) {
    throw new Error('Module not uploaded. Check email for errors.');
  }
};

const getModule = async (token, name) => {
  const modules = await Portal.findModules(token, name);
  const module = modules[0];
  if (module){
    return module;
  } else {
    throw new Error(`Module "${name}" not found`);
  }
};

const getToken = async (params) => {
  let password;
  if (process.env.POS_PORTAL_PASSWORD) {
    password = process.env.POS_PORTAL_PASSWORD;
  } else {
    password = await readPassword();
  }
  logger.Info(`Asking ${Portal.url()} for access token...`);
  const token = await portalAuthToken(params.email, password);
  return token;
}

const portalAuthToken = async (email, password) => {
  try {
    const token = await Portal.jwtToken(email, password)
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
    const config = await moduleConfig(params.name);
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
  publishVersion: publishVersion,
  moduleConfig: moduleConfig,
  moduleConfigFilePath: moduleConfigFilePath,
  moduleConfigFileName: moduleConfigFileName
};
