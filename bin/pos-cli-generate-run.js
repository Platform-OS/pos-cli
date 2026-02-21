#!/usr/bin/env node

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { program } from 'commander';
import { createEnv } from 'yeoman-environment';
const yeomanEnv = createEnv();
import { execaSync } from 'execa';
import table from 'text-table';
import logger from '../lib/logger.js';
import { confirm } from '@inquirer/prompts';

/**
 * Validates that the generator exists and can be loaded
 * @param {string} generatorPath - Path to the generator directory
 * @throws {Error} If generator is invalid or doesn't exist
 */
const validateGenerator = (generatorPath) => {
  const resolvedPath = path.resolve(generatorPath);
  const indexPath = path.join(resolvedPath, 'index.js');

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Generator directory not found: ${generatorPath}`);
  }

  if (!fs.existsSync(indexPath)) {
    throw new Error(`Generator index.js not found at: ${indexPath}`);
  }

  const stats = fs.statSync(resolvedPath);
  if (!stats.isDirectory()) {
    throw new Error(`Generator path is not a directory: ${generatorPath}`);
  }
};

/**
 * Finds the nearest package.json by walking up from the generator path
 * @param {string} generatorPath - Path to the generator directory
 * @returns {string|null} Path to the directory containing package.json, or null
 */
const findPackageRoot = (generatorPath) => {
  let currentDir = path.resolve(generatorPath);
  const rootDir = path.parse(currentDir).root;

  while (currentDir !== rootDir) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  return null;
};

/**
 * Validates and parses package.json
 * @param {string} packageJsonPath - Path to package.json
 * @returns {Object|null} Parsed package.json or null if invalid
 */
const parsePackageJson = (packageJsonPath) => {
  try {
    const content = fs.readFileSync(packageJsonPath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    logger.Warn(`Invalid package.json at ${packageJsonPath}: ${e.message}`);
    return null;
  }
};

/**
 * Gets package information for a generator
 * @param {string} generatorPath - Path to the generator directory
 * @returns {{packageRoot: string, pkg: Object}|null} Package info or null
 */
const getPackageInfo = (generatorPath) => {
  const packageRoot = findPackageRoot(generatorPath);
  if (!packageRoot) return null;

  const pkg = parsePackageJson(path.join(packageRoot, 'package.json'));
  if (!pkg) return null;

  return { packageRoot, pkg };
};

/**
 * Checks if dependencies need to be installed
 * @param {Object} pkg - Parsed package.json
 * @param {string} packageRoot - Directory containing package.json
 * @returns {boolean} True if installation is needed
 */
const needsInstallation = (pkg, packageRoot) => {
  const hasDeps = pkg.dependencies || pkg.devDependencies || pkg.peerDependencies;
  return hasDeps && !fs.existsSync(path.join(packageRoot, 'node_modules'));
};

/**
 * Prompts user for confirmation before installing dependencies
 * @param {string} packageRoot - Directory containing package.json
 * @param {Object} pkg - Parsed package.json
 * @param {boolean} autoConfirm - Skip prompt if true
 * @returns {Promise<boolean>} True if user confirmed or autoConfirm is true
 */
const confirmInstallation = async (packageRoot, pkg, autoConfirm) => {
  if (autoConfirm) {
    return true;
  }

  const packageJsonPath = path.join(packageRoot, 'package.json');

  const lines = ['\nGenerator dependencies need to be installed:'];
  lines.push(`  Package: ${pkg.name || 'unnamed'}`);
  lines.push(`  Location: ${packageJsonPath}`);

  const depCount = pkg.dependencies ? Object.keys(pkg.dependencies).length : 0;
  const devDepCount = pkg.devDependencies ? Object.keys(pkg.devDependencies).length : 0;
  const peerDepCount = pkg.peerDependencies ? Object.keys(pkg.peerDependencies).length : 0;

  if (depCount > 0) {
    lines.push(`  Dependencies: ${depCount}`);
  }
  if (devDepCount > 0) {
    lines.push(`  Dev dependencies: ${devDepCount}`);
  }
  if (peerDepCount > 0) {
    lines.push(`  Peer dependencies: ${peerDepCount}`);
  }

  lines.push('');

  console.log(lines.join('\n'));

  try {
    const answer = await confirm({
      message: 'Install dependencies?',
      default: true
    });
    return answer;
  } catch {
    // User cancelled with Ctrl+C
    return false;
  }
};

/**
 * Installs dependencies for the generator
 * @param {string} packageRoot - Directory containing package.json
 * @throws {Error} If installation fails
 */
const installDependencies = (packageRoot) => {
  logger.Info('Installing generator dependencies...', { hideTimestamp: false });

  try {
    spawnCommand('npm', ['install'], { cwd: packageRoot });
    logger.Success('Dependencies installed successfully', { hideTimestamp: false });
  } catch (e) {
    throw new Error(`Failed to install dependencies: ${e.message}`);
  }
};

/**
 * Sets up generator dependencies by finding and installing package dependencies
 * @param {string} generatorPath - Path to the generator directory
 * @param {boolean} autoConfirm - Skip confirmation prompt if true
 * @returns {Promise<void>}
 */
const setupGeneratorDependencies = async (generatorPath, autoConfirm = false) => {
  const packageInfo = getPackageInfo(generatorPath);
  if (!packageInfo) return;

  const { packageRoot, pkg } = packageInfo;

  if (needsInstallation(pkg, packageRoot)) {
    const confirmed = await confirmInstallation(packageRoot, pkg, autoConfirm);

    if (!confirmed) {
      logger.Warn('Dependency installation skipped by user');
      logger.Warn('Generator may fail if it has missing dependencies');
      return;
    }

    try {
      installDependencies(packageRoot);
    } catch (e) {
      logger.Warn(`Could not install dependencies for generator: ${e.message}`);
      logger.Warn('Generator may fail if it has missing dependencies');
    }
  }
};

/**
 * Registers a generator with Yeoman environment
 * @param {string} generatorPath - Path to the generator directory
 * @param {boolean} autoConfirm - Skip confirmation prompt if true
 * @returns {Promise<string>} The registered generator name
 * @throws {Error} If generator cannot be registered
 */
const registerGenerator = async (generatorPath, autoConfirm = false) => {
  validateGenerator(generatorPath);

  const generatorName = path.basename(generatorPath);
  const generatorPathFull = path.resolve(generatorPath, 'index.js');

  await setupGeneratorDependencies(generatorPath, autoConfirm);

  yeomanEnv.register(generatorPathFull, generatorName);

  // Verify registration succeeded
  // If this fails, it typically means:
  // 1. Generator has undeclared dependencies not in package.json
  // 2. Generator uses dynamic requires that weren't caught during setup
  // 3. There's a syntax error in the generator code
  try {
    yeomanEnv.get(generatorName);
  } catch (e) {
    if (e.message.includes('Cannot find module')) {
      throw new Error(
        `Generator registration failed due to missing module: ${e.message}\n` +
        'This usually means the generator has an undeclared dependency.\n' +
        `Try running 'npm install' manually in: ${path.dirname(generatorPath)}`
      );
    }
    throw e;
  }

  return generatorName;
};

const runYeoman = async (generatorPath, attributes, options, autoConfirm) => {
  const generatorName = await registerGenerator(generatorPath, autoConfirm);
  const generatorArgs = [generatorName, ...attributes].filter(Boolean);
  await yeomanEnv.run(generatorArgs, options);
};

const optionsHelp = (generatorOptions) => {
  // generatorOptions can be either an object or array
  const optionsArray = Array.isArray(generatorOptions)
    ? generatorOptions
    : Object.values(generatorOptions);

  const visibleOptions = optionsArray.filter(opt => opt.hide !== true);

  const rows = visibleOptions.map(opt => [
    '',
    opt.alias ? `-${opt.alias}, ` : '',
    `--${opt.name}`,
    opt.description ? `# ${opt.description}` : '',
    opt.default ? `Default: ${opt.default}` : ''
  ]);

  return table(rows);
};

