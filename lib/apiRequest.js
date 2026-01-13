const axios = require('axios');
const FormData = require('form-data');
const logger = require('./logger');

const apiRequest = async ({ method = 'GET', uri, body, headers, formData, json = true, forever, request }) => {
  logger.Debug(`[${method}] ${uri}`);

  try {
    // If a custom axios instance is provided, use it
    const client = request || axios;

    let config = {
      method,
      url: uri,
      headers: headers || {},
    };

    if (formData) {
      // Convert formData object to FormData instance
      const form = new FormData();
      Object.keys(formData).forEach(key => {
        form.append(key, formData[key]);
      });
      config.data = form;
      config.headers = { ...config.headers, ...form.getHeaders() };
    } else if (body) {
      config.data = body;
    } else if (json && typeof json === 'object') {
      // In request-promise, json can be an object to send as request body
      config.data = json;
      config.headers['Content-Type'] = 'application/json';
    }

    // Handle forever option (keep-alive connections)
    if (forever) {
      config.timeout = 0;
    }

    const response = await client(config);

    // Return data directly if json is truthy, otherwise return full response
    return json ? response.data : response;
  } catch (error) {
    // Re-throw with consistent error structure similar to request-promise
    if (error.response) {
      // Server responded with error status (StatusCodeError)
      const err = new Error(error.response.data || error.message);
      err.name = 'StatusCodeError';
      err.statusCode = error.response.status;
      err.response = {
        body: error.response.data,
        statusCode: error.response.status
      };
      err.options = {
        uri: error.config?.url || uri
      };
      err.error = error.response.data;
      throw err;
    } else if (error.request) {
      // Request was made but no response received (RequestError)
      const err = new Error(error.message);
      err.name = 'RequestError';
      err.cause = error;
      err.options = {
        uri: error.config?.url || uri
      };
      throw err;
    } else {
      // Network or other error
      throw error;
    }
  }
}

module.exports = {
  apiRequest: apiRequest
}
