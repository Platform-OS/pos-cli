const Error = console.error;
const Success = console.log;
const Quiet = console.log;
const Info = console.log;
const Warn = console.log;
const News = message => console.log(chalk.cyan(message));
const Print = txt => process.stdout.write(txt);

module.exports = { Error, Success, Quiet, Info, Warn, News, Print };
