import fs from 'fs';
import path from 'path';
import semver from 'semver';
import glob from 'fast-glob';

import files from './files.js';
import logger from './logger.js';
import Portal from './portal.js';
import prepareArchive from './prepareArchive.js';
import { presignUrlForPortal } from './presignUrl.js';
import { uploadFile } from './s3UploadFile.js';
import waitForStatus from './data/waitForStatus.js';
import { readPassword } from './utils/password.js';
import { isTwoFactorError, withTwoFactor } from './utils/twoFactor.js';
import { isPortalOutage } from './utils/partnerPortal.js';
import { reportCommandError } from './reportCommandError.js';
import ServerError from './ServerError.js';
import { POS_MODULE_FILE as moduleManifestFileName, POS_MODULE_LOCK_FILE as moduleLockFileName } from './modules/paths.js';

let moduleId;
const archiveFileName = 'release.zip';
const archivePath = `./tmp/${archiveFileName}`;

// Legacy file — still supported for reading (template substitution only) and archive glob.
const moduleConfigFileName = 'template-values.json';

/**
 * Reads and returns the module config from pos-module.json.
 * Throws with a migration hint when pos-module.json is absent.
 *
 * @returns {Object}
 */
const moduleConfig = () => {
  if (!fs.existsSync(moduleManifestFileName)) {
    throw new Error(
      `${moduleManifestFileName} not found.\n` +
      `Run: pos-cli modules migrate`
    );
  }
  return files.readJSON(moduleManifestFileName, { throwDoesNotExistError: true, exit: true });
};

const createArchive = async (moduleName) => {
  const archive = prepareArchive(archivePath, true);

  if (fs.existsSync(moduleManifestFileName) && !fs.existsSync('modules/')) {
    logger.Warn(`Cannot find modules/${moduleName}, creating archive with the current directory.`);
    const moduleFiles = await glob(['**/**', moduleManifestFileName, moduleConfigFileName, moduleLockFileName], {
      ignore: ['**/node_modules/**', '**/tmp/**', 'app/**'],
      onlyFiles: true
    });
    for (const f of moduleFiles) {
      archive.addFile(f, `${moduleName}/${f}`);
    }
  } else if (fs.existsSync(`modules/${moduleName}/`)) {
    logger.Info(`Creating archive for modules/${moduleName}`);
    const moduleDir = path.join(process.cwd(), 'modules', moduleName);
    const moduleFiles = await glob(['**/**', moduleConfigFileName], {
      ignore: ['**/node_modules/**', '**/tmp/**'],
      cwd: moduleDir,
      onlyFiles: true
    });
    for (const f of moduleFiles) {
      archive.addFile(path.join('modules', moduleName, f), `${moduleName}/${f}`);
    }
    // pos-module.json is required in the archive: the portal reads it to register
    // this module's transitive dependencies in the marketplace registry.
    archive.addFile(moduleManifestFileName, `${moduleName}/${moduleManifestFileName}`);
    // pos-module.lock.json (resolved via `pos-cli modules install` in this repo) ships
    // alongside the manifest so it's available wherever the release archive is consumed.
    if (fs.existsSync(moduleLockFileName)) {
      archive.addFile(moduleLockFileName, `${moduleName}/${moduleLockFileName}`);
    }
  } else {
    throw new Error(
      `There is no directory modules/${moduleName} - please double check the machine_name property in ${moduleManifestFileName}`
    );
  }

  archive.finalize();
  return archive.done;
};

/**
 * Validates the module manifest, creates the release archive, and returns
 * { moduleName, moduleVersionName, numberOfFiles }.  Throws on any failure —
 * callers are responsible for top-level error handling.
 */
const prepareRelease = async () => {
  const config = moduleConfig();
  const moduleName = config['machine_name'];
  const moduleVersionName = config['version'];

  if (!moduleName) {
    throw new Error(`'machine_name' is required in ${moduleManifestFileName} to publish a module.`);
  }
  if (!moduleVersionName) {
    throw new Error(
      `'version' is required in ${moduleManifestFileName} to publish a module.\n` +
      `Run: pos-cli modules version`
    );
  }
  if (!semver.valid(moduleVersionName)) {
    throw new Error(
      `'version' "${moduleVersionName}" in ${moduleManifestFileName} is not a valid semver string.`
    );
  }
  // Only check module directory when modules/ exists (no-modules/ is the single-dir publish workflow).
  if (fs.existsSync('modules/') && !fs.existsSync(`modules/${moduleName}/`)) {
    throw new Error(
      `Directory modules/${moduleName}/ not found.\n` +
      `Check the 'machine_name' value in ${moduleManifestFileName} matches an existing modules/ subdirectory.`
    );
  }

  const numberOfFiles = await createArchive(moduleName);
  if (numberOfFiles === 0) {
    throw new Error('There are no files in module release');
  }

  return { moduleName, moduleVersionName, numberOfFiles };
};

const handleError = async (e) => {
  if (ServerError.isNetworkError(e))
    await ServerError.handler(e);
  else if (e.message)
    await logger.Error(e.message);
  else
    await logger.Error('Error');
  process.exit(1);
};

const uploadArchive = async (token) => {
  const data = await presignUrlForPortal(token, moduleId, archiveFileName);
  logger.Debug(data);
  await uploadFile(archivePath, data.uploadUrl);
  logger.Info('Release Uploaded');
  return data.accessUrl;
};

