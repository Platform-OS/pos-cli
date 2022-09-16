#!/usr/bin/env node

const program = require("commander");

const yeoman = require("yeoman-environment");
const env = yeoman.createEnv();
const path = require("path");
const chalk = require("chalk");

const runYeoman = (modelName, attributes) => {
  const generatorName = 'command'
  const generatorPath = path.join(__dirname, "..", "lib", "generators", generatorName);

  try {
    env.register(generatorPath, generatorName);
    env.run(`command ${modelName}`, {});
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
  .arguments('<command_name>')
  .usage("<command_name>")
  .action(function (commandName) {
    runYeoman(commandName);
  });

program.parse(process.argv);

if (!program.args.length) program.help();
