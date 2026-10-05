/**
 * The background half of an MCP deploy: what it waits for, what it sends, and what it remembers
 * for `job-status` to report.
 */
import { describe, test, expect, vi, afterEach } from 'vitest';
import { deployAssetsForRelease } from '../deploy/assets-task.js';
import { trackUpload, uploadPhase, forgetUploads, MAX_TRACKED } from '../jobs/local-phases.js';

const ORIGIN = 'https://staging.example.com';
const never = () => new Promise(() => {});

afterEach(() => forgetUploads());

describe('deployAssetsForRelease', () => {
  const gatewayReturning = statuses => {
    let poll = 0;
    return { getStatus: vi.fn(async () => ({ status: statuses[Math.min(poll++, statuses.length - 1)] })) };
  };

  test('sends the manifest for the release, once the release has settled', async () => {
    const gateway = gatewayReturning(['ready_for_import', 'in_progress', 'success']);
    const deployAssets = vi.fn(async () => 'uploaded');

    const result = await deployAssetsForRelease(gateway, 41, { deployAssets, wait: async () => {} });

    expect(result).toBe('uploaded');
    expect(gateway.getStatus).toHaveBeenCalledTimes(3);
    expect(deployAssets).toHaveBeenCalledWith(gateway, { releaseId: 41 });
  });

  // One failed poll is not an answer about the release, and giving up here means the assets are
  // never uploaded at all.
  test('keeps waiting through a transient failure, and gives up on one that is an answer', async () => {
    const answers = [
      () => { throw Object.assign(new Error('socket hang up'), { name: 'RequestError' }); },
      () => { throw Object.assign(new Error('Request failed with status 503'), { statusCode: 503 }); },
      () => ({ status: 'success' })
    ];
    let poll = 0;
    const gateway = { getStatus: vi.fn(async () => answers[Math.min(poll++, answers.length - 1)]()) };
    const deployAssets = vi.fn(async () => 'uploaded');

    expect(await deployAssetsForRelease(gateway, 41, { deployAssets, wait: async () => {} })).toBe('uploaded');
    expect(gateway.getStatus).toHaveBeenCalledTimes(3);

    const refused = { getStatus: async () => { throw Object.assign(new Error('Forbidden'), { statusCode: 403 }); } };
    await expect(deployAssetsForRelease(refused, 41, { deployAssets: vi.fn(), wait: async () => {} }))
      .rejects.toThrow(/Forbidden/);
  });

  // An answer with no status in it is not a settled release: sending the manifest then is exactly
  // what waiting is meant to prevent.
  test('a response with no status in it does not count as settled', async () => {
    const deployAssets = vi.fn();
    let clock = 0;

    await expect(deployAssetsForRelease({ getStatus: async () => ({}) }, 41, {
      deployAssets, wait: async ms => { clock += ms; }, now: () => clock, pollIntervalMs: 1000, timeoutMs: 2000
    })).rejects.toThrow(/still undefined after 2000ms/);
    expect(deployAssets).not.toHaveBeenCalled();
  });

  test('uploads nothing for a release that failed', async () => {
    const deployAssets = vi.fn();

    await expect(deployAssetsForRelease(gatewayReturning(['error']), 41, { deployAssets, wait: async () => {} }))
      .rejects.toThrow(/release failed/);
    expect(deployAssets).not.toHaveBeenCalled();
  });

  // A release that never settles must not leave an upload promise pending forever: the phase it
  // leaves behind is what job-status reports.
  test('gives up on a release that never settles, without sending a manifest', async () => {
    const deployAssets = vi.fn();
    const waited = [];
    // A clock that only the waiting moves, so the deadline is tested rather than the wall clock.
    let clock = 0;

    await expect(deployAssetsForRelease(gatewayReturning(['in_progress']), 41, {
      deployAssets,
      wait: async ms => { waited.push(ms); clock += ms; },
      now: () => clock,
      pollIntervalMs: 1000,
      timeoutMs: 3000
    })).rejects.toThrow(/still in_progress after 3000ms/);

    expect(deployAssets).not.toHaveBeenCalled();
    // It polls right up to the deadline, and never waits past it.
    expect(waited).toEqual([1000, 1000, 1000]);
    expect(clock).toBe(3000);
  });

  test('the wait between polls is real time, not a busy loop', async () => {
    const started = Date.now();

    await deployAssetsForRelease(gatewayReturning(['in_progress', 'success']), 41, {
      deployAssets: async () => {}, pollIntervalMs: 120
    });

    expect(Date.now() - started).toBeGreaterThanOrEqual(110);
  });
});

describe('the phases this process remembers', () => {
  test('an upload is uploading until it settles, then done or failed', async () => {
    let finish;
    const tracked = trackUpload(ORIGIN, '1', new Promise(resolve => { finish = resolve; }));
    expect(uploadPhase(ORIGIN, '1')).toEqual({ phase: 'uploading' });

    finish();
    await tracked;
    expect(uploadPhase(ORIGIN, '1')).toEqual({ phase: 'done' });

    // With the reason: an upload can fail at packing, at S3, at the manifest or at the CDN wait,
    // and "it failed" sends the reader to the wrong place.
    await trackUpload(ORIGIN, '2', Promise.reject(new Error('S3 said no')));
    expect(uploadPhase(ORIGIN, '2')).toEqual({ phase: 'failed', error: 'S3 said no' });
  });

  test('a rejected upload does not become an unhandled rejection', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      await trackUpload(ORIGIN, '3', Promise.reject(new Error('S3 said no')));
      await new Promise(resolve => setImmediate(resolve));
    } finally {
      process.off('unhandledRejection', unhandled);
    }

    expect(unhandled).not.toHaveBeenCalled();
  });

  test('a job this process never started is unknown, and so is the same id on another instance', async () => {
    await trackUpload(ORIGIN, '1', Promise.resolve());

    expect(uploadPhase(ORIGIN, '99')).toEqual({ phase: 'unknown' });
    expect(uploadPhase('https://prod.example.com', '1')).toEqual({ phase: 'unknown' });
  });

  // An HTTP server lives as long as the editor does; without a bound this map only grows.
  test('the table is bounded, and forgets the oldest first', async () => {
    for (let n = 0; n < MAX_TRACKED + 5; n++) await trackUpload(ORIGIN, String(n), Promise.resolve());

    expect(uploadPhase(ORIGIN, '0')).toEqual({ phase: 'unknown' });
    expect(uploadPhase(ORIGIN, '4')).toEqual({ phase: 'unknown' });
    expect(uploadPhase(ORIGIN, '5')).toEqual({ phase: 'done' });
    expect(uploadPhase(ORIGIN, String(MAX_TRACKED + 4))).toEqual({ phase: 'done' });
  });
});
