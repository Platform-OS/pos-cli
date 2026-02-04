import path from 'path';
import table from 'text-table';
import { execaSync } from 'execa';
import fastGlob from 'fast-glob';
import yeoman from 'yeoman-environment';

function listGeneratorPathsSync(globSync) {
  const glob = globSync || fastGlob.sync;
  const files = glob('**/generators/*/index.js', { dot: false, ignore: ['**/node_modules/**', '**/.git/**'] });
  const entries = files.map((f) => {
    const generatorPath = f.replace(/\/index\.js$/, '');
    const name = generatorPath.split('/').pop();
    return { name, path: generatorPath };
  });
  return entries;
}

function ensureEnv(yeomanEnv) {
  if (yeomanEnv) return yeomanEnv;
  return yeoman.createEnv();
}

function registerGenerator(generatorPath, yeomanEnv) {
  const env = ensureEnv(yeomanEnv);
  const generatorName = path.basename(generatorPath);

  // Resolve absolute path to the generator's index.js (support absolute and relative inputs)
  const fullIndexPath = path.isAbsolute(generatorPath)
    ? path.join(generatorPath, 'index.js')
    : path.join(process.cwd(), generatorPath, 'index.js');

  env.register(fullIndexPath, generatorName);
  try {
    env.get(generatorName);
  } catch (e) {
    if (String(e.message || e).includes('Cannot find module')) {
      // Attempt dependency install in likely directories, then retry
      const candidates = [];
      // If path matches modules/<name>, try installing in that module root
      const m = generatorPath.match(/modules\/[^/]+/);
      if (m) candidates.push(path.isAbsolute(m[0]) ? m[0] : path.join(process.cwd(), m[0]));
      // Also try the generator root directory
      candidates.push(path.dirname(fullIndexPath));

      for (const dir of candidates) {
        try {
          execaSync('npm', ['install'], { stdio: 'inherit', cwd: dir });
        } catch (_) {}
      }
      // Retry loading the generator
      env.get(generatorName);
    } else {
      throw e;
    }
  }
  return { name: generatorName, env };
}

function showHelp(generatorPath, yeomanEnv) {
  const { name: generatorName, env } = registerGenerator(generatorPath, yeomanEnv);
  const generator = env.get(generatorName);
  const instance = env.instantiate(generator, ['']);
  const usage = instance._arguments.map((a) => `<${a.name}>`).join(' ');
  const argsHelp = instance.argumentsHelp();
  const rawOpts = instance._options || [];
  const optsArr = Array.isArray(rawOpts) ? rawOpts : Object.values(rawOpts);
  // Show options unless explicitly hidden (hide === true or 'yes')
  const rows = (optsArr || [])
    .filter((opt) => opt && !(opt.hide === true || String(opt.hide).toLowerCase() === 'yes'))
    .map((opt) => [ '', opt.alias ? `-${opt.alias}, ` : '', `--${opt.name}`, opt.description ? `# ${opt.description}` : '', (opt.default !== undefined && opt.default !== '') ? `Default: ${opt.default}` : '' ]);
  const optionsText = table(rows);
  const argsDetailed = (instance._arguments || []).map(a => ({ name: a.name, required: !!a.required }));
  const requiredArgs = argsDetailed.filter(a => a.required).map(a => a.name);
  const optionalArgs = argsDetailed.filter(a => !a.required).map(a => a.name);
  return {
    name: generatorName,
    description: instance.description || '',
    usage: `pos-cli generate ${generatorPath} ${usage}`.trim(),
    arguments: argsHelp,
    optionsTable: optionsText,
    args: argsDetailed,
    requiredArgs,
    optionalArgs
  };
}

async function runGenerator(generatorPath, attributes = [], options = {}, yeomanEnv) {
  const { name: generatorName, env } = registerGenerator(generatorPath, yeomanEnv);
  const args = [generatorName].concat(attributes || []);
  await env.run(args, options);
  return { ok: true };
}

export { listGeneratorPathsSync, showHelp, runGenerator };
