import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const bin = `node ${path.join(__dirname, '../../bin', 'pos-cli.js')}`;

export default bin;
