// src/screens/reminders/RemindersScreen.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, Animated, RefreshControl, TextInput, Pressable,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, spacing, radius, shadows } from '../../theme';
import { getReminders, deleteReminder, completeReminder } from '../../api/reminders';
import client from '../../api/client';

const FILTERS = ['All', 'Today', 'Upcoming', 'Overdue', 'Done'];

const PRIORITY = {
  high:   { dot: '#D94F4F', label: 'HIGH',   tag: '#FDF0F0', tagText: '#D94F4F' },
  medium: { dot: '#E09F3E', label: 'MED',    tag: '#FDF6EC', tagText: '#C8841A' },
  low:    { dot: '#6B9E78', label: 'LOW',    tag: '#F0F6F1', tagText: '#4E7D5B' },
};

function isToday(date) {
  const d = new Date(date), t = new Date();
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
}
function isOverdue(date)  { return new Date(date) < new Date() && !isToday(date); }
function isUpcoming(date) { return new Date(date) > new Date(); }

function formatDue(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  if (isToday(dateStr)) return `Today · ${time}`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + '  ' + time;
}

// ── Filter Tabs (underline style, no pills) ────────────────────────────────────
function FilterTabs({ active, onChange, counts }) {
  return (
    <Animated.ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={ft.row}
    >
      {FILTERS.map((f) => {
        const on = active === f;
        return (
          <TouchableOpacity key={f} style={ft.tab} onPress={() => onChange(f)} activeOpacity={0.6}>
            <View style={ft.tabInner}>
              <Text style={[ft.label, on && ft.labelOn]}>{f}</Text>
              {counts[f] > 0 && (
                <Text style={[ft.count, on && ft.countOn]}>{counts[f]}</Text>
              )}
            </View>
            {on && <View style={ft.underline} />}
          </TouchableOpacity>
        );
      })}
    </Animated.ScrollView>
  );
}

