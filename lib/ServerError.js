const logger = require('./logger'),
  report = require('./logger/report');

const shouldExit = request => {
  const endsWith = str => request.options.uri.endsWith(str);

  return !(endsWith('releases/sync') || endsWith('/api/graph'))
};

const ServerError = {
  isNetworkError(e) {
    return (e.name === 'StatusCodeError') || (e.name === 'RequestError')
  },
  handler(e) {
    if (e.name === 'StatusCodeError')
      ServerError.responseHandler(e)
    else if (e.name === 'RequestError')
      ServerError.requestHandler(e)
  },
  requestHandler: (reason) => {
    switch (reason.cause.code) {
    case 'ENOTFOUND':
      ServerError.addressNotFound(reason);
      break;

    case 'ENETDOWN':
      ServerError.netDown(reason);
      logger.Error(`${reason.cause}`, { exit: true });
      break;

    default:
      logger.Error('Request to the server failed.', { exit: false });
      logger.Error(`${reason.cause}`, { exit: false });
    }
  },
  responseHandler: (request) => {
    switch (request.statusCode) {
    case 504:
      ServerError.gatewayTimeout(request);
      break;
    case 502:
      ServerError.badGateway(request);
      break;
    case 500:
      ServerError.internal(request);
      break;
    case 413:
      ServerError.entityTooLarge(request);
      break;
    case 422:
      ServerError.unprocessableEntity(request);
      break;
    case 404:
      ServerError.notFound(request);
      break;
    case 401:
      ServerError.unauthorized(request);
      break;
    default:
      ServerError.default(request);
    }
  },

  gatewayTimeout: request => {
    logger.Debug(`Gateway timeout error: ${JSON.stringify(request, null, 2)}`);
    logger.Error('Gateway timed out. \nWe have been notified about it.', {
      hideTimestamp: true,
      exit: shouldExit(request)
    });

    report('[504] Gateway timeout');
  },

  badGateway: request => {
    logger.Debug(`Bad gateway error: ${JSON.stringify(request, null, 2)}`);
    logger.Error('Bad gateway. \nWe have been notified about it.', {
      hideTimestamp: true,
      exit: shouldExit(request)
    });

    report('[502] Bad Gateway');
  },

  internal: request => {
    logger.Debug(`Internal server error: ${JSON.stringify(request, null, 2)}`);
    logger.Error('Something went wrong on the server. \nWe have been notified about it.', {
      hideTimestamp: true,
      exit: shouldExit(request)
    });

    report('[500] Internal error');
  },

  entityTooLarge: request => {
    logger.Debug(`Entity too large: ${JSON.stringify(request.response, null, 2)}`);
    logger.Error('Archive you are trying to send is too large. Limit is 50MB.', { hideTimestamp: true });
  },

  unprocessableEntity: request => {
    logger.Debug(`Unprocessable entity: ${JSON.stringify(request, null, 2)}`);
    const body = request.response.body;
    const error = body.error || (body.errors && body.errors.join(', '));
    if (error) {
      const message = `${error}\n${(body.details && body.details.file_path) || ''}`;
      logger.Error(message, {
        hideTimestamp: true,
        exit: shouldExit(request)
      });
    }
  },

  notFound: request => {
    logger.Debug(`Not found: ${JSON.stringify(request, null, 2)}`);
    logger.Error(`NotFound: ${request.options.uri}`);
  },

  unauthorized: request => {
    logger.Debug(`Unauthorized: ${JSON.stringify(request, null, 2)}`);
    logger.Error('You are unauthorized to do this operation. Check if your Token/URL or email/password are correct.', {
      hideTimestamp: true,
      exit: shouldExit(request)
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
