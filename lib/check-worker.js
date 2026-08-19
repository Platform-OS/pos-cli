import { parentPort, workerData } from 'node:worker_threads';
import { MISSING_PACKAGE_MESSAGE } from './check-messages.js';

/**
 * The linter runs here rather than on the main thread so the main thread's event loop
 * stays free: that keeps the spinner animating and, more importantly, keeps Ctrl+C
 * instant. See lib/ora.js for why a spinner makes Ctrl+C depend on a free event loop.
 *
 * Nothing here is allowed to exit the process or write to the terminal: the main thread
 * owns the spinner and all output, and gets everything through postMessage.
 */

/**
 * A fixable offense carries `fix` / `suggest` closures, and structured clone cannot copy
 * functions. Autofix runs on this side for that reason, so only the fields the reporter
 * actually prints need to cross back.
 */
const toPlainOffense = (offense) => ({
  check: offense.check,
  message: offense.message,
  uri: offense.uri,
  severity: offense.severity,
  start: { line: offense.start.line, character: offense.start.character },
  end: { line: offense.end.line, character: offense.end.character }
});

const post = (message) => parentPort.postMessage(message);
const progress = (message) => message && post({ type: 'progress', message });

const { path: checkPath, autoFix, checks } = workerData;

/**
 * Wrapped in a function purely so the early exits can `return`. Calling process.exit()
 * here instead would risk the last postMessage never reaching the main thread, which
 * would turn a clear "unknown check" message into a worker-died error.
 */
const main = async () => {
  let platformosCheck;
  let platformosCommon;
  try {
    platformosCheck = await import('@platformos/platformos-check-node');
    platformosCommon = await import('@platformos/platformos-common');
  } catch {
    return post({ type: 'userError', message: MISSING_PACKAGE_MESSAGE });
  }

  if (checks && checks.length > 0) {
    const validNames = new Set(platformosCheck.allChecks.map((c) => c.meta.code));
    const unknown = checks.filter((name) => !validNames.has(name));
    if (unknown.length > 0) {
      const available = Array.from(validNames).sort().join(', ');
      return post({
        type: 'userError',
        message:
          `Unknown check${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}\n` +
          `Available checks: ${available}`
      });
    }
  }

  let result;
  try {
    result = await platformosCheck.appCheckRun(checkPath, undefined, progress);
  } catch (error) {
    // A path that is not a project root is a message for the caller, not a crash. Matched on
    // `code`, not `instanceof`: an older platformos-check may not export the class at all.
    if (error?.code === 'PLATFORMOS_PROJECT_ROOT') {
      return post({ type: 'userError', message: error.message });
    }
    throw error;
  }

  let offenses = checks
    ? result.offenses.filter((o) => checks.includes(o.check))
    : result.offenses;

  if (autoFix && offenses.length > 0) {
    progress(`Applying automatic fixes to ${offenses.length} offense${offenses.length === 1 ? '' : 's'}...`);
    await platformosCheck.autofix(result.app, offenses);

    // Re-run the check after autofix to get updated offenses
    progress('Re-checking after fixes...');
    const recheck = await platformosCheck.appCheckRun(checkPath);
    offenses = recheck.offenses;
  }

  // "No offenses" and "nothing was examined" are different outcomes; the count lets the reporter
  // tell them apart. From the first run's app — autofix rewrites content, never the file set.
  post({
    type: 'result',
    offenses: offenses.map(toPlainOffense),
    filesChecked: result.app.filesByUri.size,
    // Imported from platformos-common, the single owner of file identity — see its
    // identity-ownership guard. Using the walker's own constants keeps the explanation from
    // drifting from the behaviour it explains.
    sourceExtensions: platformosCommon.SOURCE_FILE_EXTENSIONS,
    sourceLocations: platformosCommon.APP_SOURCE_SUBTREES
  });
};

await main();
