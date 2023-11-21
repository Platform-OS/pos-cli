const requestPromise = require('request-promise');
const logger = require('./logger');
// const errors = require('request-promise/errors');

const apiRequest = ({ method = 'GET', uri, body, headers, formData, json = true, forever, request = requestPromise }) => {
  logger.Debug(`[${method}] ${uri}`);

  return request({method, uri, body, headers, formData, json, forever})
  //  when we catch the error here we are not able to react to them later
  // .catch(errors.StatusCodeError, ServerError.handler)
  // .catch(errors.RequestError, ServerError.requestHandler)
}

const apiRequestRaw = ({ method = 'GET', uri, body, headers, formData, json = true, forever, request = requestPromise }) => {
  logger.Debug(`[${method}] ${uri}`);
  return request({
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
        default:
          return request;
      }
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

module.exports = {
  apiRequest: apiRequest,
  apiRequestRaw: apiRequestRaw
}
