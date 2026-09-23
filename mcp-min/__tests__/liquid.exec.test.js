/**
 * `liquid-exec`, and the promise its `locals` parameter makes.
 *
 * The endpoint renders in a context where nothing the caller sends is a variable: the whole request
 * body arrives at `context.params` and nowhere else. So a template written the way this tool's own
 * description showed it — `Hello {{ name }}` with `locals: {name: 'world'}` — rendered `Hello ` and
 * answered `ok: true` with `error: null`. An agent cannot tell that from Liquid it got wrong, or
 * from data that is genuinely empty, which is what makes it worse than a failure.
 *
 * The tool binds each local to where the instance actually put it, so the output below is asserted
 * rather than the call merely succeeding.
 */
import { describe, test, expect } from 'vitest';
import { runTool } from '../run-tool.js';
import tool from '../liquid/exec.js';

const AUTH = { url: 'https://x.example.com', email: 'e@example.com', token: 't' };

const call = (params, Gateway) => runTool(tool, { ...AUTH, ...params }, { Gateway });

/** A gateway that records the body and answers with a fixed payload. */
const recording = (answer = { result: '', error: null }) => {
  const sent = [];
  class Recording {
    async liquid(body) { sent.push(body); return answer; }
  }
  return { Gateway: Recording, sent };
};

/**
 * A stand-in for the instance, doing only what the binding depends on: `{% assign %}` reading
 * through `context.params.locals`, and `{{ path }}` substitution. It is a fake instance, not a
 * second copy of the tool — what it renders is what an agent would have read back.
 */
const renderingInstance = () => {
  class Rendering {
    async liquid(body) {
      const scope = { context: { params: { locals: body.locals ?? {} } } };
      const read = (path) => path.split('.').reduce((at, key) => (at == null ? at : at[key]), scope);

      const assigned = body.content.replace(
        /\{%\s*assign\s+([A-Za-z_]\w*)\s*=\s*([\w.]+)\s*%\}/g,
        (_match, name, path) => { scope[name] = read(path); return ''; }
      );
      const result = assigned.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path) => {
        const value = read(path);
        return value === undefined || value === null ? '' : String(value);
      });
      return { result, error: null };
    }
  }
  return Rendering;
};

describe('a template reads its locals by name, as the parameter says', () => {
  // The example from the tool's own description, which used to render `Hello ! n= flag=`.
  test('the description example renders its values', async () => {
    const res = await call(
      { template: 'Hello {{ name }}! n={{ n }} flag={{ flag }}', locals: { name: 'world', n: 42, flag: true } },
      renderingInstance()
    );

    expect(res.ok).toBe(true);
    expect(res.data.result).toBe('Hello world! n=42 flag=true');
  });

  // Nothing is written into the template but the path, so a value arrives as itself rather than as
  // its JSON — an object stays walkable.
  test('an object local keeps its shape', async () => {
    const res = await call(
      { template: '{{ user.name }} <{{ user.email }}>', locals: { user: { name: 'Ada', email: 'a@b.c' } } },
      renderingInstance()
    );

    expect(res.data.result).toBe('Ada <a@b.c>');
  });

  // The platform's own path is where the values really are, and it is what the binding reads
  // through, so a template written that way has to keep working.
  test('context.params.locals still answers', async () => {
    const res = await call({ template: '{{ context.params.locals.name }}', locals: { name: 'world' } }, renderingInstance());

    expect(res.data.result).toBe('world');
  });
});

describe('what is sent to the instance', () => {
  const sentFor = async (params) => {
    const { Gateway, sent } = recording();
    await call(params, Gateway);
    return sent[0];
  };

  test('a call with no locals sends the template unchanged', async () => {
    const body = await sentFor({ template: 'plain {{ 1 | plus: 1 }}' });

    expect(body.content).toBe('plain {{ 1 | plus: 1 }}');
  });

  test('an empty locals object is no locals', async () => {
    const body = await sentFor({ template: 'plain', locals: {} });

    expect(body.content).toBe('plain');
  });

  test('each local is bound from where the instance puts it, in the order given', async () => {
    const body = await sentFor({ template: 'T', locals: { name: 'w', n: 1 } });

    expect(body.content).toBe(
      '{% assign name = context.params.locals.name %}{% assign n = context.params.locals.n %}T'
    );
  });

  /**
   * The one that is easy to get wrong and impossible to notice. A Liquid failure reports the line
   * it happened on — `Liquid error (line 3)`, and `diagnostic.stack[].line` — and that is the
   * caller's only way to find a fault in its own template. Measured against a live instance: the
   * same template reports line 3 with this prefix and line 4 with a newline after it.
   */
  test('the prefix adds no line, so an error still names the caller own line', async () => {
    const template = 'line1\nline2\n{{ 1 | nosuchfilter }}';

    const body = await sentFor({ template, locals: { name: 'w' } });

    expect(body.content.split('\n')).toHaveLength(template.split('\n').length);
    expect(body.content.endsWith(template)).toBe(true);
  });

  // The bindings read through it, and it is the only way an unbindable key can be reached at all.
  test('locals still travel as themselves', async () => {
    const body = await sentFor({ template: 'T', locals: { name: 'w' } });

    expect(body.locals).toEqual({ name: 'w' });
  });
});

/**
 * `{% assign %}` takes a Liquid name and nothing else, and `context` is the object every binding
 * reads through. A key that is neither is left where the instance put it and said out loud, so the
 * caller is never left reading a blank it cannot explain.
 */
