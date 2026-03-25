import ora from 'ora';
import logger from './logger.js';

/**
 * Creates a spinner, starts it, runs fn(spinner), and catches any thrown error
 * by calling spinner.fail(). The spinner is passed to fn so the action can
 * call spinner.succeed() / spinner.warn() itself at the right moments.
 *
 * The spinner object passed to fn exposes:
 *   spinner.start(text?)   — update label and (re)start the spinner
 *   spinner.succeed(text?) — stop with a ✔ check mark
 *   spinner.warn(text?)    — stop with a ⚠ warning symbol
 *   spinner.fail(text?)    — stop with a ✖ cross; called automatically on thrown errors
 */
/**
 * Runs fn(spinner) with a managed spinner. The callback owns all spinner state
 * transitions (succeed/warn/fail) during its execution. On an unhandled error
 * withSpinner calls spinner.fail() automatically and sets process.exitCode = 1.
 *
 * Returns the resolved value of fn() so callers can act on results (e.g. --json output).
 * Returns undefined on error (process.exitCode is set to 1).
 */
const withSpinner = async (label, fn) => {
  // ora defaults to process.stderr; do not override to stdout to avoid corrupting
  // piped output (e.g. pos-cli modules install | jq).
  const spinner = ora({ text: label });
  spinner.start();
  try {
    return await fn(spinner);
  } catch (e) {
    spinner.fail(e.message);
    logger.Debug(e);
    process.exitCode = 1;
  }
};

export { withSpinner };
