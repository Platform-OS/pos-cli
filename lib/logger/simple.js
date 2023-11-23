const Error = console.error;
const Success = console.log;
const Quiet = console.error;
const Info = console.log;
const Warn = console.error;
const News = console.log;
const Print = txt => process.stderr.write(txt);
const Log = console.log;

module.exports = { Error, Success, Quiet, Info, Warn, News, Print, Log };
