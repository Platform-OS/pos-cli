const fs = require('fs');
const glob = require('fast-glob');
const yaml = require('js-yaml');

const id = /(id: ?)(\w*)/;

module.exports = {
  audit: async () => {
    let results = {};

    // Collect ids.
    const schemaFiles = await glob('{app,modules}/**/{model_schemas,custom_model_types}/*.yml');
    const ids = schemaFiles.map(file => {
      const doc = yaml.safeLoad(fs.readFileSync(file, 'utf8'));
      if (doc) {
        return doc.name;
      }

      return '';
    });

    // Match ids to forms.
    const files = await glob('{app,modules}/**/{forms,form_configurations}/*.liquid');
    for (let file of files) {
      const fileContents = fs.readFileSync(file, { encoding: 'utf8' });
      let matches = id.exec(fileContents);
      if (matches && matches.length >= 3) {
        const foundId = matches[2];
        if (!ids.find(currId => foundId === currId)) {
          results = {
            ...results,
            [`Model ID not found: ${foundId} in ${file}`]: {
              files: [file],
              message: `Model ID not found: ${foundId}`
            }
          };
        }
      }
    }

    return results;
  }
};