// ── Reminder Row (newspaper / legal-pad style) ────────────────────────────────
function ReminderCard({ item, onPress, onComplete, onDelete, index }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 240, delay: index * 35, useNativeDriver: true,
    }).start();
  }, []);

  const p       = PRIORITY[item.priority?.toLowerCase()] || PRIORITY.low;
  const overdue = item.due_date && isOverdue(item.due_date) && !item.completed;
  const dueText = formatDue(item.due_date);

  return (
    <Animated.View style={{ opacity: anim }}>
      <Pressable
        style={({ pressed }) => [row.wrap, pressed && row.pressed, item.completed && row.done]}
        onPress={onPress}
      >
        {/* Left: number / checkbox column */}
        <TouchableOpacity
          style={row.checkCol}
          onPress={onComplete}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
        >
          <View style={[
            row.box,
            item.completed && { backgroundColor: colors.primary, borderColor: colors.primary },
            !item.completed && { borderColor: p.dot },
          ]}>
            {item.completed
              ? <Ionicons name="checkmark" size={10} color="#fff" />
              : <View style={[row.boxDot, { backgroundColor: p.dot }]} />
            }
          </View>
        </TouchableOpacity>

        {/* Center: content */}
        <View style={row.content}>
          {/* Title row */}
          <View style={row.titleRow}>
            <Text
              style={[row.title, item.completed && row.titleDone]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            {/* Priority tag — stamp style */}
            <View style={[row.stamp, { backgroundColor: p.tag, borderColor: p.dot + '50' }]}>
              <Text style={[row.stampText, { color: p.tagText }]}>{p.label}</Text>
            </View>
          </View>

          {/* Description */}
          {item.description ? (
            <Text style={row.desc} numberOfLines={1}>{item.description}</Text>
          ) : null}

          {/* Meta line — ruled style */}
          <View style={row.metaLine}>
            {dueText ? (
              <Text style={[row.meta, overdue && row.metaOverdue]}>
                {overdue ? '⚠ ' : ''}{dueText}
              </Text>
            ) : null}
            {item.location ? (
              <Text style={row.metaDot}>  ·  {item.location}</Text>
            ) : null}
            {item.is_special_event ? (
              <Text style={row.metaSpecial}>  ★</Text>
            ) : null}
          </View>
        </View>

        {/* Right: delete */}
        <TouchableOpacity
          style={row.deleteCol}
          onPress={onDelete}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 12 }}
        >
          <Text style={row.deleteX}>×</Text>
        </TouchableOpacity>
      </Pressable>

      {/* Full-width rule line */}
      <View style={row.rule} />
    </Animated.View>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({ filter, onAdd }) {
  const map = {
    All:      { label: 'No entries',        sub: 'Press + to create your first reminder' },
    Today:    { label: 'Nothing today',     sub: 'Enjoy the quiet' },
    Upcoming: { label: 'Schedule is clear', sub: 'No upcoming entries' },
    Done:     { label: 'Nothing completed', sub: 'Mark a reminder done to see it here' },
    Overdue:  { label: 'All caught up',     sub: 'No overdue entries' },
  };
  const { label, sub } = map[filter] || map.All;
  return (
    <View style={em.wrap}>
      <View style={em.ledger}>
        <View style={em.ledgerLine} />
        <View style={em.ledgerLine} />
        <View style={em.ledgerLine} />
        <View style={em.ledgerLine} />
      </View>
      <Text style={em.label}>{label}</Text>
      <Text style={em.sub}>{sub}</Text>
      {filter === 'All' && (
        <TouchableOpacity style={em.cta} onPress={onAdd}>
          <Text style={em.ctaText}>+ New reminder</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function RemindersScreen({ navigation }) {
  const [reminders,  setReminders]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState('All');
  const [search,     setSearch]     = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [error,      setError]      = useState(null);
  const [inviteCount, setInviteCount] = useState(0);

  const searchRef  = useRef(null);
  const scrollY    = useRef(new Animated.Value(0)).current;
  const searchAnim = useRef(new Animated.Value(0)).current;
  const fabScale   = useRef(new Animated.Value(0)).current;

  const titleSize = scrollY.interpolate({ inputRange: [0, 60], outputRange: [32, 18], extrapolate: 'clamp' });
  const headerPT  = scrollY.interpolate({ inputRange: [0, 60], outputRange: [spacing.xl, spacing.md], extrapolate: 'clamp' });

  useEffect(() => {
    Animated.spring(fabScale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 10 }).start();
    loadData();
    fetchInviteCount();
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', loadData);
    return unsub;
  }, [navigation]);

  useEffect(() => {
    Animated.timing(searchAnim, { toValue: showSearch ? 1 : 0, duration: 180, useNativeDriver: false }).start();
    if (showSearch) setTimeout(() => searchRef.current?.focus(), 200);
  }, [showSearch]);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const data = await getReminders();
      const list = Array.isArray(data) ? data : (data?.reminders || data?.data || []);
      setReminders(list);
    } catch {
      setError('Could not load reminders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = async () => { setRefreshing(true); await loadData(); };

  const handleComplete = async (id) => {
    setReminders((p) => p.map((r) => r.id === id ? { ...r, completed: !r.completed } : r));
    try { await completeReminder(id); }
    catch { setReminders((p) => p.map((r) => r.id === id ? { ...r, completed: !r.completed } : r)); }
  };

  const handleDelete = async (id) => {
    const bk = [...reminders];
    setReminders((p) => p.filter((r) => r.id !== id));
    try { await deleteReminder(id); } catch { setReminders(bk); }
  };

  const applyFilter = (r, f) => {
    switch (f) {
      case 'Today':    return r.due_date && isToday(r.due_date) && !r.completed;
      case 'Upcoming': return r.due_date && isUpcoming(r.due_date) && !r.completed;
      case 'Done':     return r.completed;
      case 'Overdue':  return r.due_date && isOverdue(r.due_date) && !r.completed;
      default:         return true;
    }
  };

  const filtered = reminders.filter((r) => {
    const q = search.trim().toLowerCase();
    return (!q || r.title?.toLowerCase().includes(q)) && applyFilter(r, filter);
  });

  const counts = FILTERS.reduce((acc, f) => {
    acc[f] = f === 'All' ? reminders.length : reminders.filter((r) => applyFilter(r, f)).length;
    return acc;
  }, {});

  const pending = reminders.filter((r) => !r.completed).length;

  const fetchInviteCount = async () => {
    try {
      const res  = await client.get('/invitations');
      const data = res.data;
      const list = Array.isArray(data) ? data : (data?.invitations || []);
      setInviteCount(list.filter((i) => i.status === 'pending').length);
    } catch { /* silent */ }
  };
  const today   = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <View style={s.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      {/* ── Header ── */}
      <Animated.View style={[s.header, { paddingTop: headerPT }]}>
        <View style={s.headerLeft}>
          <Animated.Text style={[s.title, { fontSize: titleSize }]}>Reminders</Animated.Text>
          <Text style={s.date}>{today}</Text>
        </View>
        <View style={s.headerRight}>
          <Text style={s.pendingCount}>{pending}</Text>
          <Text style={s.pendingLabel}>pending</Text>
          <View style={s.headerBtns}>
            {/* Invitations button with badge */}
            <TouchableOpacity
              style={s.headerBtn}
              onPress={() => navigation.navigate('Invitations')}
              activeOpacity={0.75}
            >
              <Ionicons
                name="mail-outline"
                size={18}
                color={inviteCount > 0 ? colors.primary : colors.textSecondary}
              />
              {inviteCount > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{inviteCount > 9 ? '9+' : inviteCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Search toggle */}
            <TouchableOpacity
              style={s.searchBtn}
              onPress={() => { setShowSearch((v) => !v); if (showSearch) setSearch(''); }}
            >
              <Ionicons
                name={showSearch ? 'close' : 'search-outline'}
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* ── Thick rule under header ── */}
      <View style={s.headerRule} />

      {/* ── Search ── */}
      <Animated.View style={[
        s.searchWrap,
        { maxHeight: searchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 50] }), opacity: searchAnim },
      ]}>
        <View style={s.searchRow}>
          <Text style={s.searchIcon}>↳</Text>
          <TextInput
            ref={searchRef}
            style={s.searchInput}
            placeholder="Search entries..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Text style={s.searchClear}>clear</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={s.searchRule} />
      </Animated.View>

      {/* ── Filter Tabs ── */}
      <FilterTabs active={filter} onChange={setFilter} counts={counts} />

      {/* ── Column headers ── */}
      <View style={s.colHeaders}>
        <Text style={s.colCheck}> </Text>
        <Text style={[s.colText, { flex: 1 }]}>TITLE</Text>
        <Text style={s.colText}>DUE</Text>
      </View>
      <View style={s.colRule} />

      {/* ── Error ── */}
      {error ? (
        <TouchableOpacity style={s.errorRow} onPress={loadData}>
          <Text style={s.errorText}>! {error} — tap to retry</Text>
        </TouchableOpacity>
      ) : null}

      {/* ── List ── */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[s.list, !filtered.length && s.listEmpty]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={!loading ? <EmptyState filter={filter} onAdd={() => navigation.navigate('CreateReminder')} /> : null}
        renderItem={({ item, index }) => (
          <ReminderCard
            item={item}
            index={index}
            onPress={() => navigation.navigate('ReminderDetail', { id: item.id })}
            onComplete={() => handleComplete(item.id)}
            onDelete={() => handleDelete(item.id)}
          />
        )}
      />

      {/* ── FAB ── */}
      <Animated.View style={[s.fab, { transform: [{ scale: fabScale }] }]}>
        <TouchableOpacity
          style={s.fabBtn}
          onPress={() => navigation.navigate('CreateReminder')}
          activeOpacity={0.85}
        >
          <Text style={s.fabText}>+</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ── Stylesheets ───────────────────────────────────────────────────────────────

// Filter tabs
const ft = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: { marginRight: spacing.md, paddingBottom: 0 },
  tabInner: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 10 },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 12.5,
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  labelOn: { color: colors.textPrimary },
  count: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
  },
  countOn: { color: colors.primary },
  underline: {
    height: 2,
    backgroundColor: colors.textPrimary,
    borderRadius: 1,
    marginTop: -1,
  },
});

