const chalk = require('chalk');
const DEPRECATED_TAGS = require('./deprecatedTags');
const DEPRECATED_FILTERS = require('./deprecatedFilters');

const log = {
  warning: msg => console.log(chalk.yellow(`[Audit Warn] ${msg}`)),
  info: msg => console.log(chalk.blue(`[Audit Info] ${msg}`)),
  error: msg => console.log(chalk.bold.red(`[Audit Error] ${msg}`))
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

module.exports = [
  {
    directory: 'views/pages/**/*.liquid',
    find: /^enable_profiler\: true$/,
    message: matches => {
      log.warning(`Found "enable_profiler: true" setting in ${matches.length} files. This will result in a performance hit.`);
    }
  },
  {
    directory: 'views/**/*.liquid',
    find: new RegExp(DEPRECATED_TAGS.join('|')),
    message: () => {
      return log.warning(`You are using deprecated liquid tags.
      \nLook for those in your code: ${DEPRECATED_TAGS.join(', ')}`);
    }
  },
  {
    directory: 'views/**/*.liquid',
    find: new RegExp(DEPRECATED_FILTERS.join('|') + ' |'),
    message: () => {
      return log.warning(
        `You are using deprecated liquid filters.
        \nLook for those in your code: ${DEPRECATED_FILTERS.join(', ')}`
      );
    }
  }
];
