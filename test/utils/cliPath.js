import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The pos-cli entry script as a plain filesystem path. It is handed to execFile as an argv
// element (see ./exec.js), never interpolated into a command line, so it carries neither a
// `node ` prefix nor quoting of its own.
const cliScript = path.join(__dirname, '../../bin', 'pos-cli.js');

export default cliScript;
