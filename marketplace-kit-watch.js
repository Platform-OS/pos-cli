#!/usr/bin/env node

const program = require('commander'),
  request = require('request'),
  fs = require('fs'),
  watch = require('node-watch'),
  notifier = require('node-notifier'),
  version = require('./package.json').version;

const DEFAULT_FILES =
  'js,css,liquid,graphql,yml,html,ttf,otf,woff,woff2,svg,ico,gif,jpg,jpeg,png,webp,webm,mp3,mp4,csv,xls,pdf,doc,docx';

const shouldBeSynced = (path, event) => {
  return !fileRemoved(event) && extensionAllowed(ext(path)) && !isHiddenFile(filename(path));
};

const isHiddenFile = filename => {
  return filename.startsWith('.');
};

const extensionAllowed = ext => program.files.split(',').includes(ext);
const filename = path => path.split('/').pop();
const ext = path => path.split('.').pop();
const fileRemoved = event => event === 'remove';

program
  .version(version)
  .option('--token <token>', 'authentication token', process.env.MARKETPLACE_TOKEN)
  .option('--url <url>', 'marketplace url', process.env.MARKETPLACE_URL)
  .option('--files <files>', 'watch files', process.env.FILES || DEFAULT_FILES)
  .parse(process.argv);

const checkParams = (params) => {
  const errors = [];
  if (typeof params.token === 'undefined') {
    errors.push(' no token given! Please add --token token');
  }
  if (typeof params.url === 'undefined') {
    errors.push(' no URL given. Please add --url URL');
  }

  if (errors.length > 0) {
    console.error("Missing arguments:");
    console.error(errors.join('\n'));
    params.help();
    process.exit(1);
  };
};

checkParams(program);
console.log('Sync mode enabled.');

watch('marketplace_builder/', { recursive: true }, (event, file) => {
  shouldBeSynced(file, event) && pushFile(file);
});

const pushFile = path => {
  process.stdout.write(`Syncing: ${path}`);
  request(
    {
      uri: program.url + 'api/marketplace_builder/marketplace_releases/sync',
      method: 'PUT',
      headers: { UserTemporaryToken: program.token },
      formData: {
        path: path.replace('marketplace_builder/', ''),
        marketplace_builder_file_body: fs.createReadStream(path)
      }
    },
    (error, response, body) => {
      if (error) console.log(error);
      else {
        if (body != '{}') {
          notifier.notify({ title: 'MarkeplaceKit Sync Error', message: body });
          process.stdout.write(`\n${body}\n`);
        }
        else
          process.stdout.write(' - ok\n')
      }
    }
  );
};
