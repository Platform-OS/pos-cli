#!/usr/bin/env node

const program = require('commander'),
  fs = require('fs'),
  logger = require('../lib/logger'),
  fetchAuthData = require('../lib/settings').fetchSettings,
  yaml = require('js-yaml'),
  version = require('../package.json').version,
  dir = require('../lib/directories'),
  Gateway = require('../lib/proxy');

program
  .version(version)
  .arguments('[environment]', 'Name of environment. Example: staging')
  .option('-c --config-file <config-file>', 'config file path', '.marketplace-kit')
  .option('-t --type <type>', 'item type - LiquidView', 'Page')
  .action((environment, params) => {
    process.env.CONFIG_FILE_PATH = params.configFile;
    const authData = fetchAuthData(environment, program);
    const itemsQuery = `{ items: cms_items(type: ${params.type}) { results { type name: resource_name data }}}`;
    const typesQuery = '{ itemTypes: cms_discovery { results { name  path  fields  }}}';
    const gateway = new Gateway(authData);

    gateway.graph(typesQuery).then(typesResponse => {
      const types = typesResponse.data.itemTypes.results;

      gateway.graph(itemsQuery).then(response => {
        const files = response.data.items.results;

        [...files].forEach(file => {
          logger.Info(`File: ${file}`);
          let type = types.find(t => t.name == file.type);

          const source = new Liquid(file, type);
          fs.writeFileSync(source.path, source.output, logger.Error);
        });
      }, logger.Error);
    }, logger.Error);
  });

const LIQUID_TEMPLATE = '---\nMETADATA---\nCONTENT';

class Liquid {
  constructor(source, type) {
    this.source = source;
    this.type = type;
    this.content = source.data.content || source.data.body || '';
  }

  get path() {
    return `${dir.APP}/${this.type.path.base}/${this.source.name}.${this.type.path.ext}`;
  }

  get metadata() {
    const metadata = Object.assign(this.source.data);
    delete metadata.content;
    delete metadata.body;
    return metadata;
  }

  get output() {
    return LIQUID_TEMPLATE.replace('METADATA', this.serialize(this.metadata)).replace('CONTENT', this.content);
  }

  serialize(obj) {
    return yaml.safeDump(obj);
  }
}

program.parse(process.argv);
