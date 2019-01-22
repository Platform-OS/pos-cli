const chalk = require('chalk');
const DEPRECATED_TAGS = require('./deprecatedTags');
const DEPRECATED_FILTERS = require('./deprecatedFilters');

const log = {
  warning: msg => console.log(chalk.yellow(`[Audit Warn] `) + msg),
  info: msg => console.log(chalk.blue(`[Audit Info] `) + msg),
  error: msg => console.log(chalk.bold.red(`[Audit Error]`) +  msg)
};

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
    message: matches => {
      log.warning(`Found "enable_profiler: true" setting in ${matches.length} files. This will result in a performance hit.`);
    }
  },
  {
    directory: 'views/**/*.liquid',
    find: /\{\%\-*\sinclude_form.*resource_id/,
    message: matches => {
      files = matches.join('\n  ')
      log.warning(`deprecated argument "resource_id" of include_form tag, please replace with "id" in the following files: \n  ${files}`);
    }
  },
  {
    directory: '{views/**/*.liquid',
    find: /\{\%\-*\s*render_form.*/,
    message: matches => {
      files = matches.join('\n  ')
      log.warning(`deprecated tag "render_form", please replace with "include_form" in the following files: \n  ${files}`);
    }
  },
  {
    directory: 'form_configurations/**/*.liquid',
    find: /configuration\:/,
    message: matches => {
      files = matches.join('\n  ')
      log.warning(`deprecated key "configuration", please replace with "fields" in the following files: \n  ${files}`);
    }
  },
  {
    directory: '**/*.yml',
    find: /attribute_type/,
    message: matches => {
      files = matches.join('\n  ')
      log.warning(`deprecated key "attribute_type", please replace with "type" in the following files: \n  ${files}`);
    }
  },
  {
    directory: '{transactable_types,instance_profile_types,custom_model_types}/**/*.yml',
    find: /name:\s+([a-z\_]*( |[A-Z]|-)[a-z\_]*)+/,
    message: matches => {
      files = matches.join('\n  ')
      log.warning(`please use snake_case format as model name in the following files: \n  ${files}`);
    }
  },
  {
    directory: '{transactable_types,instance_profile_types,custom_model_types}/**/*.yml',
    find: /custom_attributes\:/,
    message: matches => {
      files = matches.join('\n  ')
      log.warning(`deprecated key "custom_attributes", please replace with "properties" in the following files: \n  ${files}`);
    }
  }
]

const deprecatedTagRules = DEPRECATED_TAGS.map( function(val) {
  return  {
    directory: './**/*.liquid',
    find: new RegExp(val),
    message: matches => {
      files = matches.join('\n  ')
      return log.warning(
        `deprectaed ${val} tag in the following files: \n  ${ files }`);
    }
  }
  });

const deprecatedFilterRules = DEPRECATED_FILTERS.map( function(val) {
  return {
    directory: './**/*.liquid',
    find: new RegExp(val),
    message: matches => {
      files = matches.join('\n  ')
      return log.warning(
        `deprecated ${val} filter in the following files: \n  ${ files }`);
    }
  }
});


module.exports = [ ...deprecatedTagRules, ...deprecatedFilterRules, ...baseRules];
