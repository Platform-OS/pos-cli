/**
 * `unit-tests-run` against the runner's JSON.
 *
 * The three things this file exists to hold, each one a defect an agent evaluation hit:
 *  - a failing assertion is a **completed run**, not a transport failure to retry;
 *  - a selection that matched nothing is **not** a pass;
 *  - the per-test detail the runner sends is what comes back, rather than a text parser's guess.
 */
import { vi, describe, test, expect, beforeAll } from 'vitest';
import { runTool } from '../run-tool.js';
import registry from '../tools.js';

vi.mock('../../lib/files', () => ({
  default: { getConfig: () => ({ staging: { url: 'https://staging.example.com', token: 'test-token', email: 'test@example.com' } }) },
  getConfig: () => ({ staging: { url: 'https://staging.example.com', token: 'test-token', email: 'test@example.com' } })
}));

vi.mock('../../lib/settings', () => ({
  default: { settingsFromDotPos: (env) => ({ url: `https://${env}.example.com`, token: 'test-token', email: 'test@example.com' }) },
  settingsFromDotPos: (env) => ({ url: `https://${env}.example.com`, token: 'test-token', email: 'test@example.com' })
}));

vi.mock('request-promise', () => ({ default: vi.fn() }));

let tool;
let MAX_MESSAGE_LENGTH;
beforeAll(async () => {
  const module = await import('../tests/run.js');
  tool = module.default;
  MAX_MESSAGE_LENGTH = module.MAX_MESSAGE_LENGTH;
});

/**
 * What tests@1.3.5 answers, captured from the verification instance on 2026-09-22 — including the
 * leading and trailing blank lines the page emits, which the reader has to tolerate.
 */
const runBody = ({ total_tests = 2, total_assertions = 3, total_errors = 1, tests = [
  { name: 'gen/gen03_test', success: false, assertions: 2, errors: { gen03_middle: ['expected 4 to equal 5'] } },
  { name: 'gen/gen04_test', success: true, assertions: 1, errors: {} }
] } = {}) => `\n\n\n${JSON.stringify({
  success: total_errors === 0, total_tests, total_assertions, total_errors, duration_ms: 71, tests
})}\n\n\n`;

/** The runner answers 500 for a red run and 200 for a green one, with the same body shape. */
const answering = (body, statusCode = 200) => vi.fn().mockResolvedValue({ statusCode, body });

const call = (params, seam) => runTool(tool, { env: 'staging', ...params }, seam);

describe('a failing assertion is a run that happened', () => {
  /**
   * The whole of TASK-51 and round 2's F1. The runner returns 500 when an assertion fails — its
   * documented way of signalling a red build — and reading the status first made that
   * `kind: unavailable`, which the server instructions define as "the same call may work later".
   * An agent obeying its instructions retries a red build for as long as it stays red.
   */
  test('a 500 carrying a run is ok:true with passed:false', async () => {
    const result = await call({ name: 'gen' }, { request: answering(runBody(), 500) });

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ passed: false, matched: 2, failures: 1, assertions: 3 });
    expect(result.error).toBeUndefined();
  });

  // The other half: the body is read before the status, so a green run under 200 is unaffected.
  test('a green run is passed:true', async () => {
    const body = runBody({ total_errors: 0, tests: [{ name: 'a_test', success: true, assertions: 1, errors: {} }] });

    const { data } = await call({ name: 'a' }, { request: answering(body) });

    expect(data.passed).toBe(true);
    expect(data.failures).toBe(0);
  });

  // A 500 with no run in it is still a failure of the call — the status is not ignored, it is
  // judged second. The Gateway is supplied so the health probe that now separates a crashed test
  // from an unwell instance answers here rather than reaching for the network.
  test('a 500 that is not a run is still an error', async () => {
    class Unreachable { async getInstance() { throw Object.assign(new Error('down'), { statusCode: 503 }); } }
    const result = await call({ name: 'a' }, { request: answering('<html><title>Aw, Snap!</title></html>', 500), Gateway: Unreachable });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('HTTP_ERROR');
  });
});

