import Generator from 'yeoman-generator';
import pluralize from 'pluralize';
import startCase from 'lodash.startcase';

export default class extends Generator {
  constructor(args, opts) {
    super(args, opts);

    this.description = 'Generate table definition and commands for CRUD with graphql files';
    this.argument('modelName', { type: String, required: true, description: 'name of the table' });
    this.argument('attributes', { type: Array, required: false, description: 'table column names with types', default: [] });
    this.option('includeViews', { type: Boolean, default: false, description: 'generate pages and partials', hide: 'no' });

    const attributes = this.options.attributes.map((attr) => {
      const values = attr.split(':');
      return {
        name: values[0],
        nameHuman: startCase(values[0]),
        type: values[1]
      };
    });
    this.props = {
      modelName: this.options.modelName,
      modelNamePlural: pluralize(this.options.modelName),
      attributes: attributes,
      graphqlArgumentMap: {
        string: 'String',
        text: 'String',
        integer: 'Int',
        boolean: 'Boolean',
        float: 'Float',
        date: 'String',
        datetime: 'String',
        array: '[String]'
      },
      graphqlArgumentValueMap: {
        string: 'value',
        text: 'value',
        integer: 'value_int',
        boolean: 'value_boolean',
        float: 'value_float',
        date: 'value',
        datetime: 'value',
        array: 'value_array'
      },
      graphqlPropertyMap: {
        string: 'property',
        text: 'property',
        integer: 'property_int',
        boolean: 'property_boolean',
        float: 'property_float',
        date: 'property',
        datetime: 'property',
        array: 'property_array'
      }
    };
  }

  writing() {
    try {
      this.fs.copyTpl(
        this.templatePath('./translations/model.yml'),
        this.destinationPath(`app/translations/en/${this.props.modelNamePlural}.yml`),
        this.props
      );
      this.fs.copyTpl(
        this.templatePath('./schema/model.yml'),
        this.destinationPath(`app/schema/${this.props.modelName}.yml`),
        this.props
      );
      this.fs.copyTpl(
        this.templatePath('./graphql/*.graphql'),
        this.destinationPath(`app/graphql/${this.props.modelNamePlural}/`),
        this.props
      );
      this.fs.copyTpl(
        this.templatePath('./lib/queries/model'),
        this.destinationPath(`app/lib/queries/${this.props.modelNamePlural}`),
        this.props
      );
      this.fs.copyTpl(
        this.templatePath('./lib/commands/model'),
        this.destinationPath(`app/lib/commands/${this.props.modelNamePlural}`),
        this.props
      );
      this.fs.copyTpl(
        this.templatePath('./config.yml'),
        this.destinationPath('app/config.yml'),
        this.props
      );
      if(this.options.includeViews) {
        this.fs.copyTpl(
          this.templatePath('./views/pages/model'),
          this.destinationPath(`app/views/pages/${this.props.modelNamePlural}`),
          this.props
        );
        this.fs.copyTpl(
          this.templatePath('./views/partials/theme/simple/model'),
          this.destinationPath(`app/views/partials/theme/simple/${this.props.modelNamePlural}`),
          this.props
        );
        this.fs.copyTpl(
          this.templatePath('./views/partials/theme/simple/field_error.liquid'),
          this.destinationPath('app/views/partials/theme/simple/field_error.liquid'),
          this.props
        );
      }
    } catch (e) {
      console.error(e);
    }
  }

  end() {
    console.log('CRUD generated');
  }
}
