import { describe, test, expect } from 'vitest';
import deployAdapter, { releaseState } from '../jobs/adapters/deploy.js';
import dataExportAdapter from '../jobs/adapters/data-export.js';
import { stateOf } from '../jobs/adapters/data.js';

const REASON = 'Background job abc stopped with admin_background_job_stop';

// A job stopped from the admin GUI's background jobs (admin_background_job_stop) ends as `stopped`:
// a failure, not a finished deploy and not a data job still running.
describe('a job stopped with admin_background_job_stop', () => {
  test('is a failed deploy', () => {
    expect(releaseState('stopped')).toBe('failed');
  });

  test('is a failed data job', () => {
    expect(['import', 'export'].map(kind => stateOf('stopped', kind))).toEqual(['failed', 'failed']);
  });

  // Without the reason, a person stopping the job and a crash read the same.
  test('says it was stopped, and why, on a deploy', async () => {
    const gateway = { getStatus: async () => ({ status: 'stopped', error: { error: REASON, details: {} } }) };

    const answer = await deployAdapter.poll({ gateway, origin: 'https://example.com' }, '1', { assets: false });

    expect(answer).toMatchObject({ state: 'failed', status: 'stopped', error: `the deploy was stopped: ${REASON}` });
  });

  test('says it was stopped, and why, on an export', async () => {
    const gateway = { dataExportStatus: async () => ({ status: { name: 'stopped' }, error: REASON }) };

    const answer = await dataExportAdapter.poll({ gateway }, '1', { zip: true });

    expect(answer).toMatchObject({ state: 'failed', status: 'stopped', error: `its job was stopped: ${REASON}` });
  });

  test('a stopped asset phase is a failed deploy, not a finished one', async () => {
    const gateway = { getStatus: async () => ({ status: 'success', asset_status: 'stopped' }) };

    const answer = await deployAdapter.poll({ gateway, origin: 'https://example.com' }, '2', {});

    expect(answer.state).toBe('failed');
  });
});
