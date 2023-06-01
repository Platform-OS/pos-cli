const chalk = require('chalk');

const Error = message => console.error(chalk.red.bold(message));
const Success = message => console.log(chalk.green.bold(message));
const Quiet = message => console.log(chalk.grey(message));
const Info = message => console.log(chalk.bold(message));
const Warn = message => console.log(chalk.yellow.dim(message));
const News = message => console.log(chalk.cyan(message));
const Print = txt => process.stdout.write(txt);

module.exports = { Error, Success, Quiet, Info, Warn, News, Print };
