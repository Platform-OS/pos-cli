import glob from 'fast-glob';

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
];

const extensions = {
  audit: async () => {
    let results = {};

    for (let rule of rules) {
      for (let dir of rule.directories) {
        const files = (await glob([`app/${dir}/**/*`, `modules/*/{public,private}/${dir}/**/*`]))
          .filter(file => !file.match(`\\${rule.extension}$`));
        if (files.length > 0) {
          results = {
            ...results,
            [`Only ${rule.extension} files should be in ${dir}`]: {
              files: files,
              message: `Only ${rule.extension} files should be in ${dir} directory`
            }
          };
        }
      }
    }

    return results;
  }
};

export default extensions;
