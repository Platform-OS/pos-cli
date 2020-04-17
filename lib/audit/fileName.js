const glob = require('fast-glob');
const isValidFilePath = require('../utils/valid-file-path');

module.exports = {
  audit: async () => {
    const files = await glob(['app/**/*', 'modules/*/{private,public}/**/*']);

    const invalidFileNames = files.filter(filepath => !isValidFilePath(filepath));
    if (invalidFileNames.length > 0) {
      return {
        ['Invalid filename']: {
          files: invalidFileNames,
          message: 'Invalid filename. It contains prohibited special characters.'
        }
      };
    }

    return {};
  }
};