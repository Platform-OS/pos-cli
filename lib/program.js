import { program } from 'commander';
import chalk from 'chalk';

program.configureOutput({
  outputError: (str, write) => {
    let message = str.trimEnd();

    if (str.includes('too many arguments')) {
      const passedArgs = process.argv.slice(2).filter(a => !a.startsWith('-'));
      if (passedArgs.length) {
        message += `\nReceived: ${passedArgs.join(', ')}`;
      }
    }

    const name = program.name();
    message += `\nRun \`${name} --help\` for usage information.`;

    write(chalk.red(message) + '\n');
  },
});

export { program };
