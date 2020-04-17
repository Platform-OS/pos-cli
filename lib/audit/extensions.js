const glob = require('fast-glob');

const rules = [
    {
        directories: [
            'forms',
            'form_configurations',
            'authorization_policies',
            'notifications',
            'emails',
            'api_calls',
            'smses'
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
                    appFiles = await glob(`app/${dir}/**/*`);
                } catch (err) { }

                let moduleFiles = [];
                try {
                    moduleFiles = await glob(`modules/*/{putlic,private}/${dir}/**/*`);
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