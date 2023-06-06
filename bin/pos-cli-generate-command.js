#!/usr/bin/env node

const program = require("commander");

const yeoman = require("yeoman-environment");
const yeomanEnv = yeoman.createEnv();
const path = require("path");
const chalk = require("chalk");
const dir = require('../lib/directories');

const runYeoman = (generatorPath, attributes) => {
  // const generatorName = 'command'
  // const generatorPath = path.join(__dirname, "..", "lib", "generators", generatorName);

  try {
    // yeomanEnv.register(path.join(__dirname, generatorPath), 'foo');
    const appDirectory = dir.APP;
    const generatorPathFull = `./${generatorPath}`;
    yeomanEnv.register(generatorPathFull, 'command');
    const generator = yeomanEnv.get('command');
    const inst = yeomanEnv.instantiate(generator, ['']);
    console.log('generator', inst.argumentsHelp());
    // console.log(yeomanEnv.help('command'));
    yeomanEnv.run(`command ${attributes}`, {});
    // console.log('argumentsHelp', generator.arguments);
  } catch (e) {
    console.error(chalk.red("Error: "));
    console.error(e);
  }
}

const description = `Generate files for command with build and check phase.
  Example:

    pos-cli generate command orders/cancel`;
program
  .name('pos-cli generate command')
  .description(description)
  .arguments('<generatorPath> <attributes>')
  .usage("<generatorPath>")
  .action(function (generatorPath, attributes) {
    runYeoman(generatorPath, attributes);
  });

program.parse(process.argv);

if (!program.args.length) program.help();
