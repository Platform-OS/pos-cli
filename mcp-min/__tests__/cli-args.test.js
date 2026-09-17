/**
 * `pos-cli-mcp` and `pos-cli mcp` accept no arguments besides --help and --version, and refuse
 * everything else before a transport starts. Spawned-process coverage of the same contract is
 * in cli-invocation.test.js.
 */
import { describe, test, expect } from 'vitest';
import { parseServerArgs } from '../cli-args.js';
import { SHUTDOWN_DEADLINE_MS } from '../lifecycle.js';

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
  test.each([[[]], [['--']]])('%j starts the server and prints nothing', (argv) => {
    expect(parse(argv)).toEqual({ result: { start: true }, stdout: '', stderr: '' });
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
    expect(parse([]).result).toEqual({ start: true });
  });
});
