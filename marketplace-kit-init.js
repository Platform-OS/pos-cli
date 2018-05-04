#!/usr/bin/env node

const program = require('commander'),
  request = require('request'),
  fs = require('fs'),
  path = require('path'),
  shell = require('shelljs'),
  extract = require('extract-zip'),
  logger = require('./lib/kit').logger,
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
const moveStructureToDestination = branch => {
  const EXTRACTED_STRUCTURE = path.normalize(path.resolve(TMP_DIR, `directory-structure-${branch}`, 'marketplace_builder'));
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

    logger.Success('Directory structure created.');
  });
};

const init = () => {
  validate.url(program.url);
  createTemp();
  emptyTemp();

  if (fs.existsSync(path.join(process.cwd(), 'marketplace_builder'))) {
    logger.Error('marketplace_builder directory already exists. Delete it to initialize from scratch.');
    process.exit(1);
  }

  downloadZip(program).on('close', () => extractZip(program));
};

program
  .version(version)
  .option('--url <url>', `theme github repository url. Default: ${DEFAULT_REPO}`, DEFAULT_REPO)
  .option('--branch <branch>', `branch where the theme is located. Default: ${DEFAULT_BRANCH}`, DEFAULT_BRANCH);

program.parse(process.argv);

init();
