/**
 * unit-tests-run — run tests on an instance and wait for the verdict.
 *
 * The runner answers `/_tests/run.js` with one JSON shape whatever happens, so this reads the body
 * before it judges the status. That order is the whole point: **a failing assertion comes back as
 * HTTP 500 with a complete run in it** — deliberate, documented in the tests module, and how it
 * signals a red build to CI. Read status-first, it was `kind: unavailable`, which the server
 * instructions define as "the same call may work later"; an agent following them retries a red
 * build forever.
 *
 * This used to ask for `?formatter=text` and parse the prose. It never received prose: `/_tests/run`
 * serves the `.js` page and ignores `formatter` entirely (measured 2026-09-22), so ~180 lines of
 * text parser ran against JSON and invented a test out of every non-indented line — which is how a
 * run that matched nothing reported `totalTests: 1, passed: true`.
 */
import log from '../log.js';
import { resolveAuth } from '../auth.js';
import { authProperties } from '../schemas/auth.js';
import { ToolError, kindForStatus } from '../tool-error.js';
import makeRequest, { testAuthHeaders, testsUrl } from './request.js';
import { missingTestsModule } from './module-check.js';
import { crashedTestRun } from './crash-check.js';

/**
 * How to find out what tests exist, for the errors that need to say so. No tool lists them.
 *
 * `per_page` and `total_entries` are not decoration: the default page is 20, and an evaluation
 * followed this query on an instance holding 38 tests, got 20 back with nothing saying so, and
 * concluded its test was missing. A remedy that misleads is worse than no remedy.
 */
const LIST_TESTS = 'graphql-exec: { admin_liquid_partials(per_page: 100, filter: { path: { ends_with: "_test" } }) { total_entries results { path } } }';

/**
 * What goes *inside* a test file, without this repository saying what.
 *
 * Two evaluations could not write a test from anything the server told them, and both recovered
 * the same way: by reading the tests module's own assertions back off the instance. Those are
 * partials carrying a `{% doc %}` block that names every parameter they take, so pointing at them
 * answers the question and cannot go stale — the contract belongs to the tests module, and a copy
 * of it here would be wrong the first time that module changed.
 *
 * Only on `NO_TESTS`. Where tests already exist, `LIST_TESTS` names real ones to read instead.
 */
const SHOW_ASSERTIONS = 'graphql-exec: { admin_liquid_partials(per_page: 20, filter: { path: { starts_with: "modules/tests/assertions/" } }) { results { path body } } }';

