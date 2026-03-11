// src/store/badgeStore.js
import { create } from 'zustand';

const useBadgeStore = create((set, get) => ({
  unreadNotifications: 0,
  unreadMessages:      0,

  setUnreadNotifications: (count) => set({ unreadNotifications: count }),
  setUnreadMessages:      (count) => set({ unreadMessages: count }),

  incrementNotifications: () =>
    set((s) => ({ unreadNotifications: s.unreadNotifications + 1 })),

  clearNotifications: () => set({ unreadNotifications: 0 }),
  clearMessages:      () => set({ unreadMessages: 0 }),
}));

export default useBadgeStore;