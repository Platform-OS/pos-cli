import logger from './logger.js';
import report from './logger/report.js';

// Walk the error cause chain to find a network error code.
// Node.js 22+ fetch (undici) wraps errors up to 3 levels deep:
//   RequestError (pos-cli) → TypeError 'fetch failed' (undici) → NodeAggregateError|Error (net.js)
// NodeAggregateError (Happy Eyeballs, used when localhost resolves to multiple addresses)
// always copies .code from errors[0].code, so checking .code at each level is sufficient.
const getNetworkErrorCode = (err, depth = 0) => {
  if (!err || depth > 5) return null;
  if (err.code) return err.code;
  return getNetworkErrorCode(err.cause, depth + 1);
};

const shouldExit = request => {
  const endsWith = str => request.options.uri.endsWith(str);

  return !(endsWith('releases/sync') || endsWith('/api/graph'));
};

const ServerError = {
  isNetworkError(e) {
    return (e.name === 'StatusCodeError') || (e.name === 'RequestError');
  },
  async handler(e) {
    if (e.name === 'StatusCodeError')
      await ServerError.responseHandler(e);
    else if (e.name === 'RequestError')
      await ServerError.requestHandler(e);
  },
  requestHandler: async (reason) => {
    const causeCode = getNetworkErrorCode(reason);
    const systemError = reason.cause?.cause;
    const causeMessage = systemError?.message || reason.cause?.message || reason.message;

    switch (causeCode) {
      case 'ENOTFOUND':
        await ServerError.addressNotFound(reason);
        break;

      case 'ECONNREFUSED':
      case 'ECONNRESET':
        await ServerError.connectionRefused(reason);
        break;

      case 'ETIMEDOUT':
      case 'ECONNABORTED':
        await ServerError.connectionTimedOut(reason);
        break;

      case 'ENETDOWN':
        await ServerError.netDown(reason);
        break;

      default:
        // Handle native fetch errors which don't have error codes
        if (causeMessage && (causeMessage.includes('getaddrinfo ENOTFOUND') || causeMessage.includes('ENOTFOUND'))) {
          await ServerError.addressNotFound(reason);
        } else if (causeMessage && causeMessage.includes('ECONNREFUSED')) {
          await ServerError.connectionRefused(reason);
        } else {
          await logger.Error('Request to the server failed.', { exit: false });
        }
    }
  },
  responseHandler: async (request) => {
    switch (request.statusCode) {
      case 504:
        await ServerError.gatewayTimeout(request);
        break;
      case 502:
        await ServerError.badGateway(request);
        break;
      case 500:
        await ServerError.internal(request);
        break;
      case 413:
        await ServerError.entityTooLarge(request);
        break;
      case 422:
        await ServerError.unprocessableEntity(request);
        break;
      case 404:
        await ServerError.notFound(request);
        break;
      case 401:
        await ServerError.unauthorized(request);
        break;
      default:
        await ServerError.default(request);
    }
  },

  gatewayTimeout: async request => {
    logger.Debug(`Gateway timeout error: ${JSON.stringify(request, null, 2)}`);
    await logger.Error('Gateway timed out. \nWe have been notified about it.', {
      hideTimestamp: true,
      exit: shouldExit(request)
    });

    report('[504] Gateway timeout');
  },

  badGateway: async request => {
    logger.Debug(`Bad gateway error: ${JSON.stringify(request, null, 2)}`);
    await logger.Error('Bad gateway. \nWe have been notified about it.', {
      hideTimestamp: true,
      exit: shouldExit(request)
    });

    report('[502] Bad Gateway');
  },

  internal: async request => {
    logger.Debug(`Internal server error: ${JSON.stringify(request, null, 2)}`);
    await logger.Error('Something went wrong on the server. \nWe have been notified about it.', {
      hideTimestamp: true,
      exit: shouldExit(request)
    });

    report('[500] Internal error');
  },

  entityTooLarge: async request => {
    logger.Debug(`Entity too large: ${JSON.stringify(request.response, null, 2)}`);
    await logger.Error('Archive you are trying to send is too large. Limit is 50MB.', { hideTimestamp: true });
  },

  unprocessableEntity: async request => {
    logger.Debug(`Unprocessable entity: ${JSON.stringify(request, null, 2)}`);
    const body = request.response.body;
    const error = body.error || (body.errors && body.errors.join(', '));
    if (error) {
      const message = `${error}\n${(body.details && body.details.file_path) || ''}`;
      await logger.Error(message, {
        hideTimestamp: true,
        exit: shouldExit(request)
      });
    }
  },

  notFound: async request => {
    logger.Debug(`Not found: ${JSON.stringify(request, null, 2)}`);
    await logger.Error(`NotFound: ${request.options.uri}`);
  },

  unauthorized: async request => {
    logger.Debug(`Unauthorized: ${JSON.stringify(request, null, 2)}`);
    await logger.Error('You are unauthorized to do this operation. Check if your Token/URL or email/password are correct.', {
      hideTimestamp: true,
      exit: shouldExit(request)
    });
  },

  addressNotFound: async request => {
    logger.Debug(`Host name not found: ${JSON.stringify(request, null, 2)}`);
    // Try to extract hostname from various error structures
    // Native fetch errors have: error.cause.cause.hostname
    const systemError = request.cause?.cause;
    const hostname = systemError?.hostname ||
                     request.cause?.hostname ||
                     request.options?.uri?.match(/https?:\/\/([^/]+)/)?.[1] ||
                     'unknown host';
    await logger.Error(`Could not resolve hostname: ${hostname}`, { hideTimestamp: true });
  },

  connectionRefused: async (reason) => {
    logger.Debug(`Connection refused: ${JSON.stringify(reason, null, 2)}`);
    const url = reason.options?.uri || reason.cause?.hostname || '';
    const urlPart = url ? ` to ${url}` : '';
    await logger.Error(`Could not connect${urlPart}. Make sure the server is running.`, { hideTimestamp: true });
  },

  connectionTimedOut: async (reason) => {
    logger.Debug(`Connection timed out: ${JSON.stringify(reason, null, 2)}`);
    const url = reason.options?.uri || '';
    const urlPart = url ? ` to ${url}` : '';
    await logger.Error(`Connection${urlPart} timed out. The server may be overloaded or unreachable.`, { hideTimestamp: true });
  },

  netDown: async (request) => {
    logger.Debug(`Net down: ${JSON.stringify(request, null, 2)}`);
    await logger.Error('Network is down', { hideTimestamp: true, exit: shouldExit(request) });
  },

  default: async (request) => {
    logger.Debug(`Default error: ${JSON.stringify(request.response, null, 2)}`);
    const err = JSON.stringify(request.response, null, 2).replace(/Token [a-f0-9]{40}/, 'Token: <censored>');
    await logger.Error(err, { hideTimestamp: true });
  }
};

export default ServerError;
