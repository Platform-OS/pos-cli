/**
 * `pos-cli-mcp` and `pos-cli mcp` accept no arguments besides --help and --version, and refuse
 * everything else before a transport starts. Spawned-process coverage of the same contract is
 * in cli-invocation.test.js.
 */
import { describe, test, expect } from 'vitest';
import { parseServerArgs } from '../cli-args.js';
import { SHUTDOWN_DEADLINE_MS } from '../lifecycle.js';
import { PROFILE_NAMES } from '../profiles.js';

const NO_SELECTION = { profile: undefined, include: [], exclude: [] };

function parse(argv) {
  const out = [];
  const err = [];
  const result = parseServerArgs(argv, {
    version: '1.2.3',
    writeOut: text => out.push(text),
    writeErr: text => err.push(text)
  });
  return { result, stdout: out.join(''), stderr: err.join('') };
}

describe('parseServerArgs', () => {
  test.each([[[]], [['--']]])('%j starts the server with HTTP and no selection options, and prints nothing', (argv) => {
    expect(parse(argv)).toEqual({ result: { start: true, http: true, selection: NO_SELECTION }, stdout: '', stderr: '' });
  });

  test('--no-http starts stdio only, alone or with selection options, in any order', () => {
    expect(parse(['--no-http'])).toEqual({ result: { start: true, http: false, selection: NO_SELECTION }, stdout: '', stderr: '' });
    expect(parse(['--profile', 'dev', '--no-http', '--exclude-tools', 'deploy-wait']).result).toEqual({
      start: true, http: false, selection: { profile: 'dev', include: [], exclude: ['deploy-wait'] }
    });
  });

  test('there is no --http to turn it back on', () => {
    const { result, stderr } = parse(['--http']);

    expect(result).toEqual({ start: false, exitCode: 1 });
    expect(stderr).toContain("unknown option '--http'");
  });

  test.each(['--help', '-h'])('%s prints usage to stdout and exits 0 without starting', (flag) => {
    const { result, stdout, stderr } = parse([flag]);

    expect(result).toEqual({ start: false, exitCode: 0 });
    expect(stderr).toBe('');
    expect(stdout).toContain('Usage: pos-cli-mcp [options]');
    expect(stdout).toContain('pos-cli mcp');
    expect(stdout).toContain('pos-cli mcp-config');
    expect(stdout).toContain('MCP_MIN_HOST');
    expect(stdout).toContain(`at most ${SHUTDOWN_DEADLINE_MS / 1000} seconds`);
    expect(stdout).toContain('</dev/null');
    for (const flag of ['--profile <name>', '--include-tools <names>', '--exclude-tools <names>']) {
      expect(stdout).toContain(flag);
    }
    for (const profile of PROFILE_NAMES) {
      expect(stdout).toMatch(new RegExp(`^ {4}${profile} +\\S`, 'm'));
    }
    expect(stdout).toContain('--profile none --include-tools a,b');
    expect(stdout).toContain('--no-http');
    expect(stdout).toContain('/mcp');
  });

  test('--help wins over an argument that would otherwise be rejected', () => {
    expect(parse(['config', '--help']).result).toEqual({ start: false, exitCode: 0 });
  });

  test.each(['--version', '-v'])('%s prints the version and exits 0 without starting', (flag) => {
    expect(parse([flag])).toEqual({ result: { start: false, exitCode: 0 }, stdout: '1.2.3\n', stderr: '' });
  });

  // `pos-cli mcp config` is how TASK-6 used to spell `pos-cli mcp-config`; it used to start a
  // server that never exited.
  test('`config` is refused with a pointer to pos-cli mcp-config', () => {
    const { result, stdout, stderr } = parse(['config']);

    expect(result).toEqual({ start: false, exitCode: 1 });
    expect(stdout).toBe('');
    expect(stderr).toContain("too many arguments");
    expect(stderr).toContain('run `pos-cli mcp-config`');
    expect(stderr).toContain('Run `pos-cli-mcp --help` for usage information.');
  });

  test.each([
    [['serve'], /too many arguments/],
    [['--', 'config'], /too many arguments/],
    [['--profle', 'dev'], /unknown option '--profle'/],
    [['--stdio'], /unknown option '--stdio'/],
    [['-x'], /unknown option '-x'/]
  ])('%j is refused with exit 1 and a message on stderr only', (argv, message) => {
    const { result, stdout, stderr } = parse(argv);

    expect(result).toEqual({ start: false, exitCode: 1 });
    expect(stdout).toBe('');
    expect(stderr).toMatch(message);
    expect(stderr).toContain('Run `pos-cli-mcp --help` for usage information.');
  });

  test('the mcp-config pointer is only given for a stray `config` argument', () => {
    expect(parse(['serve']).stderr).not.toContain('pos-cli mcp-config');
    expect(parse(['--profle', 'config']).stderr).not.toContain('pos-cli mcp-config');
  });

  test('parsing twice gives the same answer: no state leaks between calls', () => {
    expect(parse(['--profle']).result.exitCode).toBe(1);
    expect(parse(['--include-tools', 'a']).result.selection.include).toEqual(['a']);
    expect(parse(['--no-http']).result.http).toBe(false);
    expect(parse([]).result).toEqual({ start: true, http: true, selection: NO_SELECTION });
  });
});

