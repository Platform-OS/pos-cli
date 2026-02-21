import { exec } from 'child_process';

const execCommand = (cmd, opts, callback) => {
  let stepError = null;

  return new Promise((resolve, reject) => {
    const child = exec(cmd, opts, (err, stdout, stderr) => {
      if (stepError) return reject(stepError);
      resolve({ stdout, stderr, code: err ? err.code : 0, child });
    });

    if (callback) {
      Promise.resolve(callback(child)).catch(err => {
        stepError = err;
        child.stdout?.destroy();
        child.stderr?.destroy();
        child.kill();
      });
    }
  });
};

export default execCommand;
