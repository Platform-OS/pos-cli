const fs = require('fs');
const glob = require('tiny-glob');
const path = require('path');

const includes = /{%-?\ include\ (['"])([\w/]*)\1/g;

// Filter for {app,modules}/ top level directories.
// This is necessary because tiny-glob doesn't return files from all subdirectories: https://github.com/terkelg/tiny-glob/issues/28
filterAppModules = files => files.filter(file => file.match(/^(app|modules)\//));

normalizePath = (partialName, includedFrom) => {
    // App directory.
    if (includedFrom.match(/^app/)) {
        return `app/views/partials/${partialName}.liquid`;
    }

    // Modules.
    // Get module/[moduleName].
    const includedFromPath = path.join(...includedFrom.split(path.sep).slice(0, 2));

    // Check if file is available in the private folder.
    const moduleFilePrivatePath = `/private/views/partials/${partialName}.liquid`;
    if (fs.existsSync(includedFromPath + moduleFilePrivatePath)) {
        return includedFromPath + moduleFilePrivatePath;
    }

    // Otherwise return public folder
    return `${includedFromPath}/public/views/partials/${partialName}.liquid`;
};

module.exports = {
    audit: async () => {
        // @TODO drop out if variable is included.
        let results = {};

        const files = filterAppModules(await glob('**/*.liquid', { filesOnly: true }));

        // @TODO what about ^_.liquid includes?

        // Find all partials in **/*.liquid.
        let foundPartials = files.reduce((acc, file) => {
            const fileContents = fs.readFileSync(file, { encoding: 'utf8' });
            while (includesMatches = includes.exec(fileContents)) {
                acc.add(normalizePath(includesMatches[2], file));
            }

            return acc;
        }, new Set());

        // Look up all partials.
        let partials = filterAppModules(await glob('**/partials/**/*.liquid', { filesOnly: true }));

        // Find never included partials.
        const notIncludedPartials = partials.filter(partial => !foundPartials.has(partial));
        if (notIncludedPartials) {
            results = {
                "Not included partials": {
                    files: notIncludedPartials,
                    message: "Partial never included"
                }
            }
        }

        return results;
    }
}