describe('tool-selection options', () => {
  const selection = argv => {
    const { result, stderr } = parse(argv);
    expect(stderr).toBe('');
    return result.selection;
  };

  test('are passed through as given, for the resolver to judge', () => {
    expect(selection(['--profile', 'dev', '--include-tools', 'a', '--exclude-tools', 'b'])).toEqual({
      profile: 'dev', include: ['a'], exclude: ['b']
    });
    // Unknown names are the resolver's call, not a syntax error.
    expect(selection(['--profile', 'no-such', '--include-tools', 'no-such-tool'])).toEqual({
      profile: 'no-such', include: ['no-such-tool'], exclude: []
    });
  });

  test('comma-separated and repeated flags are equivalent, in order, trimmed', () => {
    const expected = { profile: undefined, include: ['a', 'b', 'c'], exclude: ['d', 'e'] };

    expect(selection(['--include-tools', 'a,b,c', '--exclude-tools', 'd,e'])).toEqual(expected);
    expect(selection(['--include-tools', 'a', '--include-tools', 'b', '--include-tools', 'c', '--exclude-tools', 'd', '--exclude-tools', 'e'])).toEqual(expected);
    expect(selection(['--include-tools=a, b', '--include-tools', ' c ', '--exclude-tools=d,e'])).toEqual(expected);
  });

  test.each([
    [['--include-tools', 'a,,b'], "option '--include-tools <names>' argument 'a,,b' is invalid. expected comma-separated tool names, with no empty entries."],
    [['--exclude-tools', 'a,'], "option '--exclude-tools <names>' argument 'a,' is invalid. expected comma-separated tool names, with no empty entries."],
    [['--include-tools', ''], "option '--include-tools <names>' argument '' is invalid."],
    [['--profile', 'dev', '--profile', 'full'], "option '--profile <name>' argument 'full' is invalid. given more than once."],
    [['--profile', ' '], "option '--profile <name>' argument ' ' is invalid. expected a profile name."],
    [['--profile'], "option '--profile <name>' argument missing"],
    [['--include-tools'], "option '--include-tools <names>' argument missing"]
  ])('%j is refused before anything starts', (argv, message) => {
    const { result, stdout, stderr } = parse(argv);

    expect(result).toEqual({ start: false, exitCode: 1 });
    expect(stdout).toBe('');
    expect(stderr).toContain(message);
    expect(stderr).toContain('Run `pos-cli-mcp --help` for usage information.');
  });
});
