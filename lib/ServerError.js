const logger = require('./logger');

const shouldExit = error => {
  const endsWith = str => error.options.uri.endsWith(str);

  if (endsWith('releases/sync') || endsWith('/api/graph')) {
    return false;
  }

  return true;
};

const _getDetails = errorDetails => {
  const details = Object.assign({}, errorDetails);
  try {
    logger.Debug('Cleaning error message');
    logger.Debug(errorDetails);
    // most of our errors are with a lot of details from mpbuilder
    // but some errors are very minimal
    // TODO: Think about refactoring, maybe whitelist what should be in the error
    delete details.model_class;
    delete details.model_id;
    delete details.model_hash;
  } catch (e) {
    logger.Debug(e.message);
  }

  return details;
};


const ServerError = {
  unauthorized: error => {
    logger.Debug(`Unauthorized error: ${JSON.stringify(error, null, 2)}`);
    logger.Error(`[${error.statusCode}] You are unauthorized to do this operation. \n\n ${error.message}`, { hideTimestamp: true });
  },

  internal: response => {
    logger.Debug(`Internal error: ${JSON.stringify(response, null, 2)}`);

    let message = JSON.stringify(response.error, null, 2);

    try {
      message = response.error.error;
    } catch (e) {
      logger.Debug(e.message);
    }
    let details = response.error && response.error.details || {};

    if (typeof details !== 'string') {
      details = JSON.stringify(_getDetails(details), null, 2);
    }

    logger.Error(`${message} \n ${details}`, { hideTimestamp: true, exit: shouldExit(response) });
  },

  forbidden: response => {
    logger.Error(response.message, { hideTimestamp: true, exit: shouldExit(response) });
  },

  default: response => {
    logger.Error(response.message, { hideTimestamp: true, exit: shouldExit(response) });
  },

  entityTooLarge: response => {
    logger.Error('Archive you are trying to send is too large. Limit is 50MB.', { hideTimestamp: true, exit: shouldExit(response) });
  },

  deploy: error => {
    logger.Debug(`Deploy error: ${JSON.stringify(error, null, 2)}`);
    const e = JSON.parse(error.error);

    const message = e.message || (e.messages && e.messages.body && e.messages.body.join('\n')) || 'Server error.';
    let details = e.error && e.error.details || {};

    if (typeof details !== 'string' && Object.keys(details).length) {
      details = JSON.stringify(_getDetails(details), null, 2);
    }

    logger.Error(`${message}\n\n${details ? details : ''}`, { hideTimestamp: true, notify: false });
  }
};

module.exports = ServerError;
