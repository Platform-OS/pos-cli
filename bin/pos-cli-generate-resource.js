#!/usr/bin/env node

const program = require("commander");

const yeoman = require("yeoman-environment");
const env = yeoman.createEnv();
const path = require("path");
const chalk = require("chalk");

const runYeoman = (modelName, attributes, skipViews) => {
  const generatorName = 'crud'
  const generatorPath = path.join(__dirname, "..", "lib", "generators", generatorName);

  try {
    env.register(generatorPath, generatorName);
    env.run(`crud ${modelName} ${attributes.join(' ')}`, { skipViews: skipViews });
  } catch (e) {
    console.error(chalk.red("Error: "));
    console.error(e);
  }
}

const description = `Generate files for model and endpoints create, read, update, deletes.
  It produces model schema, graphql, pages, commands, html partials, translations.
  Generated endpoint is ready to access via https://<instance_url>/<model_name>s

  Example:

    pos-cli generate resource car car_model:string color:string year:integer`;
program
  .name('pos-cli generate resource')
  .description(description)
  .arguments('<model_name> <attributes...>')
  .option('-sv, --skip-views', 'skip pages and partials')
  .usage("<model_name> <attribute_name:type_attribute...>")
  .action(function (modelName, attributes, opts) {
    runYeoman(modelName, attributes, opts.skipViews);
  });

program.parse(process.argv);

if (!program.args.length) program.help();
