const logger = require('./logger');

const shouldExit = request => {
  const endsWith = str => request.options.uri.endsWith(str);

  if (endsWith('releases/sync') || endsWith('/api/graph')) {
    return false;
  }
};

const ServerError = {
  internal: request => {
    logger.Debug(`Internal server error: ${JSON.stringify(request, null, 2)}`);
    logger.Error('Something went wrong on the server. \nWe have been notified about it.', {
      hideTimestamp: true,
      exit: shouldExit(request)
    });
  },

  entityTooLarge: request => {
    logger.Debug(`Entity too large: ${JSON.stringify(request.response, null, 2)}`);
    logger.Error('Archive you are trying to send is too large. Limit is 50MB.', { hideTimestamp: true });
  },

  unprocessableEntity: request => {
    logger.Debug(`Unprocessable entity: ${JSON.stringify(request, null, 2)}`);
    const body = request.response.body;
    logger.Error(`${body.error}\n${(body.details && body.details.file_path) || ''}`, {
      hideTimestamp: true,
      exit: shouldExit(request)
    });
  },

  notFound: request => {
    logger.Debug(`Not found: ${JSON.stringify(request, null, 2)}`);
    const body = request.response.body;
    logger.Error(`${body.error}\n${(body.details && body.details.file_path) || ''}`, {
      hideTimestamp: true,
      exit: shouldExit(request)
    });
  },

  unauthorized: request => {
    logger.Debug(`Unauthorized: ${JSON.stringify(request, null, 2)}`);
    logger.Error('You are unauthorized to do this operation. Check if your Token and URL is correct.', {
      hideTimestamp: true
    });
  },

  addressNotFound: request => {
    logger.Debug(`Host name not found: ${JSON.stringify(request, null, 2)}`);
    logger.Error(`Could not resolve hostname: ${request.cause.hostname}`, { hideTimestamp: true });
  },

  netDown: (request) => {
    logger.Debug(`Net down: ${JSON.stringify(request, null, 2)}`);
    logger.Error('Network is down', { hideTimestamp: true, exit: shouldExit(request) });
  },

  default: (request) => {
    logger.Debug(`Default error: ${JSON.stringify(request.response, null, 2)}`);
    const err = JSON.stringify(request.response, null, 2).replace(/Token [a-f0-9]{40}/, 'Token: <censored>');
    logger.Error(err, { hideTimestamp: true });
  },
};

module.exports = ServerError;