// Card row styles — newspaper / ledger aesthetic
const row = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    backgroundColor: colors.bg,
  },
  pressed: { backgroundColor: colors.bgInput },
  done:    { opacity: 0.45 },
  rule: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
    opacity: 0.7,
  },

  // Checkbox column
  checkCol: { width: 32, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  box: {
    width: 18, height: 18,
    borderWidth: 1.5,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxDot: { width: 6, height: 6, borderRadius: 1 },

  // Content
  content: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    flex: 1,
    fontFamily: fonts.sansMedium,
    fontSize: 14.5,
    color: colors.textPrimary,
    letterSpacing: -0.1,
  },
  titleDone: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },

  // Priority stamp — like a rubber stamp / label
  stamp: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
  },
  stampText: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  desc: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.textMuted,
    lineHeight: 17,
  },

  // Meta line — all inline, no chips, just text
  metaLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  meta:     { fontFamily: fonts.sans, fontSize: 11.5, color: colors.textMuted },
  metaOverdue: { color: '#D94F4F' },
  metaDot:  { fontFamily: fonts.sans, fontSize: 11.5, color: colors.textMuted },
  metaSpecial: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.warning },

  // Delete column
  deleteCol: { width: 28, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  deleteX: {
    fontFamily: fonts.sansMedium,
    fontSize: 20,
    color: colors.textMuted + '70',
    lineHeight: 24,
  },
});

