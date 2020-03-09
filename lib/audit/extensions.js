const glob = require('tiny-glob');

const directoriesOnlyLiquid = [
    'forms',
    'form_configurations',
    'authorization_policies',
    'notifications'
]

module.exports = {
    audit: async () => {
        let results = {};

        for (let i in directoriesOnlyLiquid) {
            const dir = directoriesOnlyLiquid[i];
            const files = await glob(`app/${dir}/**`, {
                filesOnly: true
            });

            if (files.length > 0) {
                results = {
                    ...results,
                    [`Only .liquid files should be in ${dir}`]: {
                        files: files,
                        message: `Only .liquid files should be in app/${dir}/`
                    }
                }
            }
        }

        return results;
    }
};