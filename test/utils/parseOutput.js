import stripAnsi from 'strip-ansi';
import logSymbols from 'log-symbols';

// Build a set of plain (no-ANSI) spinner symbols from log-symbols.
// This covers both Unicode (✔ ✖ ⚠ ℹ) and ASCII fallbacks used on Windows (√ × ‼ i).
const SPINNER_SYMBOLS = new Set(Object.values(logSymbols).map(s => stripAnsi(s)));

// Returns individual output lines from CLI stdout/stderr with ANSI codes,
// logger timestamps ([HH:MM:SS]), and leading ora symbols stripped,
// leaving only the plain message text.
const plainMessages = (output) =>
  stripAnsi(output)
    .split('\n')
    .map(l => {
      l = l.replace(/^\[\d{2}:\d{2}:\d{2}\] /, '');
      if (l.length >= 2 && SPINNER_SYMBOLS.has(l[0]) && l[1] === ' ') l = l.slice(2);
      return l.trim();
    })
    .filter(Boolean);

export { plainMessages };
