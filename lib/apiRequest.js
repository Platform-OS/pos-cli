const requestPromise = require('request-promise');
const errors = require('request-promise/errors');

const logger = require('./logger');
const ServerError = require('./ServerError');

const apiRequest = ({ method = 'GET', uri, body, headers, formData, json = true, forever, request = requestPromise }) => {
  logger.Debug(`[${method}] ${uri}`);
  return requestPromise({
    method,
    uri,
    body,
    headers,
    formData,
    json,
    forever
  })
    .catch(errors.StatusCodeError, request => {
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
      throw request;
    })
    .catch(errors.RequestError, (reason) => {
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
    });
}

module.exports = apiRequest;
