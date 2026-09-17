/**
 * A cancelled call must stop asking the instance: tools that wait or page check `ctx.signal`.
 */
import { describe, test, expect, vi } from 'vitest';
import { abortableDelay, cancelled } from '../cancellation.js';
import deployWait from '../deploy/wait.js';
import logsFetch from '../logs/fetch.js';

const auth = { url: 'https://instance.example.com', email: 'a@b.c', token: 't' };

describe('abortableDelay', () => {
  test('waits the full time when nothing aborts it', async () => {
    const started = Date.now();
    await abortableDelay(120, new AbortController().signal);
    expect(Date.now() - started).toBeGreaterThanOrEqual(110);
  });

  test('ends as soon as the signal aborts', async () => {
    const controller = new AbortController();
    const started = Date.now();
    setTimeout(() => controller.abort(), 30);
    await abortableDelay(5000, controller.signal);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  test('does not wait at all for a signal that has already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const started = Date.now();
    await abortableDelay(5000, controller.signal);
    expect(Date.now() - started).toBeLessThan(50);
  });
});

describe('deploy-wait', () => {
  test('stops polling when the call is cancelled, even mid-interval', async () => {
    const controller = new AbortController();
    const getStatus = vi.fn(async () => ({ status: 'ready_for_import' }));
    const Gateway = class { getStatus = getStatus; };

    const result = deployWait.handler({ ...auth, id: '1', intervalMs: 60000 }, { Gateway, signal: controller.signal });
    await vi.waitFor(() => expect(getStatus).toHaveBeenCalledTimes(1));
    const started = Date.now();
    controller.abort();

    expect(await result).toEqual(cancelled());
    expect(Date.now() - started).toBeLessThan(1000);
    expect(getStatus).toHaveBeenCalledTimes(1);
  });

  test('still waits for the release without a signal', async () => {
    const statuses = ['ready_for_import', 'success'];
    const Gateway = class { getStatus = async () => ({ status: statuses.shift() }); };

    expect(await deployWait.handler({ ...auth, id: '1', intervalMs: 200 }, { Gateway })).toMatchObject({ ok: true, data: { status: 'success' } });
  });
});

describe('logs-fetch', () => {
  test('stops paging when the call is cancelled', async () => {
    const controller = new AbortController();
    let page = 0;
    const logs = vi.fn(async () => {
      page += 1;
      if (page === 3) controller.abort();
      return { logs: [{ id: page, message: `row ${page}` }] };
    });
    const Gateway = class { logs = logs; };

    expect(await logsFetch.handler({ ...auth }, { Gateway, signal: controller.signal })).toEqual(cancelled());
    expect(logs).toHaveBeenCalledTimes(3);
  });
});
