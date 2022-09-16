const Generator = require('yeoman-generator');
const chalk = require('chalk');
const path = require('path');
const pluralize = require('pluralize');
const fs = require('fs');

module.exports = class extends Generator {
  constructor(args, opts) {
    super(args, opts);

    this.argument('commandName', { type: String, required: true });
    this.props = {
      commandName: this.options.commandName
    };
  }

  writing() {
    try{
      this.fs.copyTpl(
        this.templatePath('./views/partials/lib/commands/create.liquid'),
        this.destinationPath(`app/views/partials/lib/commands/${this.props.commandName}.liquid`),
        this.props
      )

      this.fs.copyTpl(
        this.templatePath('./views/partials/lib/commands/create/'),
        this.destinationPath(`app/views/partials/lib/commands/${this.props.commandName}/`),
        this.props
      )
    } catch (e) {
      console.error(e);
    }
  }

  install() {
  }

  end() {
    console.log(chalk.green('Command generated'));
  }
};
