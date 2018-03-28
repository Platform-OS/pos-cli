const chalk = require('chalk');

/*
 * INCLUDE_TIMESTAMP=true prepends UTC timestamp to log lines
 * NO_COLOR=true forwards all calls to console.log with monohromatic output
 */
var makeLogger = (fun) => {
  var logger = (m) => {
    var date = new Date().toISOString();

    if (process.env.INCLUDE_TIMESTAMP === 'true') {
      if (m instanceof Array) {
        m.unshift(date);
      } else {
        m = [date, m];
      }
      m = m.join('\t');
    }

    if (process.env.NO_COLOR === 'true') {
      console.log(m);
    } else {
      fun(m);
    }
  };
  return logger;
};

const Error = makeLogger((message) => {
  console.error(chalk.red.bold(message));
});

const Success = makeLogger((message) => {
  console.error(chalk.green.bold(message));
});

const Quiet = makeLogger((message) => {
  console.log(chalk.grey(message));
});

const Info = makeLogger((message) => {
  console.error(chalk.bold(message));
});

const Done = makeLogger((message) => {
  console.log(chalk.gray(message), chalk.green.bold('done'));
});

const Warn = makeLogger((message) => {
  console.log(chalk.yellow.dim(message));
});

const Banner = () => {
  console.log(`

 ######                                                  #######  #####
 #     # #        ##   ##### ######  ####  #####  #    # #     # #     #
 #     # #       #  #    #   #      #    # #    # ##  ## #     # #
 ######  #      #    #   #   #####  #    # #    # # ## # #     #  #####
 #       #      ######   #   #      #    # #####  #    # #     #       #
 #       #      #    #   #   #      #    # #   #  #    # #     # #     #
 #       ###### #    #   #   #       ####  #    # #    # #######  #####

 `);
};

module.exports = { Error, Success, Info, Banner, Done, Quiet, Warn };
