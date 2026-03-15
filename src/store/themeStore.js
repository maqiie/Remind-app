// src/store/themeStore.js
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'app_theme_dark';

const useThemeStore = create((set, get) => ({
  isDark: true, // default dark

  // Call once on app boot to rehydrate from storage
  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored !== null) set({ isDark: stored === 'true' });
    } catch (_) {}
  },

  toggle: async () => {
    const next = !get().isDark;
    set({ isDark: next });
    try { await AsyncStorage.setItem(STORAGE_KEY, String(next)); } catch (_) {}
  },

  setDark: async (value) => {
    set({ isDark: value });
    try { await AsyncStorage.setItem(STORAGE_KEY, String(value)); } catch (_) {}
  },
}));

export default useThemeStore;