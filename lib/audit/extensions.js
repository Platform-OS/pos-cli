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
            'model_schemas',
            'custom_model_types',
            'user_profile_types',
            'instance_profile_types'
        ],
        extension: '.yml'
    },
    {
        directories: ['graphql', 'graph_queries'],
        extension: '.graphql'
    }
]

module.exports = {
    audit: async () => {
        let results = {};

        for (let rule of rules) {
            for (let dir of rule.directories) {
                let appFiles = [];
                try {
                    appFiles = await glob(`app/${dir}/**/*`, { filesOnly: true });
                } catch (err) { }

                let moduleFiles = [];
                try {
                    moduleFiles = await glob(`modules/*/{public,private}/${dir}/**/*`, { filesOnly: true });
                } catch (err) { }

                files = [...appFiles, ...moduleFiles].filter(file => !file.match(`\\${rule.extension}$`));
                if (files.length > 0) {
                    results = {
                        ...results,
                        [`Only ${rule.extension} files should be in ${dir}`]: {
                            files: files,
                            message: `Only ${rule.extension} files should be in ${dir} directory`
                        }
                    }
                }
            }
        }

        return results;
    }
};