#!/usr/bin/env node

const program = require("commander");

const yeoman = require("yeoman-environment");
const env = yeoman.createEnv();
const path = require("path");
const chalk = require("chalk");

const runYeoman = (modelName, attributes) => {
  const generatorName = 'rest_api'
  const generatorPath = path.join(__dirname, "..", "lib", "generators", generatorName);

  try {
    env.register(generatorPath, generatorName);
    env.run(`rest_api ${modelName}`, {});
  } catch (e) {
    console.error(chalk.red("Error: "));
    console.error(e);
  }
}

const description = `Generate files for rest api endpoints.
  Generated endpoint is ready to access via https://<instance_url>/api/<model_name>s

  Example:

    pos-cli generate rest-api car`;
program
  .description(description)
  .arguments('<model_name>')
  .usage("<model_name>")
  .action(function (modelName) {
    runYeoman(modelName);
  });

program.parse(process.argv);

if (!program.args.length) program.help();