// Empty state — ledger lines
const em = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 48,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  ledger: { width: 120, gap: 10, marginBottom: spacing.md },
  ledgerLine: {
    height: 1,
    backgroundColor: colors.border,
    width: '100%',
  },
  label: {
    fontFamily: fonts.serifBold,
    fontSize: 20,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  sub: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
  cta: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.textPrimary,
    borderRadius: 3,
  },
  ctaText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textPrimary },
});

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerLeft: { gap: 2 },
  title: {
    fontFamily: fonts.serifBold,
    color: colors.textPrimary,
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  date: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
  headerRight: { alignItems: 'flex-end', gap: 2 },
  pendingCount: {
    fontFamily: fonts.serifBold,
    fontSize: 28,
    color: colors.textPrimary,
    lineHeight: 30,
    letterSpacing: -1,
  },
  pendingLabel: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  searchBtn: { padding: 4 },
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  headerBtn: { padding: 4, position: 'relative' },
  badge: {
    position: 'absolute', top: -2, right: -4,
    backgroundColor: colors.error,
    borderRadius: 8, minWidth: 15, height: 15,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontFamily: fonts.sansMedium, fontSize: 8.5, color: '#fff' },

  // Thick double rule
  headerRule: {
    borderBottomWidth: 3,
    borderBottomColor: colors.textPrimary,
    marginHorizontal: spacing.lg,
    marginBottom: 0,
  },

  // Search row
  searchWrap: { overflow: 'hidden', paddingHorizontal: spacing.lg },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
  },
  searchIcon: { fontFamily: fonts.sans, fontSize: 16, color: colors.textMuted },
  searchInput: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textPrimary,
    padding: 0,
  },
  searchClear: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  searchRule: { height: 1, backgroundColor: colors.border },

  // Column headers — like a spreadsheet header
  colHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
    paddingLeft: spacing.lg + 42, // align with content after checkbox
    backgroundColor: colors.bgInput,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  colCheck: { width: 32 },
  colText: {
    fontFamily: fonts.sansMedium,
    fontSize: 9.5,
    color: colors.textMuted,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  colRule: { height: 0 },

  // Error
  errorRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FFCDD2',
    backgroundColor: '#FFF5F5',
  },
  errorText: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.error },

  list:      { paddingBottom: 120 },
  listEmpty: { flex: 1 },

  // FAB — square, not circle
  fab: { position: 'absolute', bottom: 100, right: spacing.lg },
  fabBtn: {
    width: 52, height: 52,
    borderRadius: 6,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  fabText: {
    fontFamily: fonts.sans,
    fontSize: 30,
    color: '#fff',
    lineHeight: 36,
    marginTop: -2,
  },
});