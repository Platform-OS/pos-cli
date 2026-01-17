import { exec } from 'child_process';

const execCommand = (cmd, opts, callback) =>
  new Promise((resolve, reject) => {
    const child = exec(cmd, opts, (err, stdout, stderr) => {
      let code = err ? err.code : 0;
      return resolve({ stdout, stderr, code, child });
    });
    if (callback) callback(child);
    return child;
  });

export default execCommand;
