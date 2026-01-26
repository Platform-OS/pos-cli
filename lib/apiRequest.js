import fs from 'fs';
import path from 'path';
import logger from './logger.js';

const buildFormData = (formData) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(formData)) {
    if (value && typeof value === 'object' && value.path) {
      const fileBuffer = fs.readFileSync(value.path);
      const filename = path.basename(value.path);
      form.append(key, new Blob([fileBuffer]), filename);
    } else if (Buffer.isBuffer(value)) {
      form.append(key, new Blob([value]));
    } else if (value !== undefined && value !== null) {
      form.append(key, String(value));
    }
  }
  return form;
};

const apiRequest = async ({ method = 'GET', uri, body, headers = {}, formData, json = true, forever }) => {
  logger.Debug(`[${method}] ${uri}`);

  const fetchOptions = {
    method,
    headers: { ...headers }
  };

  if (formData) {
    const form = buildFormData(formData);
    fetchOptions.body = form;
  } else if (body) {
    fetchOptions.headers['Content-Type'] = 'application/json';
    fetchOptions.body = JSON.stringify(body);
  } else if (json && typeof json === 'object' && !['GET', 'HEAD'].includes(method.toUpperCase())) {
    fetchOptions.headers['Content-Type'] = 'application/json';
    fetchOptions.body = JSON.stringify(json);
  }

  if (forever) {
    fetchOptions.keepalive = true;
  }

  let response;
  try {
    response = await fetch(uri, fetchOptions);
  } catch (e) {
    const error = new Error(e.message);
    error.name = 'RequestError';
    error.cause = e;
    error.options = { uri };
    throw error;
  }

  if (!response.ok) {
    const errorBody = await response.text();
    const error = new Error(`Request failed with status ${response.status}`);
    error.name = 'StatusCodeError';
    error.statusCode = response.status;
    error.options = { uri };
    error.response = {
      statusCode: response.status,
      body: errorBody,
      headers: Object.fromEntries(response.headers.entries())
    };
    try {
      error.response.body = JSON.parse(errorBody);
    } catch {
      // JSON parse failed, keep original body
    }
    throw error;
  }

  if (json) {
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  return response.text();
};

export { apiRequest };
