const notifier = require('node-notifier');
const logger = require('./logger');

const shouldExit = error => {
  const endsWith = str => error.options.uri.endsWith(str);

  if (endsWith('marketplace_releases/sync') || endsWith('/api/graph')) {
    return false;
  }

  return true;
};

const ServerError = {
  getDetails: errorDetails => {
    const details = Object.assign({}, errorDetails);
    try {
      // most of our errors are with a lot of details from mpbuilder
      // but some errors are very minimal
      // TODO: Think about refactoring, maybe whitelist what should be in the error
      delete details.model_class;
      delete details.messages;
      delete details.model_id;
      delete details.model_hash.body;
      delete details.model_hash.content;
      delete details.model_hash.format;
      delete details.model_hash.partial;
    } catch (e) {
      logger.Debug(e.message);
    }
    return details;
  },

  unauthorized: error => {
    logger.Debug(`Unauthorized error: ${JSON.stringify(error, null, 2)}`);

    logger.Error(`[${error.statusCode}] ${error.error}`, { hideTimestamp: true });
  },

  internal: error => {
    logger.Debug(`Internal error: ${JSON.stringify(error, null, 2)}`);
    const message = error.error.error.slice(0, 100);
    let details = error.error.details;

    // unfortunately we have a lot of different error formats to think about.

    if (typeof details !== 'string') {
      details = JSON.stringify(ServerError.getDetails(details), null, 2);
    }

    notifier.notify({ title: 'pos-cli Error', message });
    logger.Error(`[${error.statusCode}] ${message} \n ${details}`, { hideTimestamp: true, exit: shouldExit(error) });
  },

  deploy: error => {
    logger.Debug(`Deploy error: ${JSON.stringify(error, null, 2)}`);

    const message = error.message.slice(0, 100);
    let details = error.details;

    if (typeof error.details !== 'string') {
      details = JSON.stringify(ServerError.getDetails(error.details), null, 2);
    }

    notifier.notify({ title: 'pos-cli Error', message });
    logger.Error(`[Deploy] ${message} \n ${details}`, { hideTimestamp: true, exit: false });
  }
};

module.exports = ServerError;
