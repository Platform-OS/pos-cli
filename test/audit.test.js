const exec = require('./utils/exec');
const cliPath = require('./utils/cliPath');
const path = require('path');
const cwd = name => path.join(process.cwd(), 'test', 'fixtures', 'audit', name);

const run = fixtureName => exec(`${cliPath} audit`, { cwd: cwd(fixtureName) });

test('Reports no errors with empty directory', async () => {
  const { stdout } = await run('empty');
  expect(stdout).toMatch('[Audit] 0 rules detected issues.');
});

describe('Audit - app directory', () => {
  test('Reports 1 error in app', async () => {
    const { stdout } = await run('oneError');

    expect(stdout).toMatch('[Audit] 1 rule detected issues.');
    expect(stdout).toMatch('enable_profiler: true');
    expect(stdout).toMatch(path.join('app', 'views', 'pages', 'error.liquid'));
  });

  test('Reports 2 different errors in one file', async () => {
    const { stdout } = await run('twoErrors');

    expect(stdout).toMatch('[Audit] 2 rules detected issues.');
    expect(stdout).toMatch('enable_profiler: true');
    expect(stdout).toMatch('[DEPRECATED TAG] query_graph');
    expect(stdout).toMatch(path.join('app', 'views', 'pages', 'error.liquid'));
  });

  test('Reports 3 different errors in two files', async () => {
    const { stdout } = await run('threeErrors');

    expect(stdout).toMatch('[Audit] 3 rules detected issues.');
    expect(stdout).toMatch('enable_profiler: true');
    expect(stdout).toMatch('[DEPRECATED TAG] query_graph');
    expect(stdout).toMatch(path.join('app', 'views', 'pages', 'error.liquid'));
    expect(stdout).toMatch(path.join('app', 'views', 'pages', 'error2.liquid'));
  });
});

describe('Audit - marketplace_builder directory', () => {
  test('Reports 3 different errors in two files', async () => {
    const { stdout } = await run('threeErrors_mpb');

    expect(stdout).toMatch('[Audit] 3 rules detected issues.');
    expect(stdout).toMatch('enable_profiler: true');
    expect(stdout).toMatch('[DEPRECATED TAG] query_graph');
    expect(stdout).toMatch(path.join('marketplace_builder', 'views', 'pages', 'error.liquid'));
    expect(stdout).toMatch(path.join('marketplace_builder', 'views', 'pages', 'error2.liquid'));
  });
});

describe('Audit - modules directory', () => {

  test('Reports errors for modules files', async () => {
    const { stdout } = await run('modules');

    expect(stdout).toMatch('[Audit] 3 rules detected issues.');
    expect(stdout).toMatch('enable_profiler: true');
    expect(stdout).toMatch('[DEPRECATED TAG] query_graph');
    expect(stdout).toMatch(path.join('modules', 'first', 'public', 'views', 'pages', 'error.liquid'));
    expect(stdout).toMatch(path.join('modules', 'first', 'public', 'views', 'pages', 'error2.liquid'));
    expect(stdout).toMatch(path.join('modules', 'second', 'private', 'views', 'pages', 'error.liquid'));
    expect(stdout).toMatch(path.join('modules', 'second', 'private', 'views', 'pages', 'error2.liquid'));
  });
});
