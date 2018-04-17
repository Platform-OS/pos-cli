#!/usr/bin/env node

const program = require('commander'),
  request = require('request'),
  fs = require('fs'),
  path = require('path'),
  shell = require('shelljs'),
  extract = require('extract-zip'),
  logger = require('./lib/kit').logger,
  version = require('./package.json').version;

const { mkdir, mv, cp, rm, pwd } = shell;

const DEFAULT_URL = 'https://github.com/mdyd-dev/directory-structure/archive/master.zip';

const TMP_DIR = path.normalize(path.resolve(process.cwd(), '.tmp'));
const TMP_PATH = path.normalize(path.resolve(TMP_DIR, 'directory-structure.zip'));
const EXTRACTED_STRUCTURE = path.normalize(path.resolve(TMP_DIR, 'directory-structure-master', 'marketplace_builder'));

const emptyTemp = () => rm('-rf', `${TMP_DIR}/*`);
const createTemp = () => mkdir('-p', TMP_DIR);
const removeTemp = () => rm('-rf', TMP_DIR);

const downloadZip = (url = DEFAULT_URL) => {
  logger.Info(`Downloading directory structure from ${url}`);
  return request(url).pipe(fs.createWriteStream(TMP_PATH));
};

const extractZip = () => {
  const moveStructureToDestination = () => mv('-rf', EXTRACTED_STRUCTURE, pwd());

  extract(TMP_PATH, { dir: TMP_DIR }, error => {
    if (error) {
      logger.Error('Zip extraction failed. ', error);
    }

    moveStructureToDestination();
    removeTemp();

    logger.Success('Directory structure created.');
  });
};

const init = () => {
  createTemp();
  emptyTemp();

  downloadZip().on('close', extractZip);
};

program.version(version).parse(process.argv);

init();
