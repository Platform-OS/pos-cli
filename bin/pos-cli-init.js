#!/usr/bin/env node
const program = require('commander');
const request = require('request');
const fs = require('fs');
const path = require('path');
const { mkdir, mv, rm, pwd, ls } = require('shelljs');
const extract = require('extract-zip');
const logger = require('../lib/logger');
const validate = require('../lib/validators');
const dir = require('../lib/directories');

const DEFAULT_REPO = 'https://github.com/mdyd-dev/directory-structure';
const DEFAULT_BRANCH = 'master';

// TODO: Deprecate in favor of `npx degit` !

const TMP_DIR = path.normalize(path.resolve(process.cwd(), dir.TMP));
const TMP_PATH = path.normalize(path.resolve(TMP_DIR, 'directory-structure.zip'));

const emptyTemp = () => rm('-rf', `${TMP_DIR}/*`);
const createTemp = () => mkdir('-p', TMP_DIR);
const removeTemp = () => rm('-rf', TMP_DIR);
const repoNameFrom = () => program.url.split('/').pop();
const dirExists = dir => fs.existsSync(path.join(process.cwd(), dir));
const moveStructureToDestination = branch => {
  const EXTRACTED_STRUCTURE = path.normalize(path.resolve(TMP_DIR, `${repoNameFrom()}-${branch}`, '*'));
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

    logger.Info('Directory structure created in your file system.');

    removeTemp();
  });
};

const init = () => {
  validate.url(program.url);
  createTemp();
  emptyTemp();

  if (dirExists(dir.APP) || dirExists(dir.MODULES)) {
    logger.Error('Diretory structure already exists. Operation aborted.');
  }

  downloadZip(program).on('close', () => extractZip(program));
};

program
  .option('--url <url>', 'theme github repository url', DEFAULT_REPO)
  .option('--branch <branch>', 'branch where the theme is located', DEFAULT_BRANCH);

program.parse(process.argv);

init();
