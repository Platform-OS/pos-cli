const glob = require('tiny-glob');

const invalidFilename = /[^a-zA-Z\-_\.\/]/;

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
        const invalidFileNames = files.filter(file => invalidFilename.test(file));
        if (invalidFileNames.length > 0) {
            return {
                ['Invalid filename']: {
                    files: invalidFileNames,
                    message: 'Invalid filename'
                }
            };
        }

        return {};
    }
}