import log from '../log.js';
import { isPartnerPortalUnavailable } from '../../lib/utils/partnerPortal.js';

/** The instance does not know this job: a job_id from another instance, or one already reaped. */
export class JobNotFoundError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'JobNotFoundError';
    if (details !== undefined) this.details = details;
  }
}

/** A 5xx: the request was not refused on its merits, so on its own it decides nothing. */
export const isServerError = err => err?.statusCode >= 500;

/**
 * Runs one status request. A 404 is a bad argument, not a failed job, so it is reported as its own
 * error rather than as "the job failed".
 *
 * A 404 is the unambiguous way to say it, and not the way platformOS does — see `absentOrUnwell`.
 */
export async function statusRequest(request, { kind, id }) {
  try {
    return await request();
  } catch (err) {
    if (err?.statusCode === 404) throw new JobNotFoundError(`the ${kind} job ${id} is not on this instance`);
    throw err;
  }
}

/**
 * Which of the two things a 5xx meant: the job is not here, or the instance is unwell.
 *
 * platformOS answers **503**, not 404, for a release, import or export id it does not have — the
 * same generic page either way, so the response cannot separate them. The instance is asked a
 * second question instead: one answering `getInstance` while refusing this one job is not unwell.
 *
 * The caller asks about the job twice before calling this. Reporting "no such job" for a deploy
 * that was briefly slow would stop an agent waiting on a deploy that is running, which is the
 * worse error; a probe that fails for any reason leaves the original error untouched.
 *
 * @returns the error to throw: the original one, or a `JobNotFoundError` in its place.
 */
export async function absentOrUnwell(err, { kind, id, health }) {
  if (!isServerError(err)) return err;

  // The one 503 the instance explains: the Partner Portal, which validates every token, did not
  // answer. It says nothing about the job.
  if (isPartnerPortalUnavailable(err)) return err;

  try {
    await health();
  } catch (probeFailed) {
    // Anything at all: this decides how a failure is reported and must not become a second one.
    log.debug('job-status health probe failed, leaving the error as it was', { kind, error: String(probeFailed) });
    return err;
  }

  return new JobNotFoundError(
    `the ${kind} job ${id} is not on this instance: the instance is answering for itself, `
      + `but answers ${err.statusCode} for this job, which is how it reports a job it does not have`,
    { statusCode: err.statusCode, instanceResponding: true }
  );
}
