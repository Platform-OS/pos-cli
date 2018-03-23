const chalk = require('chalk');

const Error = (message) => {
  console.error(chalk.red.bold(message));
};

const Success = (message) => {
  console.error(chalk.green.bold(message));
};

const Quiet = (message) => {
  console.log(chalk.grey(message));
};

const Info = (message) => {
  console.error(chalk.bold(message));
};

const Done = (message) => {
  console.log(chalk.gray(message), chalk.green.bold('done'));
};

const Warn = (message) => {
  console.log(chalk.yellow.dim(message));
};

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
