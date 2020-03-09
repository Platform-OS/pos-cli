const glob = require('tiny-glob');

const rules = [
    {
        directories: [
            'forms',
            'form_configurations',
            'authorization_policies',
            'notifications'
        ],
        extension: '.liquid'
    },
    {
        directories: [
            'custom_model_types',
            'custom_model_schemas',
            'instance_profile_types',
            'instance_profile_schemas'
        ],
        extension: '.yml'
    }
]

module.exports = {
    audit: async () => {
        let results = {};

        for (let rule of rules) {
            for (let dir of rule.directories) {
                let files;
                try {
                    files = await glob(`app/${dir}/**`, {
                        filesOnly: true
                    });
                } catch (err) {
                    continue;
                }

                files = files.filter(file => !file.match(`\\${rule.extension}$`));

                if (files.length > 0) {
                    results = {
                        ...results,
                        [`Only ${rule.extension} files should be in ${dir}`]: {
                            files: files,
                            message: `Only ${rule.extension} files should be in app/${dir}/`
                        }
                    }
                }
            }
        }

        return results;
    }
};