const asObject = (body) => {
  try {
    const parsed = JSON.parse(body);
    return (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * A run is recognised by its counters, not by its status or its `success` flag. The runner answers
 * the same object for a pass, a failure and an empty selection; only a refusal (a production
 * instance, where the runner does not exist) carries `error` and no counters.
 */
const asRun = (parsed) => (typeof parsed?.total_tests === 'number' ? parsed : null);

const count = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/**
 * One assertion message, bounded. `should.equal` renders both compared values into its message, so
 * a single test comparing two large objects puts the whole of both into the model's context —
 * measured at 103 KB from one failing assertion. The divergence is at the front of the message,
 * which is the part worth keeping; the same reasoning as `upstreamBody` in tool-error.js.
 */
export const MAX_MESSAGE_LENGTH = 2000;

const boundMessage = (message) => (typeof message === 'string' && message.length > MAX_MESSAGE_LENGTH
  ? `${message.slice(0, MAX_MESSAGE_LENGTH)}… (${message.length - MAX_MESSAGE_LENGTH} more characters)`
  : message);

const boundErrors = (errors) => Object.fromEntries(
  Object.entries(errors).map(([field, messages]) =>
    [field, Array.isArray(messages) ? messages.map(boundMessage) : boundMessage(messages)])
);

/**
 * Per test, with an empty `errors` dropped the way `logs-fetch` drops an empty row field: provably
 * nothing, on a list one entry long per test file. A passing test keeps its name and its assertion
 * count, which is what says the test ran at all.
 */
const leanTest = (test) => {
  if (test === null || typeof test !== 'object') return test;
  const { errors, ...rest } = test;
  const hasErrors = errors !== null && typeof errors === 'object' && Object.keys(errors).length > 0;
  return { ...rest, ...(hasErrors && { errors: boundErrors(errors) }) };
};

/**
 * Nothing ran, so nothing passed. `total_errors` is 0 when no test matched, which made
 * `passed: total_errors === 0` answer `true` for a mistyped name or a suite that was never
 * deployed — a green tick for having run nothing, confirmed by an evaluation that mistyped one.
 */
const nothingMatched = (filter) => (filter
  ? ToolError.not_found('NO_TESTS_MATCHED',
    `No test path contains '${filter}', so nothing ran. Names are matched as substrings, and a test file's path must end with _test. List them with ${LIST_TESTS}`,
    { filter, matched: 0 })
  : ToolError.project('NO_TESTS',
    `This instance has no test files, so nothing ran. A test is a partial whose path ends with _test, and it takes and returns a contract. `
      + `The assertions it calls document their own parameters: read them with ${SHOW_ASSERTIONS}`,
    { matched: 0 }));

const testsRunTool = {
  description: 'Run tests on an instance and wait for the result. Omit name to run every test. A failed assertion is a completed run: ok:true with passed:false, and tests[].errors names the assertion.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      ...authProperties,
      name: { type: 'string', description: 'Any part of a test path, matched as a substring, e.g. create_user_test or users/. Test files live under app/lib and their path must end with _test; a deploy silently discards app/tests. A test takes and returns a contract, calling assertions under modules/tests/assertions/ whose {% doc %} names each parameter.' }
    }
    // `name` is not required: the runner takes no filter as "every test". `env` is not required
    // either — resolveAuth also accepts url+email+token, MPKIT_*, or the single .pos entry.
  },
  handler: async (params, ctx = {}) => {
    log.debug('tool:unit-tests-run invoked', { env: params?.env, name: params?.name });

    const auth = await resolveAuth(params, ctx);

    // One value, three readers. The URL sends `?name=` only when there is a filter, the crash
    // lookup matches log rows on that same parameter, and `nothingMatched` picks its error from it
    // — so an empty `name`, which the schema accepts, has to mean the same thing to all three. It
    // did not: the URL treated `''` as no filter while the lookup compared it as one, and matched
    // no row for a run that had crashed.
    const filter = params?.name || undefined;

    // `.js` explicitly. `/_tests/run` happens to serve the same page today, but that is platformOS
    // choosing a format for us; the parser here only reads one, so it asks for the one it reads.
    const testUrl = testsUrl(auth.url, '/_tests/run.js')
      + (filter ? `?name=${encodeURIComponent(filter)}` : '');

    const requestFn = ctx.request || makeRequest;
    // Noted before the request, not after: it is where a crash lookup starts reading the log, and
    // the rows it wants were written while this was in flight.
    const startedAtMs = Date.now();
    const response = await requestFn({ method: 'GET', uri: testUrl, headers: testAuthHeaders(auth.token) });

    const { statusCode, body } = response;
    const parsed = asObject(body);
    const run = asRun(parsed);

    // Before the status, deliberately: see the module note above.
    if (run) {
      const matched = count(run.total_tests);
      if (matched === 0) throw nothingMatched(filter);

      return {
        passed: count(run.total_errors) === 0,
        matched,
        assertions: count(run.total_assertions),
        failures: count(run.total_errors),
        durationMs: count(run.duration_ms),
        // Empty on a tests module older than the one that fixed its own JSON report, while the
        // counters above are right — so an agent reads the counts and the detail separately.
        tests: (Array.isArray(run.tests) ? run.tests : []).map(leanTest),
        url: testUrl
      };
    }

    if (statusCode === 404) {
      // The path is static, so with the module installed a 404 can only be a module too old to
      // have this endpoint — `/_tests/run.js` arrived in tests 1.1.0.
      throw (await missingTestsModule(statusCode, auth, ctx))
        ?? ToolError.project('TESTS_MODULE_OUTDATED',
          'The tests module is installed but serves no /_tests/run.js, which tests 1.1.0 added.',
          {
            remedy: {
              command: 'pos-cli modules update tests && pos-cli deploy <env>',
              runBy: 'a person, or an agent with a shell: it changes the project and needs a deploy'
            }
          });
    }

    if (statusCode >= 400) {
      // A 5xx the instance is well enough to deny: a test raised and took the run down with it.
      throw (await crashedTestRun(statusCode, auth, ctx, { filter, startedAtMs }))
        ?? new ToolError(kindForStatus(statusCode), 'HTTP_ERROR', `Request failed with status ${statusCode}`, { statusCode, body });
    }

    // 200, and not a run. The runner refuses outside staging and development, and says so in JSON.
    if (typeof parsed?.error === 'string') {
      throw ToolError.project('TESTS_NOT_AVAILABLE', parsed.error, { statusCode });
    }

    throw ToolError.instance('TESTS_UNREADABLE',
      'The test runner answered with something that is not a run.', { statusCode, body });
  }
};

export default testsRunTool;
