import glob from 'fast-glob';
import isValidFilePath from '../utils/valid-file-path.js';

const fileName = {
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

export default fileName;
