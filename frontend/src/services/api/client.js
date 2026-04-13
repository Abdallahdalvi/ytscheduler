import axios from 'axios'
import { toApiError } from './response'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

export const nodeApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
})

nodeApi.interceptors.request.use((config) => {
  const storageKey = 'ytscheduler-supabase-auth';
  const sessionData = localStorage.getItem(storageKey);
  if (sessionData) {
    try {
      const { access_token } = JSON.parse(sessionData);
      if (access_token) {
        config.headers.Authorization = `Bearer ${access_token}`;
      }
    } catch (e) {
      console.error('[API/Node] Error parsing Supabase session:', e);
    }
  }
  return config;
});

function attachErrorInterceptor(client) {
  client.interceptors.response.use(
    (response) => response,
    (error) => Promise.reject(toApiError(error)),
  )
}

attachErrorInterceptor(nodeApi)
