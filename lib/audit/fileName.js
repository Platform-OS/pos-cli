const glob = require('tiny-glob');
const isValidFilePath = require('../utils/valid-file-path');

module.exports = {
    audit: async () => {
        let appFiles = [];
        try {
            appFiles = await glob('app/**/*');
        } catch (err) { }

        let moduleFiles = [];
        try {
            moduleFiles = await glob('modules/*/{private,public}/**/*');
        } catch (err) { }

        const files = [...appFiles, ...moduleFiles];

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
}