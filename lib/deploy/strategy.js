import defaultStrategy from './defaultStrategy.js';
import directAssetsUploadStrategy from './directAssetsUploadStrategy.js';

const strategies = {
  default: defaultStrategy,
  directAssetsUpload: directAssetsUploadStrategy,
};

const run = ({ strategy, opts }) => strategies[strategy](opts);

export default { run };
