import stripAnsi from 'strip-ansi';

// Returns individual output lines from CLI stdout/stderr with ANSI codes,
// logger timestamps ([HH:MM:SS]), and leading ora symbols stripped,
// leaving only the plain message text.
const plainMessages = (output) =>
  stripAnsi(output)
    .split('\n')
    .map(l => l.replace(/^\[\d{2}:\d{2}:\d{2}\] /, '').replace(/^[-✔✖⚠ℹ] /, '').trim())
    .filter(Boolean);

export { plainMessages };