describe('what the failure says', () => {
  test('the failing test, its assertion and the message all reach the caller', async () => {
    const { data } = await call({ name: 'gen' }, { request: answering(runBody(), 500) });

    const failed = data.tests.find(t => !t.success);
    expect(failed.name).toBe('gen/gen03_test');
    expect(failed.errors).toEqual({ gen03_middle: ['expected 4 to equal 5'] });
  });

  // An evaluation could not learn *which* assertion failed by any route; the counters were all it
  // got. This is the assertion that says the detail survives the trip.
  test('a passing test keeps its name and count, and carries no empty errors object', async () => {
    const { data } = await call({ name: 'gen' }, { request: answering(runBody(), 500) });

    const passed = data.tests.find(t => t.success);
    expect(passed).toEqual({ name: 'gen/gen04_test', success: true, assertions: 1 });
  });

  // The module before its own JSON report was fixed answers correct counters and an empty list.
  test('an older module reports its counts, with no detail to show', async () => {
    const { data } = await call({ name: 'gen' }, { request: answering(runBody({ tests: [] }), 500) });

    expect(data).toMatchObject({ matched: 2, failures: 1, tests: [] });
  });
});

/**
 * `should.equal` renders both compared values into its message, so the size of a failure is the
 * size of the data under test. Measured against the verification instance: one assertion comparing
 * a 100 KB string produced a 103 KB result — on a tool whose whole job is to be read by a model.
 */
describe('one runaway assertion cannot fill the context', () => {
  // Built inside the tests: the constant is only there once `beforeAll` has imported the module.
  const huge = () => 'x'.repeat(MAX_MESSAGE_LENGTH * 3);
  const body = () => runBody({
    total_tests: 1, total_assertions: 1, total_errors: 1,
    tests: [{ name: 'big_test', success: false, assertions: 1, errors: { big: [huge()] } }]
  });

  test('a very long assertion message is cut, and says how much it left out', async () => {
    const { data } = await call({ name: 'big' }, { request: answering(body(), 500) });

    const message = data.tests[0].errors.big[0];
    expect(MAX_MESSAGE_LENGTH).toBeGreaterThan(0);
    expect(message.length).toBeLessThan(MAX_MESSAGE_LENGTH + 60);
    expect(message).toContain(`${huge().length - MAX_MESSAGE_LENGTH} more characters`);
  });

  // Bounded, not dropped: which test failed and on which field still comes back.
  test('the test and the field it failed on survive the cut', async () => {
    const { data } = await call({ name: 'big' }, { request: answering(body(), 500) });

    expect(data.tests[0].name).toBe('big_test');
    expect(Object.keys(data.tests[0].errors)).toEqual(['big']);
    expect(data.failures).toBe(1);
  });

  test('an ordinary message is untouched', async () => {
    const { data } = await call({ name: 'gen' }, { request: answering(runBody(), 500) });

    expect(data.tests.find(t => !t.success).errors.gen03_middle).toEqual(['expected 4 to equal 5']);
  });
});

describe('a selection that matched nothing is not a pass', () => {
  const empty = (extra) => runBody({ total_tests: 0, total_assertions: 0, total_errors: 0, tests: [], ...extra });

  /**
   * `passed: total_errors === 0` answered `true` for a run of nothing: no tests, so no failures.
   * An evaluation mistyped a name and got a green tick with `totalTests: 1` beside it.
   */
  test('a name that matches no test is not_found, never passed:true', async () => {
    const result = await call({ name: 'no_such_test_xyz' }, { request: answering(empty()) });

    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({ kind: 'not_found', code: 'NO_TESTS_MATCHED' });
    expect(result.error.message).toContain('no_such_test_xyz');
    expect(result.error.details.matched).toBe(0);
  });

  // No tool lists the tests, so the error carries the query that does.
  test('and says how to find out which tests exist', async () => {
    const result = await call({ name: 'typo' }, { request: answering(empty()) });

    expect(result.error.message).toContain('admin_liquid_partials');
    expect(result.error.message).toContain('ends_with');
  });

  // Without a filter the same emptiness means something different: nothing is deployed.
  test('with no filter it is the project that has no tests', async () => {
    const result = await call({}, { request: answering(empty()) });

    expect(result.error).toMatchObject({ kind: 'project', code: 'NO_TESTS' });
    expect(result.error.details).not.toHaveProperty('filter');
  });

  /**
   * With no tests on the instance there is no example to copy, and two evaluations could not write
   * one from anything the server said — both recovered by reading the tests module's assertions
   * off the instance. The error points there rather than restating the contract, which belongs to
   * that module and would be wrong here the first time it changed.
   */
  test('with nothing to copy, it says how to find out what goes in a test', async () => {
    const result = await call({}, { request: answering(empty()) });

    expect(result.error.message).toContain('takes and returns a contract');
    expect(result.error.message).toContain('modules/tests/assertions/');
    // Pointed at, not copied: no assertion's own parameters are named here.
    expect(result.error.message).not.toContain('field_name');
  });

  // Where tests exist, real ones are the better example, so this stays about finding them.
  test('a filter that matched nothing points at the tests that do exist', async () => {
    const result = await call({ name: 'nope' }, { request: answering(empty()) });

    expect(result.error.code).toBe('NO_TESTS_MATCHED');
    expect(result.error.message).toContain('ends_with: "_test"');
    expect(result.error.message).not.toContain('modules/tests/assertions/');
  });
});

