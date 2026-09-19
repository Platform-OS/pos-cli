/**
 * The plain backend, used when NO_COLOR or CI is set.
 *
 * Each method calls through to `console` when it runs, rather than capturing the function at
 * import time. `const Info = console.log` binds whatever `console.log` was the moment this module
 * loaded, so anything that replaces it afterwards — a test spy, a log collector, a reporter — is
 * bypassed, and this backend behaves differently from `rainbow.js`, which calls through a closure.
 * The output is identical either way; what changes is whether anyone else can observe it.
 */
const Error = (...args) => console.error(...args);
const Success = (...args) => console.log(...args);
const Quiet = (...args) => console.error(...args);
const Info = (...args) => console.log(...args);
const Warn = (...args) => console.error(...args);
const News = (...args) => console.log(...args);
const Print = txt => process.stdout.write(txt);
const Log = (...args) => console.log(...args);

export { Error, Success, Quiet, Info, Warn, News, Print, Log };
