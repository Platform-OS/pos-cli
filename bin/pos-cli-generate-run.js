#!/usr/bin/env node

const program = require("commander");
const yeoman = require("yeoman-environment");
const yeomanEnv = yeoman.createEnv();
const path = require("path");
const chalk = require("chalk");
const dir = require('../lib/directories');
const compact = require('lodash.compact');
const spawn = require('execa');
const reject = require('lodash.reject');
const table = require('text-table');
const logger = require('../lib/logger');

const registerGenerator = (generatorPath) => {
  const generatorName = path.basename(generatorPath);
  const generatorPathFull = `./${generatorPath}/index.js`;
  yeomanEnv.register(generatorPathFull, generatorName);

  try {
    const generator = yeomanEnv.get(generatorName);
  } catch(e) {
    if (e.message.includes('Cannot find module')){
      installModulesAndLoadGenerator(generatorPath, generatorName);
    }
  }
  return generatorName;
}

const installModulesAndLoadGenerator = (generatorPath, generatorName) => {
  console.log('# Trying to install missing packages');
  const modulePath = generatorPath.match(/modules\/\w+/)
  const moduleDir = `./${modulePath[0]}`;
  spawnCommand('npm', ['install'], { cwd: moduleDir });
  const generator = yeomanEnv.get(generatorName);
}

const runYeoman = async (generatorPath, attributes, options) => {
  const generatorName = registerGenerator(generatorPath);
  const generatorArgs = compact([generatorName, attributes]);
  await yeomanEnv.run(generatorArgs, options);
}

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
  })

  return table(rows);
}

const showHelpForGenerator = (generatorPath) => {
  const generatorName = registerGenerator(generatorPath);
  const generator = yeomanEnv.get(generatorName);
  const generatorInstance = yeomanEnv.instantiate(generator, ['']);
  console.log(`Generator: ${generatorName}`);
  console.log(`  ${generatorInstance.description}`);
  console.log(`\nUsage: `);
  const usage = generatorInstance._arguments.map(arg => `<${arg.name}> `).join(' ')
  console.log(
    `  pos-cli generate ${generatorPath} ${usage}`
  );
  console.log('\nArguments:');
  console.log(generatorInstance.argumentsHelp());
  console.log(optionsHelp(generatorInstance._options));
  console.log('');
}

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
}

spawnCommand = (command, args, opt) => {
  return spawn.sync(command, args, {
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
  .arguments('<generatorPath> [generatorAttributes]', 'path to the generator directory')
  .option('--generator-help', 'show help for given generator')
  .allowUnknownOption()
  .usage("<generatorPath> [generatorAttributes]", 'arguments that will be passed to the generator')
  .action(async function (generatorPath, generatorAttributes, options, command) {
    try{
      if (options.generatorHelp){
        showHelpForGenerator(generatorPath);
      } else {
        const extraOptions = unknownOptions(command);
        await runYeoman(generatorPath, generatorAttributes, extraOptions);
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
