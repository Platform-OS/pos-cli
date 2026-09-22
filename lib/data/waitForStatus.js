import logger from '../logger.js';

// A status the caller did not name used to mean "keep polling", which is only right for a
// status that is still on its way somewhere -- the device flow's `slow_down`. It is wrong
// for a status the work *ended* on: the Partner Portal finishes a module release as either
// `accepted` or `rejected`, and a rejected one was polled in silence for as long as the
// operator was willing to watch it. So an ending that is a failure is named per call site
// rather than guessed at here, `failed` being the one every existing caller already shared.
const DEFAULT_FAILURE_STATUSES = ['failed'];

const asArray = (value) => (Array.isArray(value) ? value : [value].filter((v) => v != null));

const describeError = (error) =>
  error?.statusCode ? `HTTP ${error.statusCode}` : (error?.code || error?.message || 'unknown error');

const timedOutMessage = (timeout, lastStatus, pollCount) =>
  `Timed out after ${Math.round(timeout / 1000)}s waiting for the status to change ` +
  `(${pollCount} checks, last status: ${lastStatus ?? 'unknown'}).`;

/**
 * Polls `statusCheck` until it reports a status the caller recognises.
 *
 * @param {() => Promise<any>} statusCheck resolves to the polled resource
 * @param {string|string[]} pendingStatus status(es) that mean "still working"
 * @param {string} successStatus the status to resolve on
 * @param {number} interval ms between polls
 * @param {?(response: any) => void} cb called with every response
 * @param {{ failureStatus?: string|string[], timeout?: ?number, timeoutMessage?: string,
 *           isTransient?: ?(error: any) => boolean }} options
 *   `failureStatus` names endings that are failures, rejected with the response like
 *   `failed` always was. `timeout` is the backstop for the other way a poll never ends --
 *   a status that stays pending because the work behind it died, or a request that never
 *   answers -- and rejects with an Error rather than a response, since there is no verdict
 *   to report. `isTransient` decides which failed *checks* are not answers at all: a 504
 *   from a proxy settles nothing about the work being waited on, and treating it as a
 *   verdict fails an operation that was very likely still running.
 */
const waitForStatus = (statusCheck, pendingStatus, successStatus, interval = 5000, cb = null, options = {}) => {
  const { failureStatus = [], timeout = null, timeoutMessage = null, isTransient = null } = options;
  const failureStatuses = [...DEFAULT_FAILURE_STATUSES, ...asArray(failureStatus)];

  return new Promise((resolve, reject) => {
    let pollCount = 0;
    let lastStatus = null;
    let lastError = null;
    let warnedAboutTransient = false;
    let settled = false;
    let pollTimer = null;
    let timeoutTimer = null;

    // Every exit runs through here: a poll still in flight when the deadline passes must
    // not schedule another one behind the rejection, and a timer left armed keeps the
    // process alive after the command is over.
    const settle = (settleWith, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(pollTimer);
      clearTimeout(timeoutTimer);
      settleWith(value);
    };

    const scheduleNextPoll = () => {
      if (settled) return;
      pollTimer = setTimeout(getStatus, interval);
    };

    function getStatus() {
      pollCount++;
      statusCheck()
        .then(response => {
          if (settled) return;

          try {
            logger.Debug(`[waitForStatus] Poll #${pollCount}, response: ${JSON.stringify(response)}`);
            const status = response.status.name || response.status;
            lastStatus = status;
            logger.Debug(`[waitForStatus] Status: ${status}, pending: ${pendingStatus.includes(status)}, success: ${status === successStatus}`);
            if (cb) cb(response);
            if (status === successStatus) {
              logger.Debug(`[waitForStatus] Success, resolving with access_token: ${response.access_token}`);
              settle(resolve, response);
            }
            else if (failureStatuses.includes(status)) {
              logger.Debug(`[waitForStatus] Failed with status: ${status}`);
              settle(reject, response);
            }
            else if (pendingStatus.includes(status)) {
              scheduleNextPoll();
            }
            else {
              logger.Debug(`[waitForStatus] Unknown status: ${status}, continuing poll`);
              scheduleNextPoll();
            }
          } catch(e) {
            logger.Debug(`[waitForStatus] Error processing response: ${e.message}`);
            settle(reject, e);
          }
        })
        .catch((error) => {
          if (settled) return;

          if (isTransient && isTransient(error)) {
            lastError = error;
            logger.Debug(`[waitForStatus] Transient poll failure (${describeError(error)}), asking again`);
            // Said once, not once per poll: an outage that lasts is still the same outage,
            // and a line every few seconds buries the one that mattered.
            if (!warnedAboutTransient) {
              warnedAboutTransient = true;
              logger.Warn(`Could not read the status (${describeError(error)}) -- this settles nothing, still waiting.`);
            }
            scheduleNextPoll();
            return;
          }

          logger.Debug('[waitForStatus] Poll error', error);
          settle(reject, error);
        });
    }

    if (timeout) {
      // Armed against the clock rather than counted in polls, so that a request which
      // never answers at all is caught by the same deadline as a status that never moves.
      timeoutTimer = setTimeout(() => {
        logger.Debug(`[waitForStatus] Timed out after ${timeout}ms`);
        const message = timeoutMessage || timedOutMessage(timeout, lastStatus, pollCount);
        // A deadline reached while the checks themselves were failing is a different
        // problem from one reached while they answered `pending`, and the message has to
        // be able to tell an operator which of the two they are looking at.
        settle(reject, new Error(lastError ? `${message}\nThe last check failed with: ${lastError.message}` : message));
      }, timeout);
    }

    logger.Debug(`[waitForStatus] Starting poll, interval: ${interval}ms`);
    getStatus();
  });
};


export default waitForStatus;
