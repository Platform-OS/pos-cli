/**
 * Rules every tool description has to satisfy.
 *
 * A description is sent to the model with every request, so a sentence that misleads costs a wrong
 * turn and a sentence that says nothing costs tokens forever. These are the rules that can be
 * checked mechanically; the wording itself is reviewed by people.
 */
import { describe, test, expect } from 'vitest';
import registry from '../tools.js';
import { authProperties } from '../schemas/auth.js';
import { recordCheckProperties } from '../schemas/record-checks.js';
import { generatorPathProperty } from '../schemas/generators.js';

// The property objects the shared fragments contribute. A schema spreads them, which copies the
// references, so a parameter that came from one of these IS that object — which is how a genuinely
// shared parameter is told apart from the same sentence typed into two tools.
const SHARED = new Set([...Object.values(authProperties), ...Object.values(recordCheckProperties), generatorPathProperty]);

const parameters = () => [...registry].flatMap(([tool, t]) =>
  Object.entries(t.inputSchema?.properties ?? {}).map(([name, schema]) => ({ tool, name, schema })));

const everyDescription = () => [
  ...descriptions().map(([where, text]) => [where, text]),
  ...parameters().filter(p => p.schema.description).map(p => [`${p.tool}.${p.name}`, p.schema.description])
];

const descriptions = () => [...registry].map(([name, tool]) => [name, tool.description ?? '']);

describe('every tool says what it is', () => {
  test('no registered tool is undescribed', () => {
    const silent = descriptions().filter(([, text]) => !text.trim()).map(([name]) => name);

    expect(silent).toEqual([]);
  });

  // A parameter with no description is a parameter the model has to guess at — `limit` limits
  // what, rows or bytes? — and nothing above catches it, because every rule there is about
  // descriptions that exist. The one exemption is the explicit-credentials triple: they are
  // meaningless apart and `env`, described beside them, is what explains the group.
  test('no parameter is undescribed', () => {
    const undescribed = parameters()
      .filter(({ tool, name, schema }) => !schema.description
        && !(['url', 'email', 'token'].includes(name) && schema === authProperties[name])
        // env-add's url, email and token name an instance to store, not credentials to use.
        && tool !== 'env-add')
      .map(({ tool, name }) => `${tool}.${name}`);

    expect(undescribed).toEqual([]);
  });
});

describe('a description does not send the agent after things that are not there', () => {
  // Working on a platformOS app is Liquid, GraphQL, YAML and sometimes JavaScript. Ruby is not
  // part of it. The one tool that shelled out to a Ruby-era `platformos-check` binary is gone, and
  // with it the reason any description mentioned Ruby — including `check-run` saying it did not
  // need it, which only answered a question the deleted tool had raised.
  test('no description mentions Ruby', () => {
    const offenders = descriptions().filter(([, text]) => /\bruby\b|\bgems?\b/i.test(text)).map(([name]) => name);

    expect(offenders, 'platformOS work never involves Ruby; saying so raises a question nobody asked').toEqual([]);
  });

  // "Requires @platformos/platformos-check-node" is advice an agent can act on, wrongly: pos-cli
  // declares that package, so it is already installed. A tool that genuinely cannot load something
  // says so at call time, where it knows — check-run returns MISSING_DEPENDENCY.
  //
  // Matched on install instructions and package names, not on the dependency list: `async` and
  // `open` are both dependencies of this repository and both ordinary English words, so testing
  // for those would fail on descriptions that are perfectly correct.
  test('no description names a package or tells the caller to install one', () => {
    const offenders = descriptions()
      .filter(([, text]) => /npm\s+(install|i)\b/i.test(text) || /@[a-z0-9-]+\/[a-z0-9-]+/i.test(text))
      .map(([name]) => name);

    expect(offenders, 'pos-cli installs its own dependencies; naming one reads as an instruction').toEqual([]);
  });
});

describe('a description is written once', () => {
  test('no parameter description is repeated across tools', () => {
    const seen = new Map();
    for (const { tool, name, schema } of parameters()) {
      if (!schema.description || SHARED.has(schema)) continue;
      seen.set(schema.description, [...(seen.get(schema.description) ?? []), `${tool}.${name}`]);
    }

    const repeated = [...seen]
      .filter(([, where]) => where.length > 1)
      .map(([text, where]) => `${where.join(' and ')} both say "${text}"`);

    expect(repeated, 'parameters that mean the same thing should share one object, as authProperties does').toEqual([]);
  });

  // A tool may override a shared parameter — job-status does, because a job_id names its instance
  // — but overriding it with the same sentence is the duplication back again, and comparing
  // tool-owned descriptions only to each other would never see a single one.
  test('no tool restates a description the shared schemas already give', () => {
    const sharedText = new Set([...SHARED].map(schema => schema.description).filter(Boolean));
    const restated = parameters()
      .filter(({ schema }) => !SHARED.has(schema) && sharedText.has(schema.description))
      .map(({ tool, name }) => `${tool}.${name}`);

    expect(restated, 'drop the override and let the shared property through').toEqual([]);
  });
});

describe('a description carries only what the model can act on', () => {
  // An endpoint path, an HTTP verb or a source file name tells the model nothing it can use: it
  // calls the tool, not the API, and it cannot open this repository.
  test.each([
    ['an API path', /\/api\/|\/_[a-z]/],
    ['an HTTP verb', /\b(GET|POST|PUT|PATCH|DELETE|HEAD)\b/],
    ['a source file name', /\.(js|mjs|cjs|json)\b/]
  ])('no description contains %s', (_label, pattern) => {
    const offenders = everyDescription().filter(([, text]) => pattern.test(text)).map(([where]) => where);

    expect(offenders).toEqual([]);
  });

  // The schema already carries `default`, and a client shows it. Repeating it in prose is a second
  // copy to keep in step, and it goes stale silently.
  test('no description restates a default the schema declares', () => {
    const offenders = everyDescription().filter(([, text]) => /\(default[:\s)]|\bdefault:\s/i.test(text)).map(([where]) => where);

    expect(offenders).toEqual([]);
  });
});
