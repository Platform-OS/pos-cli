import { describe, test, expect } from 'vitest';
import { releaseState } from '../jobs/adapters/deploy.js';
import { stateOf } from '../jobs/adapters/data.js';

// A job stopped from the admin GUI's background jobs (admin_background_job_stop) ends as `stopped`:
// a failure, not a finished deploy and not a data job still running.
describe('a job stopped with admin_background_job_stop', () => {
  test('is a failed deploy', () => {
    expect(releaseState('stopped')).toBe('failed');
  });

  test('is a failed data job', () => {
    expect(['import', 'export'].map(kind => stateOf('stopped', kind))).toEqual(['failed', 'failed']);
  });
});
