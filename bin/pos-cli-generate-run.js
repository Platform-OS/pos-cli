#!/usr/bin/env node

import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { program } from 'commander';
import { createEnv } from 'yeoman-environment';
const yeomanEnv = createEnv();
import compact from 'lodash.compact';
import { execaSync } from 'execa';
import reject from 'lodash.reject';
import table from 'text-table';
import logger from '../lib/logger.js';

const registerGenerator = (generatorPath) => {
  const generatorName = path.basename(generatorPath);
  const generatorPathFull = path.resolve(generatorPath, 'index.js');
  yeomanEnv.register(generatorPathFull, generatorName);

  try {
    yeomanEnv.get(generatorName);
  } catch(e) {
    if (e.message.includes('Cannot find module')){
      installModulesAndLoadGenerator(generatorPath, generatorName);
    }
  }
  return generatorName;
};

const installModulesAndLoadGenerator = (generatorPath, _generatorName) => {
  console.log('# Trying to install missing packages');
  const modulePath = generatorPath.match(/modules\/\w+/);
  const moduleDir = `./${modulePath[0]}`;
  spawnCommand('npm', ['install'], { cwd: moduleDir });
};

const runYeoman = async (generatorPath, attributes, options) => {
  const generatorName = registerGenerator(generatorPath);
  const generatorArgs = compact([generatorName].concat(attributes));
  await yeomanEnv.run(generatorArgs, options);
};

const optionsHelp = (generatorOptions) => {
  const options = reject(generatorOptions, (x) => x.hide != 'no');
  const rows = options.map((opt) => {
    return [
      '',
      opt.alias ? `-${opt.alias}, ` : '',
      `--${opt.name}`,
      opt.description ? `# ${opt.description}` : '',
      opt.default !== undefined && opt.default !== ''
        ? 'Default: ' + opt.default
        : ''
    ];
  });

  return table(rows);
};

const getGeneratorHelp = (generator) => {
  const help = { arguments: [], options: [], usage: '' };

  try {
    if (generator._arguments && Array.isArray(generator._arguments)) {
      help.arguments = generator._arguments;
      help.usage = generator._arguments.map(arg => `<${arg.name}> `).join(' ');
    }
  } catch {
    // Ignore - internal API not available
  }

  try {
    if (generator._options && Array.isArray(generator._options)) {
      help.options = generator._options;
    }
  } catch {
    // Ignore - internal API not available
  }

  return help;
};

const showHelpForGenerator = (generatorPath) => {
  const generatorName = registerGenerator(generatorPath);
  const generator = yeomanEnv.get(generatorName);
  const generatorInstance = yeomanEnv.instantiate(generator, ['']);
  console.log(`Generator: ${generatorName}`);
  console.log(`  ${generatorInstance.description || 'No description available'}`);
  console.log('\nUsage: ');

  const help = getGeneratorHelp(generatorInstance);
  console.log(
    `  pos-cli generate ${generatorPath} ${help.usage}`
  );

  console.log('\nArguments:');
  try {
    console.log(generatorInstance.argumentsHelp ? generatorInstance.argumentsHelp() : formatArgumentsHelp(help.arguments));
  } catch {
    console.log(formatArgumentsHelp(help.arguments));
  }
  console.log(optionsHelp(help.options));
  console.log('');
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
    cwd: '',
    ...opt
  });
};

const description = `Run generator
  Example:

    pos-cli generate modules/core/generators/<generator_name> --generator-help
    pos-cli generate modules/core/generators/<generator_name> <generator_attribues>`;
program
  .name('pos-cli generate')
  .description(description)
  .arguments('<generatorPath>', 'path to the generator directory')
  .argument('[generatorArguments...]', 'generator arguments')
  .option('--generator-help', 'show help for given generator')
  .allowUnknownOption()
  .usage('<generatorPath> <generatorArguments...>', 'arguments that will be passed to the generator')
  .action(async function (generatorPath, generatorArguments, options, command) {
    try{
      if (options.generatorHelp){
        showHelpForGenerator(generatorPath);
      } else {
        const extraOptions = unknownOptions(command);
        await runYeoman(generatorPath, generatorArguments, extraOptions);
      }
    } catch (e) {
      logger.Error(`Error: ${e.message}`, { exit: false });
      if(e.message.includes('argument') && !options.generatorHelp) {
        showHelpForGenerator(generatorPath);
      }
    }
  });

program.parse(process.argv);

if (!program.args.length) program.help();