/**
 * Extracts help information from a generator instance
 * Uses private Yeoman APIs (_arguments, _options) which may change
 * @param {Object} generator - Yeoman generator instance
 * @returns {Object} Help information with arguments, options, and usage
 */
const getGeneratorHelp = (generator) => {
  return {
    arguments: generator._arguments || [],
    options: generator._options || [],
    usage: generator._arguments
      ? generator._arguments.map(arg => `<${arg.name}> `).join('')
      : ''
  };
};

/**
 * Displays help information for a specific generator
 * @param {string} generatorPath - Path to the generator directory
 * @param {boolean} autoConfirm - Skip confirmation prompt if true
 * @returns {Promise<void>}
 */
const showHelpForGenerator = async (generatorPath, autoConfirm = false) => {
  const generatorName = await registerGenerator(generatorPath, autoConfirm);
  const generator = yeomanEnv.get(generatorName);
  const generatorInstance = yeomanEnv.instantiate(generator, ['']);

  logger.Info(`Generator: ${generatorName}`, { hideTimestamp: true });
  logger.Info(`  ${generatorInstance.description || 'No description available'}`, { hideTimestamp: true });
  logger.Info('\nUsage: ', { hideTimestamp: true });

  const help = getGeneratorHelp(generatorInstance);
  logger.Info(
    `  pos-cli generate ${generatorPath} ${help.usage}`,
    { hideTimestamp: true }
  );

  logger.Info('\nArguments:', { hideTimestamp: true });
  const argsHelp = generatorInstance.argumentsHelp
    ? generatorInstance.argumentsHelp()
    : formatArgumentsHelp(help.arguments);
  logger.Info(argsHelp, { hideTimestamp: true });

  logger.Info(optionsHelp(help.options), { hideTimestamp: true });
  logger.Info('', { hideTimestamp: true });
};

