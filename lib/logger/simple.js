const Error = console.error;
const Success = console.log;
const Quiet = console.log;
const Info = console.error;
const Warn = console.warn;
const Print = txt => process.stdout.write(txt);

module.exports = { Error, Success, Quiet, Info, Warn, Print };
