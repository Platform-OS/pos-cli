/**
 * Why a `/_tests/*` endpoint answered 404.
 *
 * The runner ships in the `tests` module, so an instance without it has no such endpoint at all —
 * and that 404 is indistinguishable from a test name the runner does not know. An evaluating agent
 * spent four calls and a deploy cycle establishing the difference. `lib/test-runner` asks before
 * every CLI run; asked here only after a 404, so a run that works pays nothing.
 */
import Gateway from '../../lib/proxy.js';
import { ToolError } from '../tool-error.js';
import log from '../log.js';

const MODULE = 'tests';

/** @returns {Promise<boolean>} true only when the instance answered and the module is not there. */
async function moduleIsMissing(gateway) {
  try {
    const installed = (await gateway.listModules())?.data;
    return Array.isArray(installed) && !installed.includes(MODULE);
  } catch (err) {
    // Could not tell, so the caller's original error stands rather than becoming a worse guess.
    log.debug('could not read installed modules', { error: String(err) });
    return false;
  }
}

/**
 * @returns {Promise<ToolError|null>} the error to throw in place of the 404, or null to keep it.
 */
export async function missingTestsModule(status, auth, ctx = {}) {
  if (status !== 404) return null;

  const GatewayCtor = ctx.Gateway || Gateway;
  if (!(await moduleIsMissing(new GatewayCtor({ url: auth.url, token: auth.token, email: auth.email })))) return null;

  return ToolError.project(
    'TESTS_MODULE_MISSING',
    `This instance has no test runner: the ${MODULE} module is not installed, so /_tests/* does not exist. It is not the test name that is wrong.`,
    {
      remedy: {
        command: `pos-cli modules install ${MODULE} && pos-cli deploy <env>`,
        runBy: 'a person, or an agent with a shell: it changes the project and needs a deploy'
      }
    }
  );
}
