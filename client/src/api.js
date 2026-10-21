import axios from 'axios';

export const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((request) => {
  const token = localStorage.getItem('token');
  if (token) request.headers.Authorization = `Bearer ${token}`;
  return request;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config.url.includes('/auth/login')) {
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') window.location.assign('/login');
    }
    return Promise.reject(error);
  },
);

export function errorMessage(error) {
  return error.response?.data?.message || error.message || 'Something went wrong';
}

// Downloads a protected file (the auth header cannot be sent by a plain <a href>).
export async function downloadFile(url, fallbackName, params) {
  const { data } = await api.get(url, { params, responseType: 'blob' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(data);
  link.download = fallbackName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
