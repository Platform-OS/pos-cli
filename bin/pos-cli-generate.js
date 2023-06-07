#!/usr/bin/env node

const program = require("commander");
const yeoman = require("yeoman-environment");
const yeomanEnv = yeoman.createEnv();
const path = require("path");
const chalk = require("chalk");
const dir = require('../lib/directories');
const compact = require('lodash.compact');

const runYeoman = (generatorPath, attributes) => {
  try {
    const generatorName = path.basename(generatorPath);
    const generatorPathFull = `./${generatorPath}/index.js`;
    yeomanEnv.register(generatorPathFull, generatorName);

    const generatorArgs = compact([generatorName, attributes]);
    yeomanEnv.run(generatorArgs, {});
  } catch (e) {
    // TODO: catch the error from yeoman?
    console.log('foo');
    console.error(chalk.red("Error: "));
    console.error(e);
  }
}

const showHelpForGenerator = (generatorPath) => {
  const generatorName = path.basename(generatorPath);
  const generatorPathFull = `./${generatorPath}/index.js`;
  yeomanEnv.register(generatorPathFull, generatorName);

  const generator = yeomanEnv.get(generatorName);
  const generatorInstance = yeomanEnv.instantiate(generator, ['']);
  console.log(`Generator: ${generatorName}`);
  console.log(`  ${generatorInstance.description}`);
  console.log(`\nUsage: `);
  const usage = generatorInstance._arguments.map(arg => `<${arg.name}> `)
  console.log(
    `  pos-cli generate ${generatorPath} ${usage}`
  );
  console.log('\nArguments:');
  console.log(generatorInstance.argumentsHelp());
  console.log('');
}

const description = `Run generator
  Example:

    pos-cli generate modules/core/generators/<generator_name> <generator_attribues>`;
program
  .name('pos-cli generate')
  .description(description)
  .arguments('<generatorPath> [generatorAttributes]')
  // .argument('<generatorPath>', 'path to the generator directory')
  // .argument('[generatorAttributes]', 'arguments that will be passed to the generator')
  .option('--generator-help', 'show help for given generator')
  .usage("<generatorPath> [generatorAttributes]")
  .action(function (generatorPath, generatorAttributes, options) {
    if (options.generatorHelp){
      showHelpForGenerator(generatorPath);
    } else {
      runYeoman(generatorPath, generatorAttributes);
    }
  });

program.parse(process.argv);

if (!program.args.length) program.help();