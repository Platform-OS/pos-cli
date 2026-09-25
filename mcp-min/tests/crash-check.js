/**
 * Why a `/_tests/*` endpoint answered 5xx: a test that raised looks exactly like an unwell
 * instance, and read from the status alone it becomes `unavailable` — "retry later" — for a run
 * that can never pass. The instance is asked a second question instead, as `jobs/errors.js` does
 * for a job. Only after a 5xx, so a run that works pays nothing.
 *
 * It is then asked a third: the runner reports nothing about a run that did not finish, but the
 * instance writes the failure to its error log with the file and line it happened on. An
 * evaluation found the cause that way by hand, one `logs-fetch` after the crash; doing it here
 * turns "a test raised, narrow with name to find which" into the path, the line and the message.
 */
import Gateway from '../../lib/proxy.js';
import { ToolError } from '../tool-error.js';
import { cursorForMs } from '../../lib/logRowId.js';
import { abortableDelay } from '../cancellation.js';
import log from '../log.js';

// Much shorter than the deadline `apiRequest` gives an ordinary request: a diagnostic on a path
// that has already failed must not be what makes the failure slow.
const PROBE_MS = 5000;

/**
 * How long to wait for the crash to reach the log, and how often to look.
 *
 * Rows are not readable the instant they are written. Measured 2026-09-25 over three crashed runs
 * against a live instance, the row appeared 1.4 s, 2.3 s and 2.7 s after the request was sent —
 * so a single read straight after the 500 finds nothing, and five seconds covers it with room.
 * The whole cost lands on a run that has already failed.
 */
const LOG_LOOKUP_MS = 5000;
const LOG_POLL_MS = 400;

/** The run's own log rows carry its URL, so a second run in flight cannot be mistaken for this one. */
const RUN_PATH = '/_tests/run.js';

// A stack is one frame per nested partial; the ones after the first say how the test reached it.
const MAX_FRAMES = 5;

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
 * Whether a row is this run's failure.
 *
 * Two conditions, and both are the platform's rather than the tests module's. `data.type` is the
 * exception class, written only by the instance's own error handler — measured 2026-09-25, an
 * error row carries `type` and `message` inside `data` while a `{% log %}` row carries neither, so
 * this cannot mistake a test's own logging for the fault that stopped it. `data.context.url` is
 * the request that produced the row, which is how it is tied to this run and not another.
 *
 * The host is not compared: every row read here came from this instance's log, and an instance
 * reachable under more than one name would otherwise match nothing.
 */
const failureOf = (row, filter) => {
  const url = row?.data?.context?.url;
  if (typeof url !== 'string' || row?.data?.type === undefined) return false;

  try {
    const parsed = new URL(`https://${url}`);
    return parsed.pathname === RUN_PATH && (parsed.searchParams.get('name') ?? undefined) === filter;
  } catch {
    return false;
  }
};

const frames = (stack) => (Array.isArray(stack) ? stack : [])
  .slice(0, MAX_FRAMES)
  .filter(frame => frame && typeof frame.path === 'string')
  .map(({ path, line }) => ({ path, ...(Number.isFinite(line) && { line }) }));

/** The first row this run wrote that the instance recognised as a failure, or null. */
async function crashInLog(gateway, { filter, startedAtMs, pollMs, deadlineMs, signal }) {
  if (typeof gateway?.logs !== 'function' || !Number.isFinite(startedAtMs)) return null;

  // A little before the request: the row is stamped when the instance handled it, and the two
  // clocks are not the same one.
  const cursor = cursorForMs(startedAtMs - 2000);
  const deadline = Date.now() + deadlineMs;

  for (;;) {
    if (signal?.aborted) return null;

    const rows = (await gateway.logs({ lastId: cursor }))?.logs;
    const row = Array.isArray(rows) ? rows.find(candidate => failureOf(candidate, filter)) : undefined;
    if (row) {
      const { type, message, stack } = row.data;
      return { type, message, stack: frames(stack) };
    }

    if (Date.now() + pollMs >= deadline) return null;
    await abortableDelay(pollMs, signal);
  }
}

/** `path:line`, or just the path when the instance did not say which line. */
const at = ([frame]) => (frame ? `${frame.path}${Number.isFinite(frame.line) ? `:${frame.line}` : ''}` : null);

/**
 * @param {number} status
 * @param {object} [options]
 * @param {string} [options.filter] the `name` the run was asked for, when it was given one
 * @param {number} [options.startedAtMs] when the run was sent, for finding its rows in the log
 * @returns {Promise<ToolError|null>} the error to throw in place of the 5xx, or null to keep it.
 */
export async function crashedTestRun(status, auth, ctx = {}, { filter, startedAtMs } = {}) {
  if (status < 500) return null;

  const GatewayCtor = ctx.Gateway || Gateway;
  const gateway = new GatewayCtor({ url: auth.url, token: auth.token, email: auth.email });
  if (!(await instanceAnswersForItself(gateway))) return null;

  // Best effort throughout: a diagnostic that throws would replace a bad answer with no answer.
  const crash = await crashInLog(gateway, {
    filter,
    startedAtMs,
    pollMs: ctx.pollIntervalMs ?? LOG_POLL_MS,
    deadlineMs: ctx.crashLookupMs ?? LOG_LOOKUP_MS,
    signal: ctx.signal
  }).catch((err) => {
    log.debug('could not read the crash out of the log', { error: String(err) });
    return null;
  });

  const which = filter ? `A test matching '${filter}' raised` : 'A test raised';
  const where = crash && at(crash.stack);

  return ToolError.project(
    'TEST_RUN_CRASHED',
    `${which} while it was running, so the run stopped and the runner answered ${status} with an error page. `
      + 'The instance is answering other requests, so the fault is in what ran rather than in the instance being down. '
      + (where
        ? `The instance logged it at ${where}: ${crash.type}${crash.message ? ` — ${crash.message}` : ''}`
        : 'The runner reports nothing about a run that did not finish; the instance records Liquid failures in its error log, '
          + `so logs-fetch with since set to just before this call is where the file and line are.${filter ? '' : ' Narrowing with name says which test it is.'}`),
    {
      statusCode: status,
      ...(crash && {
        error: { type: crash.type, ...(crash.message !== undefined && { message: crash.message }) },
        // Innermost first: the first frame is where it raised, the rest are how the test got there.
        stack: crash.stack
      })
    }
  );
}
