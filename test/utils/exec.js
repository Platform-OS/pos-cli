import { execFile } from 'child_process';
import cliScript from './cliPath.js';

// Every child process in the suite is spawned through execFile with an argv array, never
// through a shell. The repo's absolute path is part of every command here, so a shell would
// re-split it on spaces and re-read any metacharacter in it — the suite would break on a
// checkout under a path like "C:\My Projects\pos-cli".
const run = (file, args, opts = {}, callback) => {
  let stepError = null;

  return new Promise((resolve, reject) => {
    const child = execFile(file, args, opts, (err, stdout, stderr) => {
      if (stepError) return reject(stepError);
      // A child killed by opts.timeout reports code null; surface it as a failure rather than
      // as "no exit code", which reads as success at the call sites that only check `code`.
      resolve({ stdout, stderr, code: err ? (err.code ?? 1) : 0, child });
    });

    if (callback) {
      Promise.resolve(callback(child)).catch(err => {
        stepError = err;
        child.stdout?.destroy();
        child.stderr?.destroy();
        child.kill();
      });
    }
  });
};

// `args` is the pos-cli argument list: an array, or — for the many call sites where every
// argument is a single token — a whitespace-separated string. Pass an array whenever an
// argument can contain a space, a filesystem path above all.
const toArgv = (args) => {
  if (Array.isArray(args)) return args;
  if (args === undefined || args === null) return [];
  return String(args).split(/\s+/).filter(Boolean);
};

const cli = (args, opts, callback) => run(process.execPath, [cliScript, ...toArgv(args)], opts, callback);

// Writes to a CLI that prompts, for the tests that used to pipe `echo` into it. The child can
// exit before it ever reads stdin (on a validation error, say), which turns the write into
// EPIPE — not a test failure, so it is swallowed.
const feedStdin = (text) => (child) => {
  child.stdin.on('error', () => {});
  try {
    child.stdin.write(text);
    child.stdin.end();
  } catch {
    // child already gone
  }
};

export default cli;
export { cli, run, feedStdin };