describe('the request it makes', () => {
  test('it asks for the format it parses, and passes the filter through', async () => {
    const request = answering(runBody());

    await call({ name: 'users/create' }, { request });

    expect(request.mock.calls[0][0].uri).toBe('https://staging.example.com/_tests/run.js?name=users%2Fcreate');
  });

  // Omitting the filter is how the whole suite runs. It used to be refused by the schema, with the
  // description pointing at tests-run-async, which does not work.
  test('no name means every test, and no query string', async () => {
    const request = answering(runBody());

    await call({}, { request });

    expect(request.mock.calls[0][0].uri).toBe('https://staging.example.com/_tests/run.js');
  });

  test('name is optional in the published schema', () => {
    expect(registry.get('unit-tests-run').inputSchema.required).toBeUndefined();
  });

  // It applied to nothing, and a parameter that silently does nothing is worse than one that is
  // refused: the caller believes the run was narrowed.
  test('path is gone rather than accepted and ignored', () => {
    expect(registry.get('unit-tests-run').inputSchema.properties).not.toHaveProperty('path');
  });
});

describe('an instance that cannot run tests says so', () => {
  // A production instance answers 200 with this: the runner only exists in staging and development.
  test('a refusal is reported as one, not as a run of nothing', async () => {
    const body = '{"success":false,"error":"Tests can only be run in staging or development environment"}';

    const result = await call({ name: 'a' }, { request: answering(body) });

    expect(result.error).toMatchObject({ kind: 'project', code: 'TESTS_NOT_AVAILABLE' });
    expect(result.error.message).toMatch(/staging or development/);
  });

  test('a 200 that is not JSON at all is an unreadable answer, not a silent pass', async () => {
    const result = await call({ name: 'a' }, { request: answering('<html>hello</html>') });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('TESTS_UNREADABLE');
  });
});

/**
 * The runner ships in the `tests` module, so an instance without it has no `/_tests/*` at all and
 * answers 404 — the same 404 a wrong path would get. An evaluating agent spent four calls and a
 * deploy cycle telling the two apart, and ~1,100 tokens of HTML error page for its trouble.
 */
describe('a 404 from an instance with no test runner', () => {
  const notFound = () => vi.fn().mockResolvedValue({
    statusCode: 404,
    body: '<!DOCTYPE html><html><head><title>Aw, Snap!</title></head><body>page not found</body></html>'
  });

  const withModules = (installed, onCall = () => {}) => class {
    async listModules() { onCall(); return { data: installed }; }
  };

  test('says the module is missing, and what installs it', async () => {
    const result = await call({ name: 'some_test' }, { request: notFound(), Gateway: withModules(['core']) });

    expect(result.error).toMatchObject({ kind: 'project', code: 'TESTS_MODULE_MISSING' });
    expect(result.error.details.remedy.command).toContain('modules install tests');
    // The HTML page was the whole of the old answer, and none of its signal.
    expect(JSON.stringify(result.error)).not.toContain('DOCTYPE');
  });

  /**
   * With the module installed the path is static, so a 404 can only mean a module older than the
   * one that added `/_tests/run.js` (tests 1.1.0). It used to read as "that test name is wrong",
   * which is a hypothesis nothing can act on.
   */
  test('with the module installed, a 404 is a module too old to serve this endpoint', async () => {
    const result = await call({ name: 'some_test' }, { request: notFound(), Gateway: withModules(['core', 'tests']) });

    expect(result.error).toMatchObject({ kind: 'project', code: 'TESTS_MODULE_OUTDATED' });
    expect(result.error.details.remedy.command).toContain('modules update tests');
    expect(result.error.details.remedy.runBy).toMatch(/shell|person/);
  });

  // Asked only when something already failed, and only for the status that is ambiguous.
  test('a 500 is not a missing module, and costs no extra request', async () => {
    const asked = vi.fn();

    const result = await call({ name: 'some_test' }, { request: answering('boom', 500), Gateway: withModules(['core'], asked) });

    expect(result.error.code).toBe('HTTP_ERROR');
    expect(asked).not.toHaveBeenCalled();
  });

  test('an instance that will not say which modules it has still gets an actionable answer', async () => {
    const Unreadable = class { async listModules() { throw new Error('nope'); } };

    const result = await call({ name: 'some_test' }, { request: notFound(), Gateway: Unreadable });

    // Could not tell it apart, so it falls to the outdated-module reading, which carries a remedy.
    expect(result.error.code).toBe('TESTS_MODULE_OUTDATED');
  });
});

