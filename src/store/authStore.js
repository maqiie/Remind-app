// src/store/authStore.js
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  login,
  logout,
  validateToken,
  sendOtp,
  verifyOtp,
  resendOtp,
  register,
} from '../api/auth';
import { clearAuthTokens } from '../api/client';

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  otpPending: false,
  otpEmail: null,

  setLoading: (val) => set({ isLoading: val }),

  // ── INITIALIZE ────────────────────────────────────────────────
  initialize: async () => {
  set({ isLoading: true });
  try {
    const accessToken = await AsyncStorage.getItem('access-token');
    const userJson    = await AsyncStorage.getItem('user');

    if (accessToken && userJson) {
      try {
        const response = await validateToken();
        if (response.success) {
          set({ user: response.data, isAuthenticated: true });
        } else {
          await clearAuthTokens();
          set({ user: null, isAuthenticated: false, otpPending: false, otpEmail: null }); // ← add these
        }
      } catch {
        await clearAuthTokens();
        set({ user: null, isAuthenticated: false, otpPending: false, otpEmail: null }); // ← and here
      }
    }
  } catch (e) {
    console.error('Auth init error:', e);
  } finally {
    set({ isLoading: false });
  }
},

  // ── REGISTER ──────────────────────────────────────────────────
  register: async (data) => {
    await register(data);
    await sendOtp({ email: data.email.trim().toLowerCase() });
    set({
      otpPending: true,
      otpEmail: data.email.trim().toLowerCase(),
    });
  },

  // ── LOGIN ─────────────────────────────────────────────────────
  requestLogin: async ({ email, password }) => {
    const response = await login({ email, password });
    if (response.status === 'otp_required') {
      set({
        otpPending: true,
        otpEmail: email.trim().toLowerCase(),
      });
    }
    return response;
  },

  // ── VERIFY OTP ────────────────────────────────────────────────
  verifyOtp: async ({ email, otp }) => {
    const response = await verifyOtp({ email, otp });
    const user = response.data;
    await AsyncStorage.setItem('user', JSON.stringify(user));
    set({
      user,
      isAuthenticated: true,
      otpPending: false,
      otpEmail: null,
    });
    return response;
  },

  // ── RESEND OTP ────────────────────────────────────────────────
  resendOtp: async () => {
    const { otpEmail } = get();
    if (!otpEmail) throw new Error('No pending OTP session');
    return resendOtp({ email: otpEmail });
  },

  // ── LOGOUT ────────────────────────────────────────────────────
  logout: async () => {
    try { await logout(); } catch (e) { console.warn('Logout error:', e); }
    await AsyncStorage.removeItem('user');
    set({ user: null, isAuthenticated: false, otpPending: false, otpEmail: null });
  },

  // ── CANCEL OTP ────────────────────────────────────────────────
  cancelOtp: () => set({ otpPending: false, otpEmail: null }),

  // ── UPDATE USER ───────────────────────────────────────────────
  updateUser: (updates) => set((state) => ({ user: { ...state.user, ...updates } })),
}));

export default useAuthStore;