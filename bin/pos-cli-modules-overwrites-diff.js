#!/usr/bin/env node

const { program } = require('commander');
const logger = require('../lib/logger');
const { execSync } = require('child_process');
const overwrites = require('../lib/overwrites');

function getGitChangesAsJSON(overwrites = []) {
  try {
    // Run git status in porcelain mode
    const output = execSync('git status --porcelain', { encoding: 'utf8' });

    const filesStatus = output
      .split('\n')
      .reduce((acc, line) => {
        const status = line.slice(0, 2).trim(); // Status code (e.g., M, D, A)
        const file = line.slice(3).trim();     // File path
        if (overwrites.includes(file)) {
          acc.push({ status, file });
        }
        return acc;
      }, []);

    // Organize changes by type
    const jsonOutput = {
      modified: filesStatus.filter(item => item.status === 'M').map(item => item.file),
      removed: filesStatus.filter(item => item.status === 'D').map(item => item.file),
      added: filesStatus.filter(item => item.status === 'A').map(item => item.file),
      untracked: filesStatus.filter(item => item.status === '??').map(item => item.file)
    };

    return jsonOutput;
  } catch (error) {
    logger.Error(`Error running git status: ${error}`);
  }
}

program
  .name('pos-cli modules overwrites diff')
  .action(() => {
    const gitChanges = getGitChangesAsJSON(overwrites.list());
    logger.Info(gitChanges);
  });

program.parse(process.argv);
