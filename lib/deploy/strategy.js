const strategies = {
  default: require('./defaultStrategy'),
  directAssetsUpload: require('./directAssetsUploadStrategy')
};

module.exports = {
  run: ({ strategy, opts }) => strategies[strategy](opts)
};
