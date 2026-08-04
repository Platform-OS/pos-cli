import ora from 'ora';

/**
 * ora, with Ctrl+C left working.
 *
 * Two ora defaults bear on Ctrl+C. One is turned off here; the other is left on but puts
 * a condition on callers. Import this instead of 'ora' anywhere a spinner is shown.
 *
 * `discardStdin` keeps keys typed during a spinner from being echoed over the spinner
 * line, and buys that by putting the terminal into raw mode — which switches off the
 * terminal's own ^C -> SIGINT translation. stdin-discarder is supposed to make up for
 * that by re-raising SIGINT when it reads a 0x03 byte, but it attaches its reader with
 * `prependListener('data')` — which, unlike `on('data')`, does not flip the stream into
 * flowing mode — and only calls `resume()` when stdin was already paused, which a
 * never-touched `process.stdin` is not. Nothing reads the byte, so Ctrl+C raises no
 * signal at all and the terminal does not even echo ^C.
 *
 * `hideCursor` is left ON, but it comes with a condition worth knowing about. Hiding the
 * cursor makes ora register a restore hook via cli-cursor -> restore-cursor -> signal-exit,
 * and that hook is a `process.on('SIGINT')` listener. Any JS listener takes SIGINT off
 * Node's default disposition: instead of the kernel ending the process outright, the
 * signal is queued for the event loop. So Ctrl+C is only as fast as the loop is free, and
 * a command that holds the loop in a long synchronous stretch shows ^C and then carries
 * on as if nothing happened. Commands should therefore keep the event loop free while a
 * spinner is up; the Liquid linter runs on a worker thread for this reason (see
 * lib/check-worker.js). Other commands still block under a spinner — `data import`
 * parses and transforms the whole file on the main thread, `data export` stringifies and
 * writes it — so this is a known-incomplete invariant, not a settled one. The deeper fix
 * is either moving that work off the main thread too, or turning hideCursor off here and
 * accepting a visible cursor, which removes the SIGINT listener entirely.
 *
 * The cost of opting out of discardStdin is cosmetic: keys typed during a spinner echo
 * over the spinner line.
 */
const spinner = (options = {}) => ora({ discardStdin: false, ...options });

export default spinner;
