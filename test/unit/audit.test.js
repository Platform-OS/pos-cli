import exec from '#test/utils/exec';
import cliPath from '#test/utils/cliPath';
import path from 'path';

const cwd = name => path.join(process.cwd(), 'test', 'fixtures', 'audit', name);

const run = fixtureName => exec(`${cliPath} audit`, { cwd: cwd(fixtureName) });

test('Reports no errors with empty directory', async () => {
  const { stderr } = await run('empty');
  expect(stderr).toMatch('[Audit] 0 rules detected issues.');
});

describe('Audit - app directory', () => {
  test('Reports 1 error in app', async () => {
    const { stderr } = await run('oneError');

    expect(stderr).toMatch('[Audit] 1 rule detected issues.');
    expect(stderr).toMatch('enable_profiler: true');
    // Audit output always uses forward slashes (from fast-glob)
    expect(stderr).toMatch('app/views/pages/error.liquid');
  });

  test('Reports 2 different errors in one file', async () => {
    const { stderr } = await run('twoErrors');

    expect(stderr).toMatch('[Audit] 2 rules detected issues.');
    expect(stderr).toMatch('enable_profiler: true');
    expect(stderr).toMatch('[DEPRECATED TAG] query_graph');
    expect(stderr).toMatch('app/views/pages/error.liquid');
  });

  test('Reports 3 different errors in two files', async () => {
    const { stderr } = await run('threeErrors');

    expect(stderr).toMatch('[Audit] 3 rules detected issues.');
    expect(stderr).toMatch('enable_profiler: true');
    expect(stderr).toMatch('[DEPRECATED TAG] query_graph');
    expect(stderr).toMatch('app/views/pages/error.liquid');
    expect(stderr).toMatch('app/views/pages/error2.liquid');
  });
});

describe('Audit - marketplace_builder directory', () => {
  test('Reports 3 different errors in two files', async () => {
    const { stderr } = await run('threeErrors_mpb');

    expect(stderr).toMatch('[Audit] 3 rules detected issues.');
    expect(stderr).toMatch('enable_profiler: true');
    expect(stderr).toMatch('[DEPRECATED TAG] query_graph');
    expect(stderr).toMatch('marketplace_builder/views/pages/error.liquid');
    expect(stderr).toMatch('marketplace_builder/views/pages/error2.liquid');
  });
});

describe('Audit - modules directory', () => {

  test('Reports errors for modules files', async () => {
    const { stderr } = await run('modules');

    expect(stderr).toMatch('[Audit] 4 rules detected issues.');
    expect(stderr).toMatch('enable_profiler: true');
    expect(stderr).toMatch('[DEPRECATED TAG] query_graph');
    expect(stderr).toMatch('modules/first/public/views/pages/error.liquid');
    expect(stderr).toMatch('modules/first/public/views/pages/error2.liquid');
    expect(stderr).toMatch('modules/second/private/views/pages/error.liquid');
    expect(stderr).toMatch('modules/second/private/views/pages/error2.liquid');

    expect(stderr).toMatch('Only .graphql files should be in graphql directory');
    expect(stderr).toMatch('modules/first/public/graphql/test.liquid');
    expect(stderr).not.toMatch('modules/graphql/public/views/pages/home.liquid');
  });
});

describe('Audit - orphaned includes', () => {
  test('Reports errors for 2 not included partials', async () => {
    const { stderr } = await run('orphanedIncludes');

    expect(stderr).toMatch('[Audit] 1 rule detected issues.');
    expect(stderr).toMatch('app/views/partials/not_included_partial.liquid');
    expect(stderr).toMatch('modules/test/private/views/partials/not_included_partial.liquid');
    expect(stderr).not.toMatch('app/views/partials/included_partial.liquid');
    expect(stderr).not.toMatch('app/views/partials/included_partial_2.liquid');
    expect(stderr).not.toMatch('app/views/partials/shared/head.liquid');
  });
});
