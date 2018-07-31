const version = require('../package.json').version;

module.exports = opts => ({
  Authorization: `Token token=${opts.token}`,
  From: opts.email,
  'User-Agent': `marketplace-kit/${version}`
});
