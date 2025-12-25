/**
 * API Client Configuration
 *
 * Base configuration for all API calls matching the Postman collection.
 * All endpoints use the exact paths and methods from the provided API docs.
 * Includes retry logic for rate limiting (429 errors).
 */

import axios, { AxiosError, AxiosInstance } from 'axios';

// Base URL from Postman collection (default: http://localhost:3000)
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

/**
 * Retry request with exponential backoff for 429 errors
 */
const retryRequest = async (
  client: AxiosInstance,
  config: any,
  retries: number = 3,
  delay: number = 1000
): Promise<any> => {
  try {
    return await client.request(config);
  } catch (error: any) {
    const axiosError = error as AxiosError;

    // Only retry on 429 (Too Many Requests)
    if (axiosError.response?.status === 429 && retries > 0) {
      const retryAfter = axiosError.response.headers['retry-after'];
      const waitTime = retryAfter
        ? parseInt(retryAfter) * 1000
        : delay;

      console.warn(`Rate limited (429). Retrying in ${waitTime}ms... (${retries} retries left)`);

      await new Promise(resolve => setTimeout(resolve, waitTime));
      return retryRequest(client, config, retries - 1, delay * 2);
    }

    throw error;
  }
};

/**
 * Creates an axios instance with authentication token
 * Each session maintains its own token, ensuring complete isolation
 * Includes retry logic for rate limiting
 */
export const createApiClient = (token?: string) => {
  const client = axios.create({
    baseURL: BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Add auth token to all requests if provided
  if (token) {
    client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  // Add request interceptor to handle retries
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as any;

      // Handle 429 errors with retry
      if (error.response?.status === 429 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          return await retryRequest(client, originalRequest);
        } catch (retryError) {
          // If retry fails, throw with user-friendly message
          const axiosRetryError = retryError as AxiosError;
          if (axiosRetryError.response?.status === 429) {
            throw new Error('Too many requests. Please wait a moment and try again.');
          }
          throw retryError;
        }
      }

      return Promise.reject(error);
    }
  );

  return client;
};

export default createApiClient;
