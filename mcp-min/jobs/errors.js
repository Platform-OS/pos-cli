/** The instance does not know this job: a job_id from another instance, or one already reaped. */
export class JobNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'JobNotFoundError';
  }
}

/**
 * Runs one status request. A 404 means the instance has no such job — a job_id minted elsewhere,
 * or one already reaped — which is a bad argument, not a failed job, so it is reported as its own
 * error rather than as "the job failed".
 *
 * @param {() => Promise<unknown>} request
 * @param {{ kind: string, id: string }} job
 */
export async function statusRequest(request, { kind, id }) {
  try {
    return await request();
  } catch (err) {
    if (err?.statusCode === 404) throw new JobNotFoundError(`the ${kind} job ${id} is not on this instance`);
    throw err;
  }
}
