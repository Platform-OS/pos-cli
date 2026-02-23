import defaultStrategy from './defaultStrategy.js';
import directAssetsUploadStrategy from './directAssetsUploadStrategy.js';
import dryRunStrategy from './dryRunStrategy.js';

const strategies = {
  default: defaultStrategy,
  directAssetsUpload: directAssetsUploadStrategy,
  dryRun: dryRunStrategy
};

const run = ({ strategy, opts }) => strategies[strategy](opts);

export default { run };
