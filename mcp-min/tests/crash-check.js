/**
 * Why a `/_tests/*` endpoint answered 5xx.
 *
 * A test is a Liquid partial, and one that raises takes the page rendering it down with it: the
 * runner answers **500 with an HTML error page** carrying no detail, which is the same shape an
 * unwell instance gives. Read from the status alone that is `unavailable` — "the same call may
 * work later" — so an agent is told to retry a test that can never pass, which is what an
 * evaluation did before giving up on it.
 *
 * The instance is asked a second question instead, as `jobs/errors.js` does for a 5xx on a job:
 * one answering `getInstance` while failing to run a test is not unwell, and the fault is in the
 * test. Asked only after a 5xx, so a run that works pays nothing.
 */
import Gateway from '../../lib/proxy.js';
import { ToolError } from '../tool-error.js';
import log from '../log.js';

/**
 * The probe is bounded here, not by the request: `getInstance` takes no signal, and nothing in
 * this repository gives a request a deadline yet (TASK-52). A diagnostic on a path that has
 * already failed must not be what makes the failure slow, so an instance that does not answer
 * quickly is simply one this cannot tell about.
 */
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
    `${which} while it was running, so the whole run stopped and the runner answered ${status} with an error page. `
      + 'The instance is answering for itself, so this is the test code, not the instance — calling again will do the same thing. '
      + 'The runner reports nothing about a run that did not finish: narrow with name to find which test it is.',
    { statusCode: status }
  );
}
