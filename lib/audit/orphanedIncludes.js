const fs = require('fs');
const glob = require('tiny-glob');
const path = require('path');

const logger = require('../logger');

const includes = /{%-?\ include\ (['"])([\w/]*)\1/g;
const variableInclude = /{%-?\ include\ ([\w]+)/;

// Filter for {app,modules}/ top level directories.
// This is necessary because tiny-glob doesn't return files from all subdirectories: https://github.com/terkelg/tiny-glob/issues/28
filterAppModules = files => files.filter(file => file.match(/^(app|modules)\//));

normalizePath = (partialName, includedFrom) => {
    // App directory.
    if (includedFrom.startsWith('app/')) {
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

findPartials = async () => {
    let foundVariableInclude = false;
    let foundVariableIncludeFile = "";

    // @TODO what about ^_.liquid includes?
    const files = filterAppModules(await glob('**/*.liquid', { filesOnly: true }));
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
            logger.Info(`Found partial included using a variable in: ${foundVariableIncludeFile}`)
            logger.Info(`Orphaned partials check is disabled.`)
            return {};
        }

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