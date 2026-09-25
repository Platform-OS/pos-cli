/**
 * The job_id: what a starter mints and `job-status` reads back.
 *
 * It travels through the model, so it is treated as hostile input on the way in — a handle that
 * does not parse exactly must not reach an adapter, and nothing in it may decide where a request
 * goes or which credentials are used.
 */
import { describe, test, expect } from 'vitest';
import { mint, mintFor, parse, originOf, JOB_KINDS } from '../jobs/handle.js';
import adapters from '../jobs/adapters/index.js';

const ORIGIN = 'https://instance.example.com';

const decode = handle => JSON.parse(Buffer.from(handle.slice('pjob1_'.length), 'base64url').toString('utf8'));
const reencode = value => 'pjob1_' + Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');

describe('mint', () => {
  test.each(JOB_KINDS)('%s round-trips through parse', (kind) => {
    const parsed = parse(mint({ kind, id: 41, origin: ORIGIN }));

    expect(parsed).toEqual({ valid: true, job: { kind, id: '41', origin: ORIGIN, flags: {} } });
  });

  test('carries the flags its kind has', () => {
    expect(decode(mint({ kind: 'data-export', id: '1', origin: ORIGIN, flags: { zip: true } })).flags).toEqual({ zip: true });
    expect(decode(mint({ kind: 'deploy', id: '1', origin: ORIGIN, flags: { assets: false } })).flags).toEqual({ assets: false });
  });

  // Only our own starters call mint, so a name this kind does not have is a typo in one of them —
  // and `{ asset: true }` for `{ assets: true }` would mint a handle that reports the wrong thing
  // rather than one that fails.
  test('refuses a flag its kind does not have, rather than dropping it', () => {
    expect(() => mint({ kind: 'data-clean', id: '1', origin: ORIGIN, flags: { zip: true } }))
      .toThrow(/data-clean has no flag zip/);
    expect(() => mint({ kind: 'deploy', id: '1', origin: ORIGIN, flags: { asset: true } }))
      .toThrow(/deploy has no flag asset/);
  });

  test('takes the origin of a URL, not the URL', () => {
    expect(decode(mint({ kind: 'deploy', id: '1', origin: 'https://instance.example.com/api/app_builder?x=1' })).origin).toBe(ORIGIN);
  });

  test.each([
    ['an unknown kind', { kind: 'rm-rf', id: '1', origin: ORIGIN }],
    ['no origin', { kind: 'deploy', id: '1', origin: undefined }],
    ['a non-http origin', { kind: 'deploy', id: '1', origin: 'file:///etc/passwd' }],
    ['an id with a slash', { kind: 'deploy', id: '../../1', origin: ORIGIN }],
    ['an empty id', { kind: 'deploy', id: '', origin: ORIGIN }],
    ['a flag of the wrong type', { kind: 'data-export', id: '1', origin: ORIGIN, flags: { zip: 'yes' } }]
  ])('refuses %s', (_label, job) => {
    expect(() => mint(job)).toThrow(TypeError);
  });

  // A starter has already started the job by the time it mints; failing there would report a
  // deploy as failed because its handle could not be built.
  test('mintFor answers undefined rather than throwing', () => {
    expect(mintFor({ kind: 'deploy', id: '1', origin: ORIGIN })).toMatch(/^pjob1_/);
    expect(mintFor({ kind: 'deploy', id: '1', origin: 'not a url' })).toBeUndefined();
    expect(mintFor({ kind: 'nope', id: '1', origin: ORIGIN })).toBeUndefined();
  });
});

