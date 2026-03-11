// src/screens/reminders/CreateReminderScreen.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, StatusBar, Animated, Platform,
  KeyboardAvoidingView, Switch, Modal, FlatList, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, spacing, radius, shadows } from '../../theme';
import { createReminder } from '../../api/reminders';
import client from '../../api/client';

// ── Constants ─────────────────────────────────────────────────────────────────
const PRIORITIES = [
  { value: 'low',    label: 'Low',    color: '#6B9E78', bg: '#EAF2EC' },
  { value: 'medium', label: 'Medium', color: '#E09F3E', bg: '#FFF8EC' },
  { value: 'high',   label: 'High',   color: '#D94F4F', bg: '#FFF0F0' },
];

const DURATIONS = [
  { value: '15 minutes', label: '15 min' },
  { value: '30 minutes', label: '30 min' },
  { value: '1 hour',     label: '1 hr'   },
  { value: '2 hours',    label: '2 hrs'  },
  { value: '3 hours',    label: '3 hrs'  },
  { value: 'All day',    label: 'All day'},
];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const HOURS   = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function pad(n) { return String(n).padStart(2, '0'); }

// ── Utility: days in month ─────────────────────────────────────────────────────
function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

// ── Date Picker Modal ─────────────────────────────────────────────────────────
function DatePickerModal({ visible, onClose, onConfirm, initial }) {
  const now   = new Date();
  const [day,  setDay]  = useState(initial ? initial.getDate()     : now.getDate());
  const [mon,  setMon]  = useState(initial ? initial.getMonth() + 1 : now.getMonth() + 1);
  const [year, setYear] = useState(initial ? initial.getFullYear() : now.getFullYear());
  const [hour, setHour] = useState(initial ? initial.getHours()    : now.getHours() + 1);
  const [min,  setMin]  = useState(initial ? initial.getMinutes()  : 0);

  const maxDay = daysInMonth(mon, year);
  const safeDay = Math.min(day, maxDay);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() + i);
  const days  = Array.from({ length: maxDay }, (_, i) => i + 1);

  const Spinner = ({ items, value, onChange, format }) => (
    <ScrollView
      style={dp.spinnerScroll}
      showsVerticalScrollIndicator={false}
      snapToInterval={44}
      decelerationRate="fast"
      contentContainerStyle={{ paddingVertical: 44 }}
    >
      {items.map((item) => {
        const active = item === value;
        return (
          <TouchableOpacity
            key={item}
            onPress={() => onChange(item)}
            style={[dp.spinnerItem, active && dp.spinnerItemActive]}
          >
            <Text style={[dp.spinnerText, active && dp.spinnerTextActive]}>
              {format ? format(item) : item}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const handleConfirm = () => {
    const d = new Date(year, mon - 1, safeDay, hour, min, 0);
    if (d <= new Date()) {
      // nudge to tomorrow if in past
      d.setDate(d.getDate() + 1);
    }
    onConfirm(d);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={dp.overlay}>
        <TouchableOpacity style={dp.backdrop} onPress={onClose} />
        <View style={dp.sheet}>
          <View style={dp.sheetHandle} />
          <Text style={dp.sheetTitle}>Pick Date & Time</Text>

          {/* Spinners row */}
          <View style={dp.spinners}>
            {/* Day */}
            <View style={dp.spinnerWrap}>
              <Text style={dp.spinnerLabel}>Day</Text>
              <Spinner items={days} value={safeDay} onChange={setDay} />
            </View>
            {/* Month */}
            <View style={dp.spinnerWrap}>
              <Text style={dp.spinnerLabel}>Month</Text>
              <Spinner items={Array.from({ length: 12 }, (_, i) => i + 1)} value={mon} onChange={setMon} format={(m) => MONTHS[m - 1]} />
            </View>
            {/* Year */}
            <View style={dp.spinnerWrap}>
              <Text style={dp.spinnerLabel}>Year</Text>
              <Spinner items={years} value={year} onChange={setYear} />
            </View>
            {/* Separator */}
            <View style={dp.timeSep}><Text style={dp.timeSepText}>@</Text></View>
            {/* Hour */}
            <View style={dp.spinnerWrap}>
              <Text style={dp.spinnerLabel}>Hour</Text>
              <Spinner items={HOURS} value={hour} onChange={setHour} format={(h) => pad(h)} />
            </View>
            {/* Minute */}
            <View style={dp.spinnerWrap}>
              <Text style={dp.spinnerLabel}>Min</Text>
              <Spinner items={MINUTES} value={min} onChange={setMin} format={(m) => pad(m)} />
            </View>
          </View>

          {/* Preview */}
          <View style={dp.preview}>
            <Ionicons name="calendar-outline" size={15} color={colors.primary} />
            <Text style={dp.previewText}>
              {MONTHS[mon - 1]} {safeDay}, {year} at {pad(hour)}:{pad(min)}
            </Text>
          </View>

          <View style={dp.actions}>
            <TouchableOpacity style={dp.cancelBtn} onPress={onClose}>
              <Text style={dp.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={dp.confirmBtn} onPress={handleConfirm}>
              <Text style={dp.confirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Tag Friends Modal ─────────────────────────────────────────────────────────
function TagFriendsModal({ visible, onClose, selected, onToggle }) {
  const [results,  setResults]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [query,    setQuery]    = useState('');
  const debounceRef = useRef(null);

  // Search users as user types — debounced 400ms
  const handleSearch = (text) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      client.get('/users/search', { params: { q: text.trim() } })
        .then((res) => {
          const data = res.data;
          const list = Array.isArray(data) ? data : (data?.users || []);
          setResults(list);
        })
        .catch((e) => console.warn('User search error:', e))
        .finally(() => setLoading(false));
    }, 400);
  };

  // Reset on close
  useEffect(() => {
    if (!visible) { setQuery(''); setResults([]); }
  }, [visible]);

  const renderFriend = ({ item }) => {
    const id    = item.id;
    const name  = item.name  || item.username || 'Unknown';
    const email = item.email || '';
    const on    = selected.includes(id);
    const init  = name.charAt(0).toUpperCase();

    return (
      <TouchableOpacity
        style={[tf.row, on && tf.rowOn]}
        onPress={() => onToggle(id, name)}
        activeOpacity={0.75}
      >
        <View style={[tf.avatar, on && { backgroundColor: colors.primary }]}>
          <Text style={[tf.avatarText, on && { color: '#fff' }]}>{init}</Text>
        </View>
        <View style={tf.info}>
          <Text style={tf.name}>{name}</Text>
          <Text style={tf.email} numberOfLines={1}>{email}</Text>
        </View>
        <View style={[tf.check, on && tf.checkOn]}>
          {on && <Ionicons name="checkmark" size={13} color="#fff" />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={tf.overlay}>
        <TouchableOpacity style={tf.backdrop} onPress={onClose} />
        <View style={tf.sheet}>
          <View style={tf.handle} />
          <View style={tf.headerRow}>
            <Text style={tf.title}>Tag Friends</Text>
            {selected.length > 0 && (
              <View style={tf.countBadge}>
                <Text style={tf.countText}>{selected.length} selected</Text>
              </View>
            )}
          </View>

          {/* Search */}
          <View style={tf.searchBar}>
            <Ionicons name="search-outline" size={15} color={colors.textMuted} />
            <TextInput
              style={tf.searchInput}
              value={query}
              onChangeText={handleSearch}
              placeholder="Search by name or email..."
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
            />
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : !query.trim() ? (
            <View style={tf.empty}>
              <Ionicons name="search-outline" size={32} color={colors.textMuted} style={{ marginBottom: 8 }} />
              <Text style={tf.emptyText}>Type a name or email to search</Text>
            </View>
          ) : results.length === 0 ? (
            <View style={tf.empty}>
              <Text style={tf.emptyText}>No users found for "{query}"</Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderFriend}
              style={{ maxHeight: 340 }}
              showsVerticalScrollIndicator={false}
            />
          )}

          <TouchableOpacity style={tf.doneBtn} onPress={onClose}>
            <Text style={tf.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ text }) {
  return <Text style={sl.text}>{text}</Text>;
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function CreateReminderScreen({ navigation }) {
  const [form, setForm] = useState({
    title:                '',
    description:          '',
    priority:             'medium',
    duration:             '',
    location:             '',
    occasion:             '',
    is_special_event:     false,
    repeat_interval:      '',
    repeat_interval_unit: '',
  });

  const [dueDate,       setDueDate]       = useState(null);   // Date object
  const [taggedFriends, setTaggedFriends] = useState([]);      // user id array
  const [friendNames,   setFriendNames]   = useState({});      // id -> name map
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTagModal,   setShowTagModal]   = useState(false);
  const [errors,  setErrors]  = useState({});
  const [saving,  setSaving]  = useState(false);

  const set = (key) => (val) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  // Toggle a friend in/out of tagged list
  const toggleFriend = (id, name) => {
    setTaggedFriends((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
    setFriendNames((prev) => ({ ...prev, [id]: name }));
  };

  // ── Validation ──────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!form.title.trim())  e.title    = 'Title is required';
    if (!dueDate)            e.due_date = 'Due date is required';
    if (!form.duration)      e.duration = 'Duration is required';
    if (dueDate && dueDate <= new Date()) e.due_date = 'Must be a future date';
    if (form.repeat_interval_unit && !form.repeat_interval) {
      e.repeat_interval = 'Enter the repeat number';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);

    try {
      const payload = {
        title:                form.title.trim(),
        description:          form.description.trim() || undefined,
        due_date:             dueDate.toISOString(),
        duration:             form.duration,
        priority:             form.priority,
        location:             form.location.trim()  || undefined,
        occasion:             form.occasion.trim()  || undefined,
        is_special_event:     form.is_special_event,
        repeat_interval:      form.repeat_interval ? parseInt(form.repeat_interval, 10) : undefined,
        repeat_interval_unit: form.repeat_interval_unit || undefined,
        user_ids:             taggedFriends.length > 0 ? taggedFriends : undefined,
      };

      // Strip undefined
      Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

      await createReminder(payload);
      navigation.goBack();
    } catch (err) {
      const serverErrors = err.response?.data?.errors;
      const msg = Array.isArray(serverErrors)
        ? serverErrors.join('\n')
        : err.response?.data?.message || 'Could not create reminder';
      setErrors((e) => ({ ...e, _server: msg }));
      console.error('Create reminder error:', err.response?.data || err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Formatted display ───────────────────────────────────────────────────────
  const dueDateLabel = dueDate
    ? `${MONTHS[dueDate.getMonth()]} ${dueDate.getDate()}, ${dueDate.getFullYear()} · ${pad(dueDate.getHours())}:${pad(dueDate.getMinutes())}`
    : null;

  const taggedCount = taggedFriends.length;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      {/* ── Nav ── */}
      <View style={s.nav}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.navClose}>
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={s.navTitle}>New Reminder</Text>
        <TouchableOpacity
          style={[s.saveBtn, saving && { opacity: 0.55 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={s.saveBtnText}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Server error banner */}
          {errors._server ? (
            <View style={s.errorBanner}>
              <Ionicons name="alert-circle-outline" size={15} color={colors.error} />
              <Text style={s.errorBannerText}>{errors._server}</Text>
            </View>
          ) : null}

          {/* ── DETAILS ── */}
          <SectionLabel text="DETAILS" />

          {/* Title */}
          <View style={s.fieldWrap}>
            <View style={s.fieldLabelRow}>
              <Text style={s.fieldLabel}>Title</Text>
              <Text style={s.required}>*</Text>
            </View>
            <FocusInput
              value={form.title}
              onChangeText={set('title')}
              placeholder="What do you need to remember?"
              hasError={!!errors.title}
            />
            {errors.title ? <Text style={s.fieldError}>{errors.title}</Text> : null}
          </View>

          {/* Description */}
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>Description</Text>
            <FocusInput
              value={form.description}
              onChangeText={set('description')}
              placeholder="Add more context…"
              multiline
              numberOfLines={3}
            />
          </View>

          {/* ── SCHEDULE ── */}
          <SectionLabel text="SCHEDULE" />

          {/* Date picker trigger */}
          <View style={s.fieldWrap}>
            <View style={s.fieldLabelRow}>
              <Text style={s.fieldLabel}>Due Date & Time</Text>
              <Text style={s.required}>*</Text>
            </View>
            <TouchableOpacity
              style={[s.dateTrigger, errors.due_date && s.dateTriggerError]}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.75}
            >
              <Ionicons
                name="calendar-outline"
                size={18}
                color={dueDate ? colors.primary : colors.textMuted}
              />
              <Text style={[s.dateTriggerText, !dueDate && s.datePlaceholder]}>
                {dueDateLabel || 'Select date & time'}
              </Text>
              <Ionicons name="chevron-down" size={15} color={colors.textMuted} />
            </TouchableOpacity>
            {errors.due_date ? <Text style={s.fieldError}>{errors.due_date}</Text> : null}
          </View>

          {/* Duration */}
          <View style={s.fieldWrap}>
            <View style={s.fieldLabelRow}>
              <Text style={s.fieldLabel}>Duration</Text>
              <Text style={s.required}>*</Text>
            </View>
            <View style={s.chipRow}>
              {DURATIONS.map((d) => {
                const on = form.duration === d.value;
                return (
                  <TouchableOpacity
                    key={d.value}
                    style={[s.chip, on && s.chipOn]}
                    onPress={() => { set('duration')(d.value); setErrors((e) => ({ ...e, duration: undefined })); }}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.chipText, on && s.chipTextOn]}>{d.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {errors.duration ? <Text style={s.fieldError}>{errors.duration}</Text> : null}
          </View>

          {/* ── PRIORITY ── */}
          <SectionLabel text="PRIORITY" />
          <View style={[s.fieldWrap, { marginBottom: spacing.lg }]}>
            <View style={s.priorityRow}>
              {PRIORITIES.map((p) => {
                const on = form.priority === p.value;
                return (
                  <TouchableOpacity
                    key={p.value}
                    style={[s.priorityBtn, on && { backgroundColor: p.bg, borderColor: p.color }]}
                    onPress={() => set('priority')(p.value)}
                    activeOpacity={0.8}
                  >
                    <View style={[s.priorityDot, { backgroundColor: on ? p.color : colors.textMuted + '60' }]} />
                    <Text style={[s.priorityLabel, on && { color: p.color }]}>{p.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── TAG FRIENDS ── */}
          <SectionLabel text="TAG PEOPLE" />
          <View style={s.fieldWrap}>
            <TouchableOpacity style={s.tagTrigger} onPress={() => setShowTagModal(true)} activeOpacity={0.75}>
              <View style={s.tagTriggerLeft}>
                <Ionicons name="people-outline" size={18} color={taggedCount > 0 ? colors.primary : colors.textMuted} />
                {taggedCount > 0 ? (
                  <View style={s.tagPills}>
                    {taggedFriends.slice(0, 3).map((id) => (
                      <View key={id} style={s.tagPill}>
                        <Text style={s.tagPillText}>{(friendNames[id] || 'Friend').charAt(0)}</Text>
                      </View>
                    ))}
                    {taggedCount > 3 && (
                      <View style={[s.tagPill, s.tagPillMore]}>
                        <Text style={s.tagPillText}>+{taggedCount - 3}</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <Text style={s.tagPlaceholder}>Tag friends to this reminder</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
            </TouchableOpacity>
            {taggedCount > 0 && (
              <Text style={s.tagCountHint}>{taggedCount} friend{taggedCount > 1 ? 's' : ''} tagged — they'll be invited</Text>
            )}
          </View>

          {/* ── EXTRAS ── */}
          <SectionLabel text="EXTRAS" />

          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>Location</Text>
            <FocusInput
              value={form.location}
              onChangeText={set('location')}
              placeholder="Add a place"
              autoCapitalize="words"
            />
          </View>

          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>Occasion</Text>
            <FocusInput
              value={form.occasion}
              onChangeText={set('occasion')}
              placeholder="Birthday, Meeting, Anniversary…"
              autoCapitalize="words"
            />
          </View>

          {/* Special event */}
          <View style={s.toggleCard}>
            <View style={s.toggleLeft}>
              <View style={s.toggleIconWrap}>
                <Text style={{ fontSize: 18 }}>⭐</Text>
              </View>
              <View>
                <Text style={s.toggleLabel}>Special Event</Text>
                <Text style={s.toggleSub}>Highlights this reminder</Text>
              </View>
            </View>
            <Switch
              value={form.is_special_event}
              onValueChange={set('is_special_event')}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor="#fff"
            />
          </View>

          {/* ── REPEAT ── */}
          <SectionLabel text="REPEAT" />
          <View style={s.repeatGrid}>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Every</Text>
              <FocusInput
                value={form.repeat_interval}
                onChangeText={set('repeat_interval')}
                placeholder="e.g. 2"
                keyboardType="numeric"
                autoCapitalize="none"
                hasError={!!errors.repeat_interval}
              />
              {errors.repeat_interval ? <Text style={s.fieldError}>{errors.repeat_interval}</Text> : null}
            </View>
            <View style={{ flex: 1.4 }}>
              <Text style={s.fieldLabel}>Unit</Text>
              <View style={s.unitRow}>
                {['day', 'week', 'month'].map((u) => {
                  const on = form.repeat_interval_unit === u;
                  return (
                    <TouchableOpacity
                      key={u}
                      style={[s.unitBtn, on && s.unitBtnOn]}
                      onPress={() => set('repeat_interval_unit')(on ? '' : u)}
                    >
                      <Text style={[s.unitText, on && s.unitTextOn]}>
                        {u.charAt(0).toUpperCase() + u.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Modals ── */}
      <DatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onConfirm={(d) => { setDueDate(d); setShowDatePicker(false); setErrors((e) => ({ ...e, due_date: undefined })); }}
        initial={dueDate}
      />

      <TagFriendsModal
        visible={showTagModal}
        onClose={() => setShowTagModal(false)}
        selected={taggedFriends}
        onToggle={(id, name) => toggleFriend(id, name)}
      />
    </SafeAreaView>
  );
}

// ── Focused input ─────────────────────────────────────────────────────────────
function FocusInput({ value, onChangeText, placeholder, multiline, numberOfLines, keyboardType, autoCapitalize, hasError }) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      style={[
        inp.base,
        focused  && inp.focused,
        hasError && inp.errored,
        multiline && { minHeight: (numberOfLines || 3) * 22 + 20, textAlignVertical: 'top' },
      ]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      multiline={multiline}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize ?? 'sentences'}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}

// ── Stylesheets ───────────────────────────────────────────────────────────────
const sl = StyleSheet.create({
  text: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
});

const inp = StyleSheet.create({
  base: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    fontFamily: fonts.sans,
    fontSize: 14.5,
    color: colors.textPrimary,
  },
  focused:  { borderColor: colors.primary, backgroundColor: colors.bgInputFocused },
  errored:  { borderColor: colors.error },
});

// Date picker styles
const dp = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center', marginBottom: spacing.md,
  },
  sheetTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    letterSpacing: -0.3,
  },
  spinners: { flexDirection: 'row', alignItems: 'center', height: 176, gap: 6 },
  spinnerWrap: { flex: 1, height: '100%' },
  spinnerLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xs,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  spinnerScroll: { flex: 1 },
  spinnerItem: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  spinnerItemActive: { backgroundColor: colors.primaryLight },
  spinnerText: { fontFamily: fonts.sans, fontSize: 15, color: colors.textSecondary },
  spinnerTextActive: { fontFamily: fonts.sansMedium, fontSize: 16, color: colors.primary },
  timeSep: { paddingTop: 28, paddingHorizontal: 2 },
  timeSepText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.textMuted },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  previewText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.primary },
  actions: { flexDirection: 'row', gap: spacing.sm },
  cancelBtn: {
    flex: 1, height: 50, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelText: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.textSecondary },
  confirmBtn: {
    flex: 2, height: 50, borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmText: { fontFamily: fonts.sansMedium, fontSize: 15, color: '#fff' },
});

// Tag friends styles
const tf = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
    maxHeight: '80%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center', marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: spacing.md,
  },
  title: { fontFamily: fonts.serifBold, fontSize: 18, color: colors.textPrimary, letterSpacing: -0.3 },
  countBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radius.full,
  },
  countText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.primary },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.bgInput, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.textPrimary, padding: 0 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: spacing.sm,
    borderRadius: radius.md, marginBottom: 4,
  },
  rowOn: { backgroundColor: colors.primaryLight },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.bgInput,
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: { fontFamily: fonts.sansMedium, fontSize: 16, color: colors.textSecondary },
  info: { flex: 1 },
  name:  { fontFamily: fonts.sansMedium, fontSize: 14.5, color: colors.textPrimary },
  email: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, marginTop: 1 },
  check: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  empty: { alignItems: 'center', padding: spacing.xl },
  emptyText: { fontFamily: fonts.sans, fontSize: 14, color: colors.textMuted },
  doneBtn: {
    marginTop: spacing.md, height: 50, borderRadius: radius.md,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  doneBtnText: { fontFamily: fonts.sansMedium, fontSize: 15, color: '#fff' },
});

const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: colors.bg },
  nav: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  navClose:  { padding: 4 },
  navTitle:  { fontFamily: fonts.serifBold, fontSize: 17, color: colors.textPrimary, letterSpacing: -0.3 },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radius.md,
    minWidth: 60, alignItems: 'center',
  },
  saveBtnText: { fontFamily: fonts.sansMedium, fontSize: 14, color: '#fff' },

  scroll: { padding: spacing.lg, paddingTop: spacing.md },

  errorBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.errorLight, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.error + '30',
  },
  errorBannerText: { fontFamily: fonts.sans, fontSize: 13, color: colors.error, flex: 1, lineHeight: 19 },

  fieldWrap:     { marginBottom: spacing.md },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 7 },
  fieldLabel:    { fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.textSecondary, marginBottom: 7 },
  required:      { color: colors.error, fontSize: 14, marginBottom: 7 },
  fieldError:    { fontFamily: fonts.sans, fontSize: 11.5, color: colors.error, marginTop: 5 },

  // Date trigger
  dateTrigger: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 14,
  },
  dateTriggerError: { borderColor: colors.error },
  dateTriggerText:  { flex: 1, fontFamily: fonts.sans, fontSize: 14.5, color: colors.textPrimary },
  datePlaceholder:  { color: colors.textMuted },

  // Duration chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: radius.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1.5, borderColor: colors.border,
  },
  chipOn:     { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText:   { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textSecondary },
  chipTextOn: { color: '#fff' },

  // Priority
  priorityRow: { flexDirection: 'row', gap: spacing.sm },
  priorityBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6, paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1.5, borderColor: colors.border,
  },
  priorityDot:   { width: 7, height: 7, borderRadius: 4 },
  priorityLabel: { fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.textSecondary },

  // Tag friends trigger
  tagTrigger: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 13,
    marginBottom: 6,
  },
  tagTriggerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tagPlaceholder: { fontFamily: fonts.sans, fontSize: 14.5, color: colors.textMuted },
  tagPills: { flexDirection: 'row', gap: 4 },
  tagPill: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  tagPillMore: { backgroundColor: colors.textMuted },
  tagPillText: { fontFamily: fonts.sansMedium, fontSize: 12, color: '#fff' },
  tagCountHint: { fontFamily: fonts.sans, fontSize: 12, color: colors.primary },

  // Toggle card
  toggleCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  toggleIconWrap: {
    width: 40, height: 40, borderRadius: radius.sm,
    backgroundColor: '#FEF3E2',
    alignItems: 'center', justifyContent: 'center',
  },
  toggleLabel: { fontFamily: fonts.sansMedium, fontSize: 14.5, color: colors.textPrimary },
  toggleSub:   { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, marginTop: 2 },

  // Repeat
  repeatGrid: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  unitRow:    { flexDirection: 'row', gap: spacing.sm },
  unitBtn: {
    flex: 1, paddingVertical: 11,
    borderRadius: radius.md, alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: 1.5, borderColor: colors.border,
  },
  unitBtnOn:  { backgroundColor: colors.primary, borderColor: colors.primary },
  unitText:   { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.textSecondary },
  unitTextOn: { color: '#fff' },
});