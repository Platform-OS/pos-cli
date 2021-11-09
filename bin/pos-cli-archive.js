#!/usr/bin/env node
const program = require('commander');

const audit = require('../lib/audit');
const archive = require('../lib/archive');

const createArchive = async (env) => {
  const numberOfFiles = await archive.makeArchive(env, { withoutAssets: false });
  if (numberOfFiles == 0) throw 'Archive failed to create.';
};

const runAudit = async () => {
  if (process.env.CI == 'true') {
    return;
  }

  await audit.run();
};

program
  .name('pos-cli archive')
  .option('-o --output <output>', 'archive filename', './tmp/release-archive.zip')
  .action(async (params) => {
    await runAudit();

    const env = Object.assign(
      process.env, {
        CI: process.env.CI === 'true',
        TARGET: params.output
      });

    await createArchive(env)
  });

program.parse(process.argv);
