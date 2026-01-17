#!/usr/bin/env node

import { program } from 'commander';
import degit from 'degit';
import inquirer from 'inquirer';

import logger from '../lib/logger.js';
import report from '../lib/logger/report.js';

const repos = {
  empty: 'mdyd-dev/directory-structure',
  'Hello world': 'mdyd-dev/hello-world',
  'Todo app': 'mdyd-dev/todo-app',
  'Product Marketplace Template': 'mdyd-dev/product-marketplace-template',
};

function createStructure(url, branch) {
  branch = branch ? `#${branch}` : '';

  degit(`${url}${branch}`, { force: true, cache: false, verbose: false })
    .clone('.')
    .then(() => {
      report('[OK] Init');
      logger.Success('Directory structure sucessfully created.');
    })
    .catch((error) => {
      report('[ERR] Init');
      logger.Error(`Cloning failed. Reason: ${error.message}`);
    });
}

program
  .name('pos-cli init')
  .option(
    '--url <url>',
    'structure source repository url (github, bitbucket, gitlab). \nRead more on accepted formats: https://github.com/Rich-Harris/degit#usage \n'
  )
  .option('--branch <branch>', 'branch where the structure is located')
  .option('-w, --wizard', 'Start repo wizard')
  .action(async (params) => {
    if (params.wizard) {
      inquirer
        .prompt([
          {
            type: 'list',
            name: 'repo',
            message: 'Example app',
            default: 'empty',
            choices: Object.keys(repos),
          },
          {
            type: 'string',
            name: 'branch',
            message: 'Branch',
            default: 'master',
          },
        ])
        .then((answers) => {
          createStructure(repos[answers.repo], answers.branch);

          report('Init: Wizard');
        })
      return;
    }

    const url = params.url || repos.empty;
    createStructure(url, params.branch);
  });

program.parse(process.argv);
