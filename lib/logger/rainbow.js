const chalk = require('chalk');

const Error = message => console.error(chalk.red.bold(message));
const Success = message => console.log(chalk.green.bold(message));
const Quiet = message => console.error(chalk.grey(message));
const Info = message => console.log(chalk.bold(message));
const Warn = message => console.error(chalk.yellow.dim(message));
const News = message => console.error(chalk.cyan(message));
const Print = txt => process.stderr.write(txt);
const Log = console.log;

module.exports = { Error, Success, Quiet, Info, Warn, News, Print, Log };
