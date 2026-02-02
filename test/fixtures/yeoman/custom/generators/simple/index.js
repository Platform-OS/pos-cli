import Generator from 'yeoman-generator';

export default class extends Generator {
  constructor(args, opts) {
    super(args, opts);

    this.description = 'Simple custom generator for testing';
    this.argument('name', { type: String, required: true, description: 'name of the item' });
  }

  writing() {
    try {
      this.fs.write(
        this.destinationPath(`app/${this.options.name}.txt`),
        `Custom generator output: ${this.options.name}\n`
      );
    } catch (e) {
      console.error(e);
    }
  }

  end() {
    console.log('Simple generator completed');
  }
}
