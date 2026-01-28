import fs from 'fs';
import glob from 'fast-glob';

const detailed = [
  {
    name: 'profiler',
    glob: 'views/pages/**/*.liquid',
    test: '^enable_profiler: true$',
    message: `[PERFORMANCE] Please remove "enable_profiler: true" setting for performance reasons.
      \nRead more at: https://documentation.platformos.com/release-notes/15-NOVEMBER-2018#liquid-profiler`
  },
  {
    name: 'unnecessary_brackets',
    glob: '*.liquid',
    test: '\\.name\\s*-?}}\\[\\]',
    message: `[DEPRECATED] Please remove hardcoded array indicators ([]) from your input names.
      \nExample: <input name="{{ fields.company.name }}[]"> becomes <input name="{{ fields.company.name }}">`
  },
  {
    name: 'resource_id',
    glob: 'views/**/*.liquid',
    test: '{%-?\\s*include_form.*resource_id:',
    message: '[DEPRECATED ARGUMENT] "resource_id" of include_form tag, please replace with "id"'
  },
  {
    name: 'configuration',
    glob: '{form_configurations,forms}/**/*.liquid',
    test: '^configuration:',
    message: '[DEPRECATED KEY] "configuration", please replace with "fields"'
  },
  {
    name: 'attribute_type',
    glob: '{transactable_types,instance_profile_types,user_profile_types,custom_model_types,model_schemas}/**/*.yml',
    test: '\\s*attribute_type:',
    message: '[DEPRECATED KEY] "attribute_type", please replace with "type"'
  },
  {
    name: 'custom_attributes',
    glob: '{transactable_types,instance_profile_types,user_profile_types,custom_model_types,model_schemas}/**/*.yml',
    test: '^custom_attributes:',
    message: '[DEPRECATED KEY] "custom_attributes", please replace with "properties"'
  },
  {
    name: 'camel_case',
    glob: '{transactable_types,instance_profile_types,user_profile_types,custom_model_types,model_schemas}/**/*.yml',
    test: '^name:\\s+([a-z\\_]*( |[A-Z]|-)[a-z\\_]*)+',
    message: '[CONVENTION] Please use snake_case naming convention in model names'
  },
  {
    name: 'headers',
    glob: 'api_calls/**/*.liquid',
    test: '^headers:',
    message: '[DEPRECATED] "headers" has been renamed to "request_headers"'
  }
];

const audit = async () => {
  let results = {};

  for (let rule of detailed) {
    const files = await glob(`{app,modules,marketplace_builder}/**/${rule.glob}`);

    for (let file of files) {
      const fileContents = fs.readFileSync(file, { encoding: 'utf8' });
      const match = RegExp(rule.test, 'm').test(fileContents);

      if (!match) {
        continue;
      }

      const currentFiles = results[rule.name] && results[rule.name].files;
      const updatedFiles = (currentFiles || []).concat(file);

      results = {
        ...results,
        [rule.name]: {
          files: updatedFiles,
          message: rule.message
        }
      };
    }
  }

  return results;
};

export default { audit };
