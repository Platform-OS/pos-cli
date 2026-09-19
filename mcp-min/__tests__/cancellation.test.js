/**
 * A cancelled call must stop asking the instance: tools that wait or page check `ctx.signal`.
 *
 * The waiting tool is `job-status` with `wait_ms`, and its own suite covers cancelling mid-wait;
 * what is left here is the primitive and the paging tool.
 */
import { describe, test, expect, vi } from 'vitest';
import { abortableDelay, cancelled } from '../cancellation.js';
import logsFetch from '../logs/fetch.js';
import { runTool } from '../run-tool.js';

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

    expect(await runTool(logsFetch, { ...auth }, { Gateway, signal: controller.signal })).toMatchObject({ ok: false, error: { kind: 'cancelled', code: 'CANCELLED' } });
    expect(logs).toHaveBeenCalledTimes(3);
  });
});
