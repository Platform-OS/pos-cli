const chalk = require('chalk');
const DEPRECATED_TAGS = require('./deprecatedTags');
const DEPRECATED_FILTERS = require('./deprecatedFilters');

const log = {
  warning: msg => console.log(chalk.yellow('[Audit Warn] ') + msg),
  info: msg => console.log(chalk.blue('[Audit Info] ') + msg),
  error: msg => console.log(chalk.bold.red('[Audit Error] ') + msg)
};

const printMessage = message => {
  return matches => {
    files = matches.join('\n  ');
    log.warning(`${message} in the following files: \n  ${files}`);
  }
}


/*
  directory [string - glob]
    Try to be as specific as possible to make it fast.
    Omit `marketplace_builder` and `modules` in your definition

  find [string or regexp]
    What test will look for in the file contents

  message [function]
    Action that will be run after it matched
*/
const baseRules = [
  {
    directory: 'views/pages/**/*.liquid',
    find: /^enable_profiler\: true$/,
    message: printMessage('plese remove "enable_profiler: true" setting')
  },
  {
    directory: 'views/**/*.liquid',
    find: /\{\%\-*\sinclude_form.*resource_id/,
    message: printMessage('deprecated argument "resource_id" of include_form tag, please replace with "id"')
  },
  {
    directory: '{views/**/*.liquid',
    find: /\{\%\-*\s*render_form.*/,
    message: printMessage('deprecated tag "render_form", please replace with "include_form"')
  },
  {
    directory: 'form_configurations/**/*.liquid',
    find: /configuration\:/,
    message: printMessage('deprecated key "configuration", please replace with "fields"')
  },
  {
    directory: '**/*.yml',
    find: /attribute_type/,
    message: printMessage('deprecated key "attribute_type", please replace with "type"')
  },
  {
    directory: '{transactable_types,instance_profile_types,custom_model_types}/**/*.yml',
    find: /name:\s+([a-z\_]*( |[A-Z]|-)[a-z\_]*)+/,
    message: printMessage('please use snake_case format as model name')
  },
  {
    directory: '{transactable_types,instance_profile_types,custom_model_types}/**/*.yml',
    find: /custom_attributes\:/,
    message: printMessage('deprecated key "custom_attributes", please replace with "properties"')
  }
];

const deprecatedTagRules = DEPRECATED_TAGS.map( function(val) {
  return  {
    directory: './**/*.liquid',
    find: new RegExp(val),
    message: printMessage('deprectaed "${val}" tag')
  }
});

const deprecatedFilterRules = DEPRECATED_FILTERS.map( function(val) {
  return {
    directory: './**/*.liquid',
    find: new RegExp(val),
    message: printMessage('deprecated "${val}" filter')
  };
});


module.exports = [ ...deprecatedTagRules, ...deprecatedFilterRules, ...baseRules];
