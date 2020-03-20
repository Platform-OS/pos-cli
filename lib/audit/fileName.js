const glob = require('tiny-glob');

const invalidFilename = /[^a-zA-Z\-_\.\/]/;

module.exports = {
    audit: async () => {
        files = await glob('app/**/*', { filesOnly: true });

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