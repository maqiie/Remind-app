// src/screens/reminders/ReminderDetailScreen.jsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, spacing, radius, shadows } from '../../theme';
import { getReminder, completeReminder, deleteReminder } from '../../api/reminders';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function pad(n) { return String(n).padStart(2, '0'); }

const PRIORITY_CONFIG = {
  high:   { color: '#D94F4F', bg: '#FDF0F0', label: 'High' },
  medium: { color: '#E09F3E', bg: '#FFF8EC', label: 'Medium' },
  low:    { color: '#6B9E78', bg: '#EAF2EC', label: 'Low' },
};

function InfoRow({ icon, label, value, color }) {
  if (!value) return null;
  return (
    <View style={ir.row}>
      <View style={[ir.icon, { backgroundColor: (color || colors.textMuted) + '18' }]}>
        <Ionicons name={icon} size={16} color={color || colors.textMuted} />
      </View>
      <View style={ir.body}>
        <Text style={ir.label}>{label}</Text>
        <Text style={ir.value}>{value}</Text>
      </View>
    </View>
  );
}

export default function ReminderDetailScreen({ route, navigation }) {
  const { id } = route.params || {};
  const insets = useSafeAreaInsets();

  const [reminder,  setReminder]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [completing,setCompleting]= useState(false);
  const [error,     setError]     = useState(null);

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    try {
      const data = await getReminder(id);
      setReminder(data?.reminder || data);
    } catch (e) {
      setError('Could not load reminder');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await completeReminder(id);
      setReminder((r) => ({ ...r, completed: !r.completed }));
    } catch {}
    finally { setCompleting(false); }
  };

  const handleDelete = async () => {
    try {
      await deleteReminder(id);
      navigation.goBack();
    } catch {}
  };

  if (loading) {
    return (
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      </View>
    );
  }

  if (error || !reminder) {
    return (
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <View style={s.center}>
          <Text style={s.errorTxt}>{error || 'Not found'}</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backLink}>
            <Text style={s.backLinkTxt}>← Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const p = PRIORITY_CONFIG[reminder.priority?.toLowerCase()] || PRIORITY_CONFIG.low;
  const due = reminder.due_date ? new Date(reminder.due_date) : null;
  const dueFmt = due
    ? `${MONTHS[due.getMonth()]} ${due.getDate()}, ${due.getFullYear()} · ${pad(due.getHours())}:${pad(due.getMinutes())}`
    : null;

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{reminder.title}</Text>
        <TouchableOpacity style={s.deleteBtn} onPress={handleDelete} hitSlop={8}>
          <Ionicons name="trash-outline" size={18} color={colors.error} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title card */}
        <View style={s.titleCard}>
          <View style={[s.accentBar, { backgroundColor: reminder.completed ? colors.border : p.color }]} />
          <View style={s.titleCardBody}>
            <Text style={[s.title, reminder.completed && s.titleDone]}>{reminder.title}</Text>
            {!!reminder.description && (
              <Text style={s.desc}>{reminder.description}</Text>
            )}
            <View style={s.badgeRow}>
              <View style={[s.badge, { backgroundColor: p.bg }]}>
                <Text style={[s.badgeTxt, { color: p.color }]}>{p.label} priority</Text>
              </View>
              {reminder.is_special_event && (
                <View style={[s.badge, { backgroundColor: '#FEF3E2' }]}>
                  <Text style={[s.badgeTxt, { color: '#E09F3E' }]}>★ Special</Text>
                </View>
              )}
              {reminder.completed && (
                <View style={[s.badge, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[s.badgeTxt, { color: colors.primary }]}>✓ Done</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Info rows */}
        <View style={s.infoCard}>
          <InfoRow icon="time-outline"      label="Due"      value={dueFmt}           color="#5B8DEF" />
          <InfoRow icon="hourglass-outline" label="Duration" value={reminder.duration} color={colors.primary} />
          <InfoRow icon="location-outline"  label="Location" value={reminder.location} color="#D94F4F" />
          <InfoRow icon="ribbon-outline"    label="Occasion" value={reminder.occasion} color="#E09F3E" />
          <InfoRow icon="repeat-outline"    label="Repeats"
            value={reminder.repeat_interval
              ? `Every ${reminder.repeat_interval} ${reminder.repeat_interval_unit || 'day'}(s)`
              : null}
            color="#9B6FE6"
          />
        </View>

        {/* Complete button */}
        <TouchableOpacity
          style={[s.completeBtn, reminder.completed && s.completeBtnDone]}
          onPress={handleComplete}
          disabled={completing}
          activeOpacity={0.85}
        >
          {completing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons
                name={reminder.completed ? 'refresh-outline' : 'checkmark-circle-outline'}
                size={20}
                color="#fff"
              />
              <Text style={s.completeBtnTxt}>
                {reminder.completed ? 'Mark Incomplete' : 'Mark Complete'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const ir = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, gap: 12 },
  icon:  { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  body:  { flex: 1 },
  label: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, marginBottom: 1 },
  value: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.textPrimary },
});

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorTxt: { fontFamily: fonts.sans, fontSize: 15, color: colors.textMuted },
  backLink: { padding: 8 },
  backLinkTxt: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.primary },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontFamily: fonts.serifBold, fontSize: 17, color: colors.textPrimary, letterSpacing: -0.3 },
  deleteBtn:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  scroll: { padding: spacing.md, gap: spacing.md },

  titleCard: {
    flexDirection: 'row', backgroundColor: colors.bgCard,
    borderRadius: 18, borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  accentBar:    { width: 5 },
  titleCardBody:{ flex: 1, padding: spacing.md, gap: 8 },
  title:        { fontFamily: fonts.serifBold, fontSize: 22, color: colors.textPrimary, letterSpacing: -0.4, lineHeight: 28 },
  titleDone:    { textDecorationLine: 'line-through', color: colors.textMuted },
  desc:         { fontFamily: fonts.sans, fontSize: 14, color: colors.textSecondary, lineHeight: 21 },
  badgeRow:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  badge:        { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  badgeTxt:     { fontFamily: fonts.sansMedium, fontSize: 11 },

  infoCard: {
    backgroundColor: colors.bgCard, borderRadius: 18,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, marginBottom: spacing.md,
  },

  completeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: radius.full,
    paddingVertical: 16, marginTop: spacing.sm,
  },
  completeBtnDone: { backgroundColor: colors.textSecondary },
  completeBtnTxt:  { fontFamily: fonts.sansMedium, fontSize: 15, color: '#fff' },
});