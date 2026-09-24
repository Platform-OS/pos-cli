/**
 * Why a `/_tests/*` endpoint answered 5xx: a test that raised looks exactly like an unwell
 * instance, and read from the status alone it becomes `unavailable` — "retry later" — for a run
 * that can never pass. The instance is asked a second question instead, as `jobs/errors.js` does
 * for a job. Only after a 5xx, so a run that works pays nothing.
 */
import Gateway from '../../lib/proxy.js';
import { ToolError } from '../tool-error.js';
import log from '../log.js';

// Much shorter than the deadline `apiRequest` gives an ordinary request: a diagnostic on a path
// that has already failed must not be what makes the failure slow.
const PROBE_MS = 5000;

async function instanceAnswersForItself(gateway) {
  let timer;
  try {
    const tooSlow = new Promise((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`no answer in ${PROBE_MS}ms`)), PROBE_MS);
      timer.unref?.();
    });
    await Promise.race([gateway.getInstance(), tooSlow]);
    return true;
  } catch (err) {
    // Could not tell, so the caller's original error stands rather than becoming a worse guess.
    log.debug('tests health probe failed, leaving the error as it was', { error: String(err) });
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {number} status
 * @param {string} [filter] the `name` the run was asked for, when it was given one
 * @returns {Promise<ToolError|null>} the error to throw in place of the 5xx, or null to keep it.
 */
export async function crashedTestRun(status, auth, ctx = {}, filter) {
  if (status < 500) return null;

  const GatewayCtor = ctx.Gateway || Gateway;
  if (!(await instanceAnswersForItself(new GatewayCtor({ url: auth.url, token: auth.token, email: auth.email })))) return null;

  const which = filter ? `A test matching '${filter}' raised` : 'A test raised';
  return ToolError.project(
    'TEST_RUN_CRASHED',
    `${which} while it was running, so the run stopped and the runner answered ${status} with an error page. `
      + 'The instance is answering other requests, so the fault is in what ran rather than in the instance being down. '
      + 'The runner reports nothing about a run that did not finish: narrow with name to find which test it is.',
    { statusCode: status }
  );
}
