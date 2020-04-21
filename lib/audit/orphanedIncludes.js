const fs = require('fs');
const glob = require('fast-glob');
const path = require('path');

const logger = require('../logger');

const includes = /{%-? include (['"])([\w/]*)\1/g;
const variableInclude = /{%-? include ([\w]+)/;

const normalizePath = (partialName, includedFrom) => {
  // App directory.
  if (includedFrom.startsWith('app/')) {
    return findExistingFile([
      `app/views/partials/${partialName}.liquid`,
      `app/views/partials/_${partialName}.liquid`
    ]);
  }

  // Modules.
  // Get module/[moduleName].
  const includedFromPath = path.join(...includedFrom.split(path.sep).slice(0, 2));
  return findExistingFile([
    `${includedFromPath}/private/views/partials/${partialName}.liquid`,
    `${includedFromPath}/private/views/partials/_${partialName}.liquid`,
    `${includedFromPath}/public/views/partials/${partialName}.liquid`,
    `${includedFromPath}/public/views/partials/_${partialName}.liquid`
  ]);
};

const findExistingFile = files => files.find(file => fs.existsSync(file));

const findPartials = async () => {
  let foundVariableInclude = false;
  let foundVariableIncludeFile = '';

  const files = await glob('{app,modules}/**/*.liquid');
  const foundPartials = files.reduce((partials, file) => {
    const fileContents = fs.readFileSync(file, { encoding: 'utf8' });

    // Drop out if variable include found.
    if (fileContents.match(variableInclude)) {
      foundVariableInclude = true;
      foundVariableIncludeFile = file;
      return { foundPartials: {}, foundVariableInclude, foundVariableIncludeFile };
    }

    while (includesMatches = includes.exec(fileContents)) {
      partials.add(normalizePath(includesMatches[2], file));
    }

    return partials;
  }, new Set());

  return { foundPartials, foundVariableInclude, foundVariableIncludeFile };
};

module.exports = {
  audit: async () => {
    let results = {};

    const { foundPartials, foundVariableInclude, foundVariableIncludeFile } = await findPartials();
    if (foundVariableInclude) {
      logger.Info(`Found partial included using a variable in: ${foundVariableIncludeFile}`);
      logger.Info('Orphaned partials check is disabled.');
      return {};
    }

    // Look up all partials.
    let partials = await glob('{app,modules}/**/partials/**/*.liquid');

    // Find never included partials.
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