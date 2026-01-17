import Generator from 'yeoman-generator';
import path from 'path';

export default class extends Generator {
  constructor(args, opts) {
    super(args, opts);

    this.description = 'Generate basic command files with build and check phase';
    this.argument('commandName', { type: String, required: true, description: 'name of the command' });
    this.props = {
      commandName: this.options.commandName,
      actionName: this.options.commandName.split('/').pop(),
      modelName: this.options.commandName.split('/')[0]
    };
  }

  writing() {
    try {
      this.fs.copyTpl(
        this.templatePath('./lib/commands/create.liquid'),
        this.destinationPath(`app/lib/commands/${this.props.commandName}.liquid`),
        this.props
      );

      this.fs.copyTpl(
        this.templatePath('./lib/commands/create/'),
        this.destinationPath(`app/lib/commands/${this.props.commandName}/`),
        this.props
      );

      this.fs.copyTpl(
        this.templatePath('./graphql/create.graphql'),
        this.destinationPath(`app/graphql/${this.props.commandName}.graphql`),
        this.props
      );
    } catch (e) {
      console.error(e);
    }
  }

  end() {
    console.log('Command generated');
  }
}
