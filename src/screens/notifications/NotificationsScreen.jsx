// src/screens/notifications/NotificationsScreen.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Animated, ActivityIndicator, RefreshControl, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, spacing, radius, shadows } from '../../theme';
import { getNotifications } from '../../api/social';
import useBadgeStore from '../../store/badgeStore';

// ── Notification type config ──────────────────────────────────────────────────
function getTypeConfig(notification) {
  const type = notification?.notification_type || notification?.type || '';

  if (type.includes('friend') || type.includes('request')) {
    return { icon: 'people', color: '#6B9E78', bg: '#EAF2EC', label: 'Friend Request' };
  }
  if (type.includes('reminder') || type.includes('due')) {
    return { icon: 'alarm', color: '#E09F3E', bg: '#FDF3E3', label: 'Reminder' };
  }
  if (type.includes('accept')) {
    return { icon: 'checkmark-circle', color: '#6B9E78', bg: '#EAF2EC', label: 'Accepted' };
  }
  if (type.includes('message') || type.includes('chat')) {
    return { icon: 'chatbubble', color: '#5B8DEF', bg: '#EBF1FD', label: 'Message' };
  }
  if (type.includes('organization') || type.includes('invite')) {
    return { icon: 'business', color: '#9B6FE6', bg: '#F2ECFD', label: 'Invite' };
  }
  // Default / system
  return { icon: 'notifications', color: colors.textSecondary, bg: colors.bgInput, label: 'Notification' };
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800)return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Single notification row ───────────────────────────────────────────────────
function NotifRow({ item, onPress, onDismiss }) {
  const cfg     = getTypeConfig(item);
  const isUnread = !item.read && !item.read_at;
  const slideX  = useRef(new Animated.Value(0)).current;
  const opac    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opac, { toValue: 1, duration: 220, useNativeDriver: false }).start();
  }, []);

  const dismiss = () => {
    Animated.timing(slideX, { toValue: -400, duration: 260, useNativeDriver: false }).start(
      () => onDismiss(item.id)
    );
  };

  const title   = item.title   || item.subject || item.message || 'Notification';
  const body    = item.body    || item.content  || item.description || '';

  return (
    <Animated.View style={{ opacity: opac, transform: [{ translateX: slideX }] }}>
      <TouchableOpacity
        style={[nr.row, isUnread && nr.rowUnread]}
        onPress={() => onPress(item)}
        activeOpacity={0.75}
      >
        {/* Icon */}
        <View style={[nr.iconWrap, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon} size={20} color={cfg.color} />
        </View>

        {/* Content */}
        <View style={nr.content}>
          <View style={nr.topRow}>
            <Text style={[nr.typeLabel, { color: cfg.color }]}>{cfg.label}</Text>
            <Text style={nr.time}>{timeAgo(item.created_at)}</Text>
          </View>
          <Text style={[nr.title, isUnread && nr.titleUnread]} numberOfLines={1}>
            {title}
          </Text>
          {!!body && (
            <Text style={nr.body} numberOfLines={2}>{body}</Text>
          )}
        </View>

        {/* Unread dot */}
        {isUnread && <View style={nr.dot} />}

        {/* Dismiss */}
        <TouchableOpacity onPress={dismiss} style={nr.closeBtn} hitSlop={8}>
          <Ionicons name="close" size={14} color={colors.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 1200, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 1,    duration: 1200, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  return (
    <View style={es.wrap}>
      <Animated.View style={[es.iconWrap, { transform: [{ scale: pulse }] }]}>
        <Ionicons name="notifications-off-outline" size={40} color={colors.textMuted} />
      </Animated.View>
      <Text style={es.title}>All caught up</Text>
      <Text style={es.sub}>No notifications right now.{'\n'}Check back later.</Text>
    </View>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHead({ label, count }) {
  return (
    <View style={sh.wrap}>
      <Text style={sh.label}>{label}</Text>
      {count > 0 && <View style={sh.badge}><Text style={sh.badgeTxt}>{count}</Text></View>}
    </View>
  );
}

// ── Filter tabs ───────────────────────────────────────────────────────────────
const FILTERS = ['All', 'Unread', 'Friends', 'Reminders'];

function FilterBar({ active, onChange }) {
  return (
    <View style={fb.wrap}>
      {FILTERS.map((f) => (
        <TouchableOpacity
          key={f}
          style={[fb.tab, active === f && fb.tabActive]}
          onPress={() => onChange(f)}
          activeOpacity={0.7}
        >
          <Text style={[fb.label, active === f && fb.labelActive]}>{f}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const setUnreadNotifications = useBadgeStore((s) => s.setUnreadNotifications);
  const clearNotifications     = useBadgeStore((s) => s.clearNotifications);

  const [notifications, setNotifications] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [filter,        setFilter]        = useState('All');
  const [error,         setError]         = useState(null);

  // Clear badge when this screen is opened
  useEffect(() => {
    clearNotifications();
    load();
  }, []);

  const load = async () => {
    setError(null);
    try {
      const data = await getNotifications();
      const list = Array.isArray(data) ? data : (data?.notifications || data?.data || []);
      setNotifications(list);
      // Badge is cleared since user is now viewing — but keep count in sync after refresh
      setUnreadNotifications(0);
    } catch (e) {
      console.error('Notifications error:', e);
      setError('Could not load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleDismiss = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const handlePress = useCallback((item) => {
    setNotifications((prev) =>
      prev.map((n) => n.id === item.id ? { ...n, read: true } : n)
    );
  }, []);

  const clearAll = () => {
    setNotifications([]);
    setUnreadNotifications(0);
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadNotifications(0);
  };

  // ── Filter logic ────────────────────────────────────────────────────────────
  const filtered = notifications.filter((n) => {
    if (filter === 'Unread')    return !n.read && !n.read_at;
    if (filter === 'Friends')   return (n.notification_type || n.type || '').includes('friend');
    if (filter === 'Reminders') return (n.notification_type || n.type || '').includes('reminder');
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read && !n.read_at).length;

  // Group into Today / Earlier
  const today = new Date().toDateString();
  const todayItems   = filtered.filter((n) => n.created_at && new Date(n.created_at).toDateString() === today);
  const earlierItems = filtered.filter((n) => !n.created_at || new Date(n.created_at).toDateString() !== today);

  // Build flat data with section headers
  const listData = [];
  if (todayItems.length)   { listData.push({ type: 'header', label: 'Today',   count: 0 }); listData.push(...todayItems.map((n) => ({ ...n, type: 'item' }))); }
  if (earlierItems.length) { listData.push({ type: 'header', label: 'Earlier', count: 0 }); listData.push(...earlierItems.map((n) => ({ ...n, type: 'item' }))); }

  const renderItem = ({ item }) => {
    if (item.type === 'header') return <SectionHead label={item.label} count={item.count} />;
    return <NotifRow item={item} onPress={handlePress} onDismiss={handleDismiss} />;
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={styles.subtitle}>{unreadCount} unread</Text>
          )}
        </View>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity style={styles.headerBtn} onPress={markAllRead}>
              <Ionicons name="checkmark-done-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity style={styles.headerBtn} onPress={clearAll}>
              <Ionicons name="trash-outline" size={17} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter bar */}
      <FilterBar active={filter} onChange={setFilter} />

      {/* Error */}
      {error && (
        <TouchableOpacity style={styles.errorBanner} onPress={load}>
          <Ionicons name="wifi-outline" size={15} color={colors.error} />
          <Text style={styles.errorText}>{error} · tap to retry</Text>
        </TouchableOpacity>
      )}

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item, i) => item.id ? String(item.id) : `header_${i}`}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 90 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={<EmptyState />}
        />
      )}
    </View>
  );
}

// ── Notification row styles ───────────────────────────────────────────────────
const nr = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginHorizontal: spacing.md, marginBottom: spacing.sm,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
    gap: spacing.sm,
  },
  rowUnread: {
    borderColor: colors.primaryLight,
    backgroundColor: '#FAFFFE',
  },
  iconWrap: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  content:  { flex: 1, gap: 2 },
  topRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeLabel:{ fontFamily: fonts.sansMedium, fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase' },
  time:     { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted },
  title:    { fontFamily: fonts.sans, fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  titleUnread: { fontFamily: fonts.sansMedium, color: colors.textPrimary },
  body:     { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6, flexShrink: 0,
  },
  closeBtn: { padding: 4, flexShrink: 0 },
});

// ── Empty state styles ────────────────────────────────────────────────────────
const es = StyleSheet.create({
  wrap:     { alignItems: 'center', paddingTop: 80, paddingHorizontal: spacing.xl },
  iconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.bgInput, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  title:    { fontFamily: fonts.serif, fontSize: 22, color: colors.textPrimary, marginBottom: spacing.xs },
  sub:      { fontFamily: fonts.sans, fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 21 },
});

// ── Section header styles ─────────────────────────────────────────────────────
const sh = StyleSheet.create({
  wrap:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  label:    { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
  badge:    { backgroundColor: colors.primaryLight, borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  badgeTxt: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.primary },
});

// ── Filter bar styles ─────────────────────────────────────────────────────────
const fb = StyleSheet.create({
  wrap:       { flexDirection: 'row', paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.xs },
  tab:        { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.bgInput },
  tabActive:  { backgroundColor: colors.textPrimary },
  label:      { fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary },
  labelActive:{ fontFamily: fonts.sansMedium, color: '#fff' },
});

// ── Main styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: colors.bg },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  title:    { fontFamily: fonts.serif, fontSize: 28, color: colors.textPrimary, letterSpacing: -0.3 },
  subtitle: { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: spacing.xs, paddingTop: 6 },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.md, marginBottom: spacing.sm,
    padding: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.errorLight, borderWidth: 1, borderColor: colors.error + '30',
  },
  errorText: { fontFamily: fonts.sans, fontSize: 13, color: colors.error },

  list: { paddingTop: spacing.xs },
});