const formatArgumentsHelp = (args) => {
  if (!args || args.length === 0) {
    return '  (No arguments required)';
  }
  return args.map(arg => `  <${arg.name}>  ${arg.description || ''}`).join('\n');
};

const unknownOptions = (command) => {
  const options = {};
  command.args.forEach(arg => {
    const match = arg.match(/^--?([^=]+)(?:=(.*))?$/);
    if (match) {
      const optionName = match[1];
      const optionValue = match[2] || true;
      options[optionName] = optionValue;
    }
  });
  return options;
};

const spawnCommand = (command, args, opt) => {
  return execaSync(command, args, {
    stdio: 'inherit',
    ...opt
  });
};

const description = `Run a generator from any directory

  Generators can be located in module directories or custom paths.
  If dependencies need to be installed, you will be prompted for confirmation
  unless --auto-confirm is used.

  Examples:

    # Module generator with help
    pos-cli generate modules/core/generators/crud --generator-help

    # Module generator with arguments
    pos-cli generate modules/core/generators/crud product name:string price:integer

    # Custom generator in any directory
    pos-cli generate my/custom/generator arg1 arg2

    # Generator with options
    pos-cli generate modules/core/generators/crud article title:text --includeViews

    # Auto-confirm dependency installation (useful for CI/CD)
    pos-cli generate modules/core/generators/crud item name:string --auto-confirm`;

program
  .name('pos-cli generate')
  .description(description)
  .arguments('<generatorPath>', 'path to the generator directory (can be anywhere)')
  .argument('[generatorArguments...]', 'generator arguments')
  .option('--generator-help', 'show help for given generator')
  .option('--auto-confirm', 'automatically confirm dependency installation without prompting')
  .allowUnknownOption()
  .usage('<generatorPath> <generatorArguments...>', 'arguments that will be passed to the generator')
  .action(async function (generatorPath, generatorArguments, options, command) {
    try {
      if (options.generatorHelp) {
        await showHelpForGenerator(generatorPath, options.autoConfirm);
      } else {
        const extraOptions = unknownOptions(command);
        await runYeoman(generatorPath, generatorArguments, extraOptions, options.autoConfirm);
      }
    } catch (e) {
      await logger.Error(`${e.message}`, { exit: false });

      if (e.message.includes('argument') && !options.generatorHelp) {
        try {
          await showHelpForGenerator(generatorPath, options.autoConfirm);
        } catch (helpError) {
          await logger.Error(`Could not show help: ${helpError.message}`, { exit: true });
        }
      } else {
        process.exit(1);
      }
    }
  });

program.parse(process.argv);

if (!program.args.length) program.help();
