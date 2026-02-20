const waitForOutput = (child, pattern, timeout = 15000) => {
  return new Promise((resolve, reject) => {
    let buffer = '';

    const onData = (chunk) => {
      buffer += chunk.toString();
      if (pattern.test(buffer)) {
        clearTimeout(timer);
        child.stdout.off('data', onData);
        resolve();
      }
    };

    const timer = setTimeout(() => {
      child.stdout.off('data', onData);
      reject(new Error(`Timeout (${timeout}ms) waiting for output: ${pattern}`));
    }, timeout);

    child.stdout.on('data', onData);
  });
};

export default waitForOutput;
