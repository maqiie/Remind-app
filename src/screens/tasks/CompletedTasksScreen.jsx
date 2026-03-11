// src/screens/tasks/CompletedTasksScreen.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, spacing, radius } from '../../theme';
import { getReminders } from '../../api/reminders';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmt(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

const PRIORITY_CONFIG = {
  high:   { color: '#D94F4F', bg: '#FDF0F0' },
  medium: { color: '#E09F3E', bg: '#FFF8EC' },
  low:    { color: '#6B9E78', bg: '#EAF2EC' },
};

function TaskRow({ item, index }) {
  const p = PRIORITY_CONFIG[item.priority?.toLowerCase()] || PRIORITY_CONFIG.low;
  return (
    <View style={tr.row}>
      <View style={[tr.accent, { backgroundColor: p.color }]} />
      <View style={[tr.check, { backgroundColor: p.color }]}>
        <Ionicons name="checkmark" size={12} color="#fff" />
      </View>
      <View style={tr.body}>
        <Text style={tr.title} numberOfLines={1}>{item.title}</Text>
        {item.due_date && <Text style={tr.date}>{fmt(item.due_date)}</Text>}
      </View>
      <View style={[tr.badge, { backgroundColor: p.bg }]}>
        <Text style={[tr.badgeTxt, { color: p.color }]}>{item.priority || 'low'}</Text>
      </View>
    </View>
  );
}

export default function CompletedTasksScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [tasks,      setTasks]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { load(); }, []);

  const load = useCallback(async () => {
    try {
      const data = await getReminders();
      const list = Array.isArray(data) ? data : (data?.reminders || data?.data || []);
      setTasks(list.filter((r) => r.completed));
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View>
          <Text style={s.title}>Completed</Text>
          {!loading && <Text style={s.subtitle}>{tasks.length} task{tasks.length !== 1 ? 's' : ''}</Text>}
        </View>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item, index }) => <TaskRow item={item} index={index} />}
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyIcon}><Ionicons name="checkmark-done-outline" size={34} color={colors.textMuted} /></View>
              <Text style={s.emptyTitle}>Nothing completed yet</Text>
              <Text style={s.emptySub}>Complete a reminder to see it here</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const tr = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.md, marginBottom: 8, backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', gap: 10, paddingRight: spacing.md, paddingVertical: 14 },
  accent:  { width: 4, alignSelf: 'stretch' },
  check:   { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  body:    { flex: 1, gap: 2 },
  title:   { fontFamily: fonts.sansMedium, fontSize: 14.5, color: colors.textSecondary, textDecorationLine: 'line-through' },
  date:    { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted },
  badge:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  badgeTxt:{ fontFamily: fonts.sansMedium, fontSize: 10, textTransform: 'capitalize' },
});

const s = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: colors.bg },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  backBtn:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:     { fontFamily: fonts.serifBold, fontSize: 22, color: colors.textPrimary, letterSpacing: -0.4 },
  subtitle:  { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted },
  list:      { paddingTop: spacing.sm },
  empty:     { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.bgInput, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle:{ fontFamily: fonts.serif, fontSize: 20, color: colors.textPrimary },
  emptySub:  { fontFamily: fonts.sans, fontSize: 14, color: colors.textMuted },
});