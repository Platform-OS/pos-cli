const Error = console.error;
const Success = console.log;
const Quiet = console.log;
const Info = console.log;
const Warn = console.log;
const Print = txt => process.stdout.write(txt);

module.exports = { Error, Success, Quiet, Info, Warn, Print };
