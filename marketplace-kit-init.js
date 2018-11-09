#!/usr/bin/env node

const program = require('commander'),
  request = require('request'),
  fs = require('fs'),
  path = require('path'),
  shell = require('shelljs'),
  extract = require('extract-zip'),
  logger = require('./lib/logger'),
  validate = require('./lib/validators'),
  version = require('./package.json').version;

const { mkdir, mv, rm, pwd } = shell;

const DEFAULT_REPO = 'https://github.com/mdyd-dev/directory-structure';
const DEFAULT_BRANCH = 'master';

const TMP_DIR = path.normalize(path.resolve(process.cwd(), '.tmp'));
const TMP_PATH = path.normalize(path.resolve(TMP_DIR, 'directory-structure.zip'));

const emptyTemp = () => rm('-rf', `${TMP_DIR}/*`);
const createTemp = () => mkdir('-p', TMP_DIR);
const removeTemp = () => rm('-rf', TMP_DIR);
const repoNameFrom = () => program.url.split('/').pop();
const moveStructureToDestination = branch => {
  const EXTRACTED_STRUCTURE = path.normalize(path.resolve(TMP_DIR, `${repoNameFrom()}-${branch}`, 'marketplace_builder'));
  return mv('-f', EXTRACTED_STRUCTURE, pwd());
};

const downloadZip = ({ url, branch }) => {
  logger.Info(`Downloading ${branch} branch from ${url} repository`);
  const zipfileUrl = `${url}/archive/${branch}.zip`;
  return request(zipfileUrl).pipe(fs.createWriteStream(TMP_PATH));
};

const extractZip = ({ branch }) => {
  extract(TMP_PATH, { dir: TMP_DIR }, error => {
    if (error) {
      logger.Error('Zip extraction failed. ', error);
    }

    moveStructureToDestination(branch);
    removeTemp();

    logger.Info('Directory structure created.');
    logger.Warn('Use deploy command before syncing changes to make sure all files are deployed to your instance.');
  });
};

const init = () => {
  validate.url(program.url);
  createTemp();
  emptyTemp();

  if (fs.existsSync(path.join(process.cwd(), 'marketplace_builder'))) {
    logger.Error('marketplace_builder directory already exists. Delete it to initialize from scratch.');
  }

  downloadZip(program).on('close', () => extractZip(program));
};

program
  .version(version)
  .option('--url <url>', 'theme github repository url', DEFAULT_REPO)
  .option('--branch <branch>', 'branch where the theme is located', DEFAULT_BRANCH);

program.parse(process.argv);

init();
