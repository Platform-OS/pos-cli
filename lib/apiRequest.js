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

module.exports = apiRequest;