describe('a key that cannot become a variable is named back', () => {
  test.each([
    ['a key that is not a Liquid name', 'content-type'],
    ['a key that starts with a digit', '1st'],
    ['a key that would shadow the instance context', 'context']
  ])('%s', async (_label, key) => {
    const { Gateway, sent } = recording();

    const res = await call({ template: 'T', locals: { [key]: 'v', ok: 'yes' } }, Gateway);

    expect(res.data.unboundLocals).toEqual([key]);
    expect(sent[0].content).toBe('{% assign ok = context.params.locals.ok %}T');
    expect(sent[0].locals[key]).toBe('v');
  });

  // A field that is always there is a field nobody reads; this one means something by appearing.
  test('an ordinary call does not carry it', async () => {
    const res = await call({ template: 'T', locals: { name: 'w' } }, recording().Gateway);

    expect(res.data).not.toHaveProperty('unboundLocals');
  });
});

describe('what the result says about failure', () => {
  // It was null on every call that got this far, and a field that is always null invites a check
  // that never fires. A real failure is `ok: false`.
  test('the endpoint always-null error is not passed on', async () => {
    const res = await call({ template: 'T' }, recording({ result: 'out', error: null }).Gateway);

    expect(res.data).toEqual({ result: 'out' });
  });

  // The failure marker is `Liquid error`, and it used to be enough for the output to contain the
  // word `error` anywhere — so a page that renders the word was reported as a call that failed.
  test.each([
    ['an ordinary render that mentions the word', 'Sorry, there was no error on this page.', true],
    ['output that partly rendered before failing', '<h1>Title</h1>Liquid error: undefined variable', false]
  ])('%s', async (_label, result, shouldSucceed) => {
    const res = await call({ template: '{{ x }}' }, recording({ result }).Gateway);

    expect(res.ok).toBe(shouldSucceed);
  });

  // The endpoint answers 200 with the failure in the body, and the diagnostic carries the line.
  test('a Liquid failure is ok:false, keeping what the instance said about it', async () => {
    const answer = {
      result: 'Liquid error',
      error: 'Liquid error (line 3): undefined filter nosuchfilter',
      diagnostic: { type: 'Liquid::UndefinedFilter', stack: [{ path: null, line: 3 }] }
    };

    const res = await call({ template: 'T' }, recording(answer).Gateway);

    expect(res.error).toMatchObject({ kind: 'instance', code: 'LIQUID_EXEC_ERROR' });
    expect(res.error.message).toMatch(/line 3/);
    expect(res.error.details.diagnostic.stack[0].line).toBe(3);
  });

  /**
   * A template that fails partway renders `Liquid error (line N): …` into the page it had built and
   * leaves the response's own `error` null, so the whole page used to become both the message and
   * `details.result`. The page reached the model twice, while it was already handling a failure.
   */
  describe('a failure rendered into the output', () => {
    const page = () => `<!DOCTYPE html><html><body>${'x'.repeat(20000)}Liquid error (line 7): undefined filter nosuchfilter</body></html>`;

    test('the message is the error line, not the page it was rendered into', async () => {
      const res = await call({ template: 'T' }, recording({ result: page(), error: null }).Gateway);

      expect(res.ok).toBe(false);
      expect(res.error.message).toBe('Liquid error (line 7): undefined filter nosuchfilter');
    });

    test('the output is kept, bounded', async () => {
      const res = await call({ template: 'T' }, recording({ result: page(), error: null }).Gateway);

      expect(res.error.details.result.length).toBeLessThan(5000);
      expect(res.error.details.result.startsWith('<!DOCTYPE html>')).toBe(true);
    });

    // One failing partial rendered in a loop repeats the same line once per iteration.
    test('identical lines are reported once', async () => {
      const rendered = Array(500).fill('Liquid error (line 2): undefined variable row').join('\n');

      const res = await call({ template: 'T' }, recording({ result: rendered }).Gateway);

      expect(res.error.message).toBe('Liquid error (line 2): undefined variable row');
    });

    test('distinct lines are reported, and their number is bounded', async () => {
      const rendered = Array.from({ length: 40 }, (_v, i) => `Liquid error (line ${i}): bad`).join('\n');

      const res = await call({ template: 'T' }, recording({ result: rendered }).Gateway);

      expect(res.error.message.split('\n')).toHaveLength(10);
      expect(res.error.message).toContain('Liquid error (line 0): bad');
    });

    // Rendered HTML is frequently one long line, so an error line that stops only at a newline
    // takes the rest of the document with it — which is the payload this is here to avoid.
    test('an error in unbroken output does not drag the rest of the page along', async () => {
      const rendered = `Liquid error (line 7): undefined filter nosuchfilter${' and then '.repeat(2000)}`;

      const res = await call({ template: 'T' }, recording({ result: rendered }).Gateway);

      expect(res.error.message.length).toBeLessThan(250);
      expect(res.error.message).toContain('undefined filter nosuchfilter');
    });

    // The endpoint saying what went wrong is better than anything read out of the output.
    test('the response error still wins when there is one', async () => {
      const answer = { result: page(), error: 'Liquid error (line 7): undefined filter nosuchfilter (from error field)' };

      const res = await call({ template: 'T' }, recording(answer).Gateway);

      expect(res.error.message).toMatch(/from error field/);
    });
  });

  test('an instance that refused is reported as the instance refusing', async () => {
    class Refusing { async liquid() { throw Object.assign(new Error('Unprocessable'), { statusCode: 422 }); } }

    const res = await call({ template: 'T' }, Refusing);

    expect(res.error).toMatchObject({ kind: 'instance', details: { statusCode: 422 } });
  });
});
