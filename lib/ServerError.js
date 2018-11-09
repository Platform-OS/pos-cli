const notifier = require('node-notifier'),
  logger = require('./logger');

const shouldExit = error => !error.options.uri.endsWith('marketplace_releases/sync') || false;

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
    } catch (e) {}
    return details;
  },

  unauthorized: error => {
    logger.Debug(`Unauthorized error: ${error}`);

    logger.Error(`[${error.statusCode}] ${error.error}`, { hideTimestamp: true });
  },

  internal: error => {
    logger.Debug(`Internal error: ${error}`);
    const message = error.error.error;
    let errorDetails = error.error.details;

    // unfortunately we have a lot of different error formats to think about.

    if (errorDetails) {
      errorDetails = JSON.stringify(ServerError.getDetails(errorDetails), null, 2);
    }

    notifier.notify({ title: 'MarkeplaceKit Error', message: message });
    logger.Error(`[${error.statusCode}] ${message} \n ${details}`, { hideTimestamp: true, exit: shouldExit(error) });
  },

  deploy: error => {
    logger.Debug(`Deloy error: ${error}`);

    const message = error.message;
    let details = JSON.stringify(ServerError.getDetails(error.details), null, 2);

    notifier.notify({ title: 'MarkeplaceKit Error', message: message });
    logger.Error(`[Deploy] ${message} \n ${details}`, { hideTimestamp: true, exit: false });
  }
};

module.exports = ServerError;
