// src/api/client.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── CONFIG ────────────────────────────────────────────────────
export const BASE_URL = 'https://brachycerous-uncollegiate-tisha.ngrok-free.dev';


const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

// ─── REQUEST INTERCEPTOR ───────────────────────────────────────
// Attach auth tokens from storage on every request
client.interceptors.request.use(
  async (config) => {
    try {
      const accessToken = await AsyncStorage.getItem('access-token');
      const clientToken = await AsyncStorage.getItem('client');
      const uid         = await AsyncStorage.getItem('uid');
      const authToken   = await AsyncStorage.getItem('auth_token');

      if (accessToken) config.headers['access-token']  = accessToken;
      if (clientToken) config.headers['client']         = clientToken;
      if (uid)         config.headers['uid']            = uid;
      if (authToken)   config.headers['Authorization']  = `Bearer ${authToken}`;
    } catch (e) {
      console.warn('Token retrieval error:', e);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── RESPONSE INTERCEPTOR ──────────────────────────────────────
// Save updated tokens from response headers (devise_token_auth refreshes them)
client.interceptors.response.use(
  async (response) => {
    try {
      const accessToken = response.headers['access-token'];
      const clientToken = response.headers['client'];
      const uid         = response.headers['uid'];

      if (accessToken) await AsyncStorage.setItem('access-token', accessToken);
      if (clientToken) await AsyncStorage.setItem('client', clientToken);
      if (uid)         await AsyncStorage.setItem('uid', uid);
    } catch (e) {
      console.warn('Token save error:', e);
    }
    return response;
  },
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.multiRemove(['access-token', 'client', 'uid', 'auth_token', 'user']);
    }
    return Promise.reject(error);
  }
);

// ─── HELPERS ───────────────────────────────────────────────────
export const saveAuthTokens = async (headers, user) => {
  const items = [];
  if (headers['access-token']) items.push(['access-token', headers['access-token']]);
  if (headers['client'])       items.push(['client',       headers['client']]);
  if (headers['uid'])          items.push(['uid',          headers['uid']]);
  if (user)                    items.push(['user',         JSON.stringify(user)]);
  if (items.length) await AsyncStorage.multiSet(items);
};

export const clearAuthTokens = async () => {
  await AsyncStorage.multiRemove(['access-token', 'client', 'uid', 'auth_token', 'user']);
};

export const getStoredUser = async () => {
  const json = await AsyncStorage.getItem('user');
  return json ? JSON.parse(json) : null;
};

export default client;