const createVersion = async (token, accessUrl, moduleVersionName) => {
  const version = await Portal.createVersion(token, accessUrl, moduleVersionName, moduleId);
  return version.id;
};

// The portal unpacks the release in a background job, so the upload is not the end of the
// push: the version is `pending` until that job accepts or rejects it.
const PUBLISH_POLL_INTERVAL = 5000;

// Shorter than the interval on purpose: a check that has not answered by the time the next
// one is due has been overtaken by it, and without a deadline of its own it would inherit
// undici's five minutes -- long enough to look exactly like the hang this polling loop is
// here to avoid.
const PUBLISH_POLL_REQUEST_TIMEOUT = 4000;

// Long enough for a large module on a busy portal -- the job downloads the archive,
// unpacks it, repacks the public half and uploads that -- and short enough that a job
// which died is reported the same day. Without a deadline there is no difference between
// the two from here, and pos-cli used to sit on the second one indefinitely.
const PUBLISH_TIMEOUT = 15 * 60 * 1000;

const PUBLISH_TIMEOUT_MESSAGE =
  `The Partner Portal did not finish processing this release within ${PUBLISH_TIMEOUT / 60000} minutes.` +
  '\nThe upload itself went through, so check the module in the portal before pushing again:' +
  '\nif the version is still pending there, it is the portal-side job that is stuck, not this command.';

// The portal rejects a release for reasons an operator can act on -- an archive whose top
// level is not the module scope, a scope that disagrees with earlier versions, a module
// with no public files -- and puts the reason on the version itself. It also emails it,
// which is what pos-cli used to point at instead, leaving the terminal that had just
// waited out the job with nothing to show for it.
const rejectionMessage = (version) =>
  ['Module version was rejected by the Partner Portal.', version.error_message]
    .filter(Boolean)
    .join('\n') + '\nThe same message was sent to your email address.';

const isRejected = (failure) => (failure?.status?.name || failure?.status) === 'rejected';

const waitForPublishing = async (token, moduleVersionId) => {
  // The one line between "Release Uploaded" and the verdict. Polling is silent by design
  // (it is a Debug log), so without this the terminal shows nothing at all for however
  // long the portal takes, which is indistinguishable from a command that has stopped.
  logger.Info('Waiting for the Partner Portal to process the release...');

  try {
    await waitForStatus(
      () => Portal.moduleVersionStatus(token, moduleId, moduleVersionId, { timeout: PUBLISH_POLL_REQUEST_TIMEOUT }),
      'pending',
      'accepted',
      PUBLISH_POLL_INTERVAL,
      null,
      {
        failureStatus: ['rejected'],
        timeout: PUBLISH_TIMEOUT,
        timeoutMessage: PUBLISH_TIMEOUT_MESSAGE,
        // The release is uploaded and the portal-side job is very likely running; a 504
        // from a proxy, a 502 during a portal deploy or a check that timed out says
        // nothing about it. Failing the push on one of those reports a release that was
        // published as one that was not -- and there is no way to tell from the terminal.
        // A 401 or a 404 is still an answer, and still fails immediately.
        isTransient: isPortalOutage
      }
    );
  } catch (failure) {
    if (isRejected(failure)) throw new Error(rejectionMessage(failure));
    // A 401, a dropped connection or the deadline above: each already says what happened,
    // and handleError knows how to present the network ones. Replacing them with "check
    // email for errors" only hid which of them it was.
    throw failure;
  }

  logger.Success('Module uploaded.');
};

const getModule = async (token, name) => {
  const module = (await Portal.findModules(token, name))[0];
  if (!module) throw new Error(`Module "${name}" not found`);
  return module;
};

const getToken = async (params) => {
  const password = process.env.POS_PORTAL_PASSWORD || await readPassword();
  logger.Info(`Asking ${Portal.url()} for access token...`);
  return portalAuthToken(params.email, password, params.otpCode);
};

const portalAuthToken = async (email, password, otpCode) => {
  try {
    const token = await withTwoFactor(code => Portal.jwtToken(email, password, code), { otpCode });
    return token.auth_token;
  } catch (e) {
    // A TwoFactorError carries a multi-line, actionable message and must be printed, not
    // swallowed by the silent exit below — reportCommandError owns that rule for every
    // command, network failures included.
    if (isTwoFactorError(e) || ServerError.isNetworkError(e)) await reportCommandError(e);
    else process.exit(1);
  }
};

const buildArchive = async () => {
  try {
    const { numberOfFiles } = await prepareRelease();
    logger.Success(`Module archive created: ${archivePath} (${numberOfFiles} files)`);
    return true;
  } catch (e) {
    await handleError(e);
  }
};

const publishVersion = async (params) => {
  try {
    const { moduleName, moduleVersionName } = await prepareRelease();
    const token = await getToken(params);
    const module = await getModule(token, moduleName);
    moduleId = module.id;
    const archiveUrl = await uploadArchive(token);
    const posModuleVersionId = await createVersion(token, archiveUrl, moduleVersionName);
    await waitForPublishing(token, posModuleVersionId);
    return true;
  } catch (e) {
    await handleError(e);
  }
};

export { publishVersion, buildArchive, moduleConfig, moduleConfigFileName, moduleManifestFileName };
