import fs from 'fs';
import glob from 'fast-glob';
import path from 'path';

import logger from '../logger.js';

const includes = /include (['"])([\w/-]*)\1/g;
const variableInclude = /include ([\w]+)/;

const normalizePath = (partialName, includedFrom) => {
  if (includedFrom.startsWith('app/')) {
    return findExistingFile([`app/views/partials/${partialName}.liquid`, `app/views/partials/_${partialName}.liquid`]);
  }

  if (includedFrom.startsWith('modules/')) {
    const includedFromPath = path.join(...includedFrom.split(path.sep).slice(0, 2));
    const partialFilename = partialName.substr(includedFromPath.length + 1) + '.liquid';
    return findExistingFile([
      `${includedFromPath}/private/views/partials/${partialFilename}`,
      `${includedFromPath}/private/views/partials/_${partialFilename}`,
      `${includedFromPath}/public/views/partials/${partialFilename}`,
      `${includedFromPath}/public/views/partials/_${partialFilename}`
    ]);
  }

  return false;
};

const findExistingFile = files => files.find(file => fs.existsSync(file));

const findPartials = async () => {
  let foundVariableInclude = false;
  let foundVariableIncludeFile = '';

  const files = await glob('{app,modules}/**/*.liquid');
  const foundPartials = files.reduce((partials, file) => {
    const fileContents = fs.readFileSync(file, { encoding: 'utf8' });

    if (fileContents.match(variableInclude)) {
      foundVariableInclude = true;
      foundVariableIncludeFile = file;
      return partials;
    }

    let includesMatches;
    while ((includesMatches = includes.exec(fileContents))) {
      partials.add(normalizePath(includesMatches[2], file));
    }

    return partials;
  }, new Set());

  return { foundPartials, foundVariableInclude, foundVariableIncludeFile };
};

const orphanedIncludes = {
  audit: async () => {
    let results = {};

    const { foundPartials, foundVariableInclude, foundVariableIncludeFile } = await findPartials();
    if (foundVariableInclude) {
      logger.Info(`Found partial included using a variable in: ${foundVariableIncludeFile}`);
      logger.Info('Orphaned partials check is disabled.');
      return {};
    }

    let partials = await glob('{app,modules}/**/partials/**/*.liquid');

    const notIncludedPartials = partials.filter(partial => !foundPartials.has(partial));
    if (notIncludedPartials.length > 0) {
      results = {
        'Not included partials': {
          files: notIncludedPartials,
          message: 'Partial never included'
        }
      };
    }

    return results;
  }
};

export default orphanedIncludes;
