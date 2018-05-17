const messages = {
  LOCKED_BY_ADMIN: `LOCKED_BY_ADMIN ERROR: Someone has edited files using instance-admin. You may want to override these changes by deploying with --force option.\n> marketplace-kit deploy ${process.env.MARKETPLACE_ENV} --force`,
  SCHEMA_CHANGED: 'WARNING: If data schema was updated it will take a while for the change to be applied.'
};

const describe = (label, log) => {
  if (label.match(/locked_by_admin/))
    log(messages.LOCKED_BY_ADMIN);

  if (label.match(/custom_model_types|transactable_types/))
    log(messages.SCHEMA_CHANGED);
};

const toErrorCode =

module.exports = {
  describe
};
