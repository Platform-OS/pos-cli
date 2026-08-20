/**
 * Unit tests for the asset-report poller.
 *
 * The release is already `success` when the asset manifest is sent, so the poller
 * must key off `asset_status`, not the release status — otherwise the Asset row in
 * the deploy report appears or vanishes depending on whether the asset phase
 * happened to finish first.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import waitForAssetReport from '#lib/deploy/waitForAssetReport.js';
import logger from '#lib/logger.js';
import { makeSpinner } from '#test/utils/spinnerMock.js';

const REPORT = { upserted: 8, deleted: 0, skipped: 271 };
// Keeps the polling cases off the wall clock; the poller's own defaults are 1s/10min.
const fastOpts = { pollInterval: 1, timeout: 500 };

describe('waitForAssetReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns null without polling when there is no gateway or release id', async () => {
    const gateway = { getStatus: vi.fn() };

    expect(await waitForAssetReport(null, 12345)).toBe(null);
    expect(await waitForAssetReport(gateway, undefined)).toBe(null);
    expect(gateway.getStatus).not.toHaveBeenCalled();
  });

  test('returns the asset report when it is already there', async () => {
    const gateway = { getStatus: vi.fn().mockResolvedValue({ asset_status: 'success', asset_report: REPORT }) };

    expect(await waitForAssetReport(gateway, 12345)).toEqual(REPORT);
    expect(gateway.getStatus).toHaveBeenCalledTimes(1);
  });

  test('keeps polling while the asset phase is in progress, reporting elapsed time', async () => {
    const spinner = { ...makeSpinner(), text: 'Deploying' };
    const gateway = {
      getStatus: vi.fn()
        .mockResolvedValueOnce({ asset_status: 'in_progress' })
        .mockResolvedValueOnce({ asset_status: 'success', asset_report: REPORT })
    };

    expect(await waitForAssetReport(gateway, 12345, { ...fastOpts, spinner })).toEqual(REPORT);
    expect(gateway.getStatus).toHaveBeenCalledTimes(2);
    expect(spinner.text).toMatch(/^Waiting for asset processing \(\d+:\d\d\)…$/);
  });

  test('stops immediately when the server does not report asset status', async () => {
    const gateway = { getStatus: vi.fn().mockResolvedValue({ status: 'success', report: {} }) };

    expect(await waitForAssetReport(gateway, 12345)).toBe(null);
    expect(gateway.getStatus).toHaveBeenCalledTimes(1);
  });

  test('surfaces an asset error instead of waiting for a report that will never come', async () => {
    const gateway = {
      getStatus: vi.fn().mockResolvedValue({
        asset_status: 'error',
        asset_error: { error: 'Something went wrong during asset create', details: {} }
      })
    };

    expect(await waitForAssetReport(gateway, 12345)).toBe(null);
    expect(gateway.getStatus).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logger).Error).toHaveBeenCalledWith(
      'Asset deploy failed: Something went wrong during asset create',
      { exit: false }
    );
  });

  test('gives up with a warning when the asset phase never settles', async () => {
    const gateway = { getStatus: vi.fn().mockResolvedValue({ asset_status: 'in_progress' }) };

    expect(await waitForAssetReport(gateway, 12345, { pollInterval: 1, timeout: 50 })).toBe(null);
    expect(vi.mocked(logger).Warn).toHaveBeenCalledWith(
      'Timed out waiting for the asset report — assets may still be processing.'
    );
  });

  test('gives up quietly when the status call throws', async () => {
    const gateway = { getStatus: vi.fn().mockRejectedValue(new Error('boom')) };

    expect(await waitForAssetReport(gateway, 12345)).toBe(null);
    expect(vi.mocked(logger).Debug).toHaveBeenCalledWith('Could not fetch asset report: boom');
  });
});
