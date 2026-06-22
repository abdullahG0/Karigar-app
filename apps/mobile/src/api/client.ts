import axios from 'axios';
import { API_BASE_URL } from '../config';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000, // 20s — covers Railway free-tier cold start
});

type RetryConfig = { _retries?: number };

// Unwrap { success, data } envelope; retry once on network errors (Railway cold start).
api.interceptors.response.use(
  (response) => {
    if (response.data?.success === true && 'data' in response.data) {
      response.data = response.data.data;
    }
    return response;
  },
  async (error) => {
    const config = error.config as (typeof error.config & RetryConfig) | undefined;

    // Retry exactly once on network errors (no HTTP response = server was asleep).
    // Wait 5s so the Railway container finishes booting before the second attempt.
    if (!error.response && config && !config._retries) {
      config._retries = 1;
      await new Promise<void>((r) => setTimeout(r, 5000));
      return api(config);
    }

    const message =
      error.response?.data?.error ?? error.message ?? 'Something went wrong';
    return Promise.reject(new Error(message));
  }
);

export default api;