describe('parse refuses', () => {
  const invalid = [
    ['something that is not a string', 41, 'a job_id is the value a starter returned'],
    ['a string without the prefix', 'pjob2_abc', 'a job_id is the value a starter returned'],
    ['the prefix alone', 'pjob1_', 'not readable'],
    ['base64url that is not JSON', 'pjob1_' + Buffer.from('nope').toString('base64url'), 'not readable'],
    ['a JSON array', reencode([{ kind: 'deploy' }]), 'not readable'],
    ['a JSON string', reencode('deploy'), 'not readable'],
    ['null', reencode(null), 'not readable'],
    ['an unknown kind', reencode({ kind: 'rm-rf', id: '1', origin: ORIGIN }), 'unknown kind of job'],
    ['a prototype name as the kind', reencode({ kind: 'constructor', id: '1', origin: ORIGIN }), 'unknown kind of job'],
    ['an id that is not a string', reencode({ kind: 'deploy', id: 1, origin: ORIGIN }), 'job id in it is not usable'],
    ['an id with a path in it', reencode({ kind: 'deploy', id: '../secrets', origin: ORIGIN }), 'job id in it is not usable'],
    ['a URL instead of an origin', reencode({ kind: 'deploy', id: '1', origin: `${ORIGIN}/deploys/1` }), 'not an origin'],
    ['an origin with a userinfo component', reencode({ kind: 'deploy', id: '1', origin: 'https://user:pw@instance.example.com' }), 'not an origin'],
    ['a flag the kind does not have', reencode({ kind: 'deploy', id: '1', origin: ORIGIN, flags: { zip: true } }), 'flag deploy does not have: zip'],
    ['a flag of the wrong type', reencode({ kind: 'data-export', id: '1', origin: ORIGIN, flags: { zip: 1 } }), 'zip flag must be boolean'],
    ['flags that are not an object', reencode({ kind: 'deploy', id: '1', origin: ORIGIN, flags: [] }), 'flags are not readable'],
    ['fields we did not put there', reencode({ kind: 'deploy', id: '1', origin: ORIGIN, url: 'https://evil.example.com' }), 'unexpected fields: url']
  ];

  test.each(invalid)('%s', (_label, jobId, expected) => {
    const result = parse(jobId);

    expect(result.valid).toBe(false);
    expect(result.message).toContain(expected);
  });

  test('every refusal explains itself without echoing the handle back', () => {
    for (const [, jobId] of invalid) {
      const { message } = parse(jobId);
      expect(message).toMatch(/^[a-z]/);
      expect(message).not.toContain('pjob1_');
    }
  });
});

describe('originOf', () => {
  test.each([
    ['https://a.example.com/x', 'https://a.example.com'],
    ['http://127.0.0.1:3000', 'http://127.0.0.1:3000'],
    ['file:///etc/passwd', null],
    ['javascript:alert(1)', null],
    ['not a url', null],
    [undefined, null]
  ])('%s → %s', (url, expected) => {
    expect(originOf(url)).toBe(expected);
  });
});

describe('a handle outlives the process that minted it', () => {
  // MCP clients restart stdio servers while the agent keeps its conversation, so a handle from
  // one process has to be readable by the next. Pinned as the literal a released server minted:
  // nothing here may change how one is encoded without this failing.
  const MINTED_ELSEWHERE = 'pjob1_eyJraW5kIjoiZGF0YS1leHBvcnQiLCJpZCI6Ijc3Iiwib3JpZ2luIjoiaHR0cHM6Ly9pbnN0YW5jZS5leGFtcGxlLmNvbSIsImZsYWdzIjp7InppcCI6dHJ1ZX19';

  test('a job_id minted by another process is read back unchanged', () => {
    expect(parse(MINTED_ELSEWHERE)).toEqual({
      valid: true,
      job: { kind: 'data-export', id: '77', origin: 'https://instance.example.com', flags: { zip: true } }
    });
  });

  test('this release mints that same handle, byte for byte', () => {
    expect(mint({ kind: 'data-export', id: '77', origin: 'https://instance.example.com', flags: { zip: true } }))
      .toBe(MINTED_ELSEWHERE);
  });
});

test('every kind a handle can carry has an adapter to read it', () => {
  expect([...adapters.keys()].sort()).toEqual([...JOB_KINDS].sort());
});
