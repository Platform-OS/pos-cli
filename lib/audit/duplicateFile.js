import glob from 'fast-glob';
import fs from 'fs';

const underScorePrefix = /^_*/;

const duplicateFile = {
  audit: async () => {
    let results = {};

    const files = await glob(['app/views/partials/**/_*.liquid', 'modules/**/{private,public}/views/partials/**/_*.liquid']);
    for (let file of files) {
      let parts = file.split('/');
      let fileName = parts[parts.length - 1];
      parts[parts.length - 1] = fileName.replace(underScorePrefix, '', -1);
      const fileWithoutUndescore = parts.join('/');

      if (fs.existsSync(fileWithoutUndescore)) {
        results = {
          ...results,
          [`Multiple file names with the same partial for ${fileName}`]: {
            files: [file, fileWithoutUndescore],
            message: 'Multiple file names with the same partial path'
          }

        };
      }
    }

    return results;
  }
};

export default duplicateFile;
