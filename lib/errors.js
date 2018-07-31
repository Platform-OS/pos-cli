const messages = {
  LOCKED_BY_ADMIN: `LOCKED_BY_ADMIN ERROR: Someone has edited files using instance-admin. You may want to override these changes by deploying with --force option.\n> marketplace-kit deploy ${process.env.MARKETPLACE_ENV} --force`
};

const describe = (label, log) => {
  if (label.match(/locked_by_admin/))
    log(messages.LOCKED_BY_ADMIN);
};

const toErrorCode =

module.exports = {
  describe
};
