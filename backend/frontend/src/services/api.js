const baseUrl = '/api';

const getToken = () => localStorage.getItem('token');

const buildHeaders = (extraHeaders = {}) => {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  };
};

const request = async (path, method = 'GET', body = null, options = {}) => {
  const headers = buildHeaders(options.headers || {});
  const config = {
    method,
    headers,
  };

  if (body !== null) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${baseUrl}${path}`, config);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = data?.message || data?.error || response.statusText;
    throw new Error(error || 'Request failed');
  }

  return data;
};

const api = {
  get: (path, options) => request(path, 'GET', null, options),
  post: (path, body, options) => request(path, 'POST', body, options),
  put: (path, body, options) => request(path, 'PUT', body, options),
  delete: (path, options) => request(path, 'DELETE', null, options),
};

export default api;