/**
 * The `path` example sent an evaluation to `app/tests/eval/simple_test.liquid`, which the deploy
 * converter discards while still reporting success — so the test file it wrote was never on the
 * instance, and nothing said so. Measured on 2026-09-22: anything under `app/tests` lands in
 * `files_not_matched`, while `app/lib/**` deploys as Partials.
 */
/**
 * A test is a Liquid partial, so one that raises takes the page rendering it down: the runner
 * answers 500 with an error page and no detail. Read from the status alone that is `unavailable`
 * — "the same call may work later" — so an evaluation retried a test that could never pass and
 * had no route to the reason. The instance is asked whether it is well, exactly as a 5xx on a job
 * is settled, and one that answers for itself is not the thing that failed.
 */
describe('a 5xx from an instance that is otherwise well', () => {
  const crashed = () => vi.fn().mockResolvedValue({
    statusCode: 500,
    body: '<!DOCTYPE html><html><head><title>Aw, Snap!</title></head><body>error</body></html>'
  });

  const instanceThat = (answers, onProbe = () => {}) => class {
    async getInstance() { onProbe(); if (!answers) throw Object.assign(new Error('down'), { statusCode: 503 }); return { id: 1 }; }
  };

  test('is the test that raised, not something to retry', async () => {
    const result = await call({ name: 'crash_test' }, { request: crashed(), Gateway: instanceThat(true) });

    expect(result.error).toMatchObject({ kind: 'project', code: 'TEST_RUN_CRASHED' });
    expect(result.error.message).toContain("matching 'crash_test'");
    // The HTML page was the whole of the old answer, and none of its signal.
    expect(JSON.stringify(result.error)).not.toContain('DOCTYPE');
  });

  // The probe is what separates the two; without it the instance gets blamed for the test, or the
  // test for the instance, and only one of those can be acted on.
  test('an instance that cannot answer for itself keeps the retryable classification', async () => {
    const result = await call({ name: 'crash_test' }, { request: crashed(), Gateway: instanceThat(false) });

    expect(result.error).toMatchObject({ kind: 'unavailable', code: 'HTTP_ERROR' });
  });

  test('a run with no name says so without inventing one', async () => {
    const result = await call({}, { request: crashed(), Gateway: instanceThat(true) });

    expect(result.error.message).toMatch(/^A test raised/);
  });

  // It costs a request, so it must only be paid when the run has already failed.
  test('a run that works never probes', async () => {
    const probes = vi.fn();
    const result = await call({}, { request: answering(runBody()), Gateway: instanceThat(true, probes) });

    expect(result.ok).toBe(true);
    expect(probes).not.toHaveBeenCalled();
  });
});

describe('the parameters say where a test file can actually live', () => {
  const properties = () => registry.get('unit-tests-run').inputSchema.properties;

  test('name names the directory the deploy keeps', () => {
    expect(properties().name.description).toMatch(/app\/lib/);
  });

  test('name warns about the one the deploy throws away', () => {
    expect(properties().name.description).toMatch(/app\/tests/);
  });

  // It pointed at tests-run-async, which answers MISSING_ID against tests@1.3.5 and runs the suite
  // anyway. A description may not send an agent to a tool that cannot work.
  test('the description no longer sends the whole suite to tests-run-async', () => {
    expect(registry.get('unit-tests-run').description).not.toMatch(/tests-run-async/);
  });
});
