/*
  glob [string - glob]
    Try to be as specific as possible to make it fast.
    Omit `marketplace_builder`, `app` and `modules` in your definition

  test [string - regexp]
    What test will look for in the file contents.

  message [string]
    Message to be displayed if `test` is satisfied
*/
const rules = [
  {
    glob: 'views/pages/**/*.liquid',
    test: '^enable_profiler: true$',
    message: 'Please remove "enable_profiler: true" setting for performance reasons. \nRead more at: https://documentation.platformos.com/release-notes/15-NOVEMBER-2018#liquid-profiler'
  },
  {
    glob: 'views/**/*.liquid',
    test: '{%-?\\s*include_form.*resource_id:',
    message: 'Deprecated argument "resource_id" of include_form tag, please replace with "id"'
  },
  {
    glob: 'form_configurations/**/*.liquid',
    test: '^configuration:',
    message: 'Deprecated key "configuration", please replace with "fields"'
  },
  {
    glob: '{transactable_types,instance_profile_types,custom_model_types,model_schemas}/**/*.yml',
    test: '\\s*attribute_type:',
    message: 'Deprecated key "attribute_type", please replace with "type"'
  },
  {
    glob: '{transactable_types,instance_profile_types,custom_model_types,model_schemas}/**/*.yml',
    test: '^custom_attributes:',
    message: 'Deprecated key "custom_attributes", please replace with "properties"'
  },
  {
    glob: '{transactable_types,instance_profile_types,custom_model_types,model_schemas}/**/*.yml',
    test: '^name:\\s+([a-z\\_]*( |[A-Z]|-)[a-z\\_]*)+',
    message: 'Please use snake_case format as model name'
  }
];

module.exports = rules;