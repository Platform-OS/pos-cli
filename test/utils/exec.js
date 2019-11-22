const { exec } = require('child_process');

module.exports = (cmd, opts) =>
  new Promise((resolve, reject) => {
    // const dirOutput = opts && opts.cwd ? `\nDIR: ${opts.cwd}` : '';
    // console.log(`Running command...\nCMD: ${cmd}${dirOutput}`);
    exec(cmd, opts, (err, stdout, stderr) => {
      let code = err ? err.code : 0;
      return resolve({ stdout, stderr, code });
    });
  });
