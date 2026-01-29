import { apiRequest } from '../apiRequest.js';

class HTTP {
  static async get(url, {params, securities}) {
    return await apiRequest({
      uri: url + '?' + new URLSearchParams(params),
      method: 'GET',
      json: true,
      headers: {
        Authorization: `Bearer ${securities.authorized.Authorization}`
      }
    });
  }

  static async post(url, {securities, body}) {
    return await apiRequest({
      uri: url,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${securities.authorized.Authorization}`,
        'Content-Type': 'application/json'
      },
      body: body
    });
  }

  static async put(url, {securities, body}) {
    return apiRequest({
      uri: url,
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${securities.authorized.Authorization}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  }
}

export default HTTP;
