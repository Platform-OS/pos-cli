const waitForOutput = (child, pattern, { timeout = 15000, stream = 'stdout' } = {}) => {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const source = child[stream];

    const onData = (chunk) => {
      buffer += chunk.toString();
      if (pattern.test(buffer)) {
        clearTimeout(timer);
        source.off('data', onData);
        resolve();
      }
    };

    const timer = setTimeout(() => {
      source.off('data', onData);
      reject(new Error(`Timeout (${timeout}ms) waiting for ${stream} output: ${pattern}`));
    }, timeout);

    source.on('data', onData);
  });
};

export default waitForOutput;
