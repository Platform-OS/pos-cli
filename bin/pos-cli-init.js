#!/usr/bin/env node

const program = require('commander'),
  degit = require('degit'),
  inquirer = require('inquirer');

const logger = require('../lib/logger'),
  report = require('../lib/logger/report');

const repos = {
  empty: 'mdyd-dev/directory-structure',
  'Hello world': 'mdyd-dev/hello-world',
  'Todo app': 'mdyd-dev/todo-app.git',
};

function createStructure(url, branch) {
  branch = branch ? `#${branch}` : '';

  degit(`${url}${branch}`, { force: true, cache: false, verbose: false })
    .clone('.')
    .then(() => {
      report('Init', {
        extras: [
          { key: 'status', value: 'Success' },
          { key: 'hasBranch', value: !!branch },
        ],
      });
      logger.Success('Directory structure sucessfully created.');
    })
    .catch((error) => {
      report('Init', {
        extras: [
          { key: 'status', value: 'Error' },
          { key: 'hasBranch', value: !!branch },
        ],
      });
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
  .option('--wizard', 'Start repo wizzard')
  .action(async (params) => {
    if (params.wizard) {
      inquirer
        .prompt([
          {
            type: 'list',
            name: 'repo',
            message: 'Example app',
            default: 'empty',
            choices: ['empty', 'Hello world', 'Todo app'],
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
        });
      return;
    }

    const url = params.url || repos.empty;
    createStructure(url, params.branch);
  });

program.parse(process.argv);
