// src/screens/profile/ProfileScreen.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Animated, ActivityIndicator, Alert,
  StatusBar, Switch, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import useAuthStore from '../../store/authStore';
import useThemeStore from '../../store/themeStore';
import { useTheme } from '../../theme/tokens';
import { fonts } from '../../theme';
import { updateProfile, getAcceptedFriends } from '../../api/social';
import { getReminders } from '../../api/reminders';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function avatarHue(name) {
  if (!name) return 140;
  return (name.charCodeAt(0) * 53 + (name.charCodeAt(name.length - 1) || 0) * 17) % 360;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ name, size = 88, C }) {
  const initials = name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const hue = avatarHue(name);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: `hsla(${hue},60%,55%,0.2)`,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: `hsla(${hue},60%,65%,0.5)`,
        shadowColor: `hsl(${hue},60%,55%)`,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 8,
      }}>
        <Text style={{ fontFamily: fonts.serifBold, fontSize: size * 0.36, color: `hsl(${hue},70%,75%)` }}>
          {initials}
        </Text>
      </View>
    </Animated.View>
  );
}

function StatPill({ icon, value, label, color, C }) {
  const countAnim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value == null) return;
    countAnim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    Animated.timing(countAnim, { toValue: value, duration: 800, useNativeDriver: false }).start();
    return () => countAnim.removeAllListeners();
  }, [value]);

  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
      <View style={[pill.icon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[pill.val, { color: C.ink }]}>
        {value == null ? '—' : display}
      </Text>
      <Text style={[pill.lbl, { color: C.inkDim }]}>{label}</Text>
    </View>
  );
}
const pill = StyleSheet.create({
  icon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  val:  { fontFamily: fonts.serifBold, fontSize: 24, letterSpacing: -0.8 },
  lbl:  { fontFamily: fonts.sans, fontSize: 11 },
});

function Field({ label, icon, value, onChange, multiline, placeholder, C, editable = true }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11, color: C.inkMid, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </Text>
      <View style={[
        fld.wrap,
        { backgroundColor: C.surfaceHigh, borderColor: focused ? C.sage : C.border },
      ]}>
        <Ionicons name={icon} size={16} color={focused ? C.sage : C.inkDim} style={{ marginLeft: 14 }} />
        <TextInput
          style={[fld.input, { color: C.ink, height: multiline ? 80 : 46, textAlignVertical: multiline ? 'top' : 'center' }]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={C.inkDim}
          multiline={multiline}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          paddingTop={multiline ? 12 : 0}
        />
      </View>
    </View>
  );
}
const fld = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  input: { flex: 1, fontFamily: fonts.sans, fontSize: 15, paddingHorizontal: 12 },
});

function SettingRow({ icon, label, subtitle, color, value, onPress, rightEl, isLast, C, danger }) {
  const [pressed, setPressed] = useState(false);
  return (
    <TouchableOpacity
      style={[
        row.wrap,
        { backgroundColor: pressed ? C.surfaceHigh : 'transparent' },
        !isLast && { borderBottomWidth: 1, borderBottomColor: C.border },
      ]}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      activeOpacity={1}
      disabled={!onPress && !rightEl}
    >
      <View style={[row.icon, { backgroundColor: (color || C.inkDim) + '18' }]}>
        <Ionicons name={icon} size={17} color={color || C.inkDim} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[row.label, { color: danger ? C.rose : C.ink }]}>{label}</Text>
        {subtitle && <Text style={[row.sub, { color: C.inkDim }]}>{subtitle}</Text>}
      </View>
      <View style={row.right}>
        {rightEl ? rightEl : (
          <>
            {value !== undefined && <Text style={[row.value, { color: C.inkMid }]}>{value}</Text>}
            {onPress && <Ionicons name="chevron-forward" size={15} color={C.inkDim} />}
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}
const row = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  icon:  { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  label: { fontFamily: fonts.sansMedium, fontSize: 15 },
  sub:   { fontFamily: fonts.sans, fontSize: 12 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  value: { fontFamily: fonts.sans, fontSize: 13 },
});

function SectionCard({ title, children, C }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11, color: C.inkDim, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, paddingLeft: 4 }}>
        {title}
      </Text>
      <View style={{ backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
        {children}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ProfileScreen({ navigation }) {
  const insets     = useSafeAreaInsets();
  const user       = useAuthStore(s => s.user);
  const updateUser = useAuthStore(s => s.updateUser);
  const doLogout   = useAuthStore(s => s.logout);

  const { C, isDark } = useTheme();
  const toggleTheme   = useThemeStore(s => s.toggle);
  const [notifs,      setNotifs]      = useState(true);
  const [editing,     setEditing]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [loadingStats,setLoadingStats]= useState(true);
  const [stats,       setStats]       = useState({ reminders: null, completed: null, friends: null, streak: null });
  const [form,        setForm]        = useState({
    name:  user?.name  || '',
    email: user?.email || '',
    bio:   user?.bio || user?.description || '',
    phone: user?.phone || '',
  });

  

  // Edit panel animation
  const editH   = useRef(new Animated.Value(0)).current;
  const editOp  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(editH,  { toValue: editing ? 1 : 0, useNativeDriver: false, speed: 18, bounciness: 3 }),
      Animated.timing(editOp, { toValue: editing ? 1 : 0, duration: 220, useNativeDriver: false }),
    ]).start();
  }, [editing]);

  // ── Load stats on focus ───────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const [remData, friendData] = await Promise.allSettled([
        getReminders(),
        getAcceptedFriends(),
      ]);

      const rems = remData.status === 'fulfilled'
        ? (Array.isArray(remData.value) ? remData.value : remData.value?.reminders || remData.value?.data || [])
        : [];

      const friends = friendData.status === 'fulfilled'
        ? (Array.isArray(friendData.value) ? friendData.value : friendData.value?.friends || friendData.value?.data || [])
        : [];

      const completed = rems.filter(r => r.completed || r.status === 'completed').length;

      // Streak
      const doneSet = new Set(
        rems.filter(r => r.completed && (r.completed_at || r.updated_at))
          .map(r => { const d = new Date(r.completed_at || r.updated_at); d.setHours(0,0,0,0); return d.getTime(); })
      );
      let streak = 0;
      const cur = new Date(); cur.setHours(0,0,0,0);
      while (doneSet.has(cur.getTime())) { streak++; cur.setDate(cur.getDate() - 1); }

      setStats({ reminders: rems.length, completed, friends: friends.length, streak });
    } catch (e) {
      console.error('Profile stats error:', e);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadStats(); }, [loadStats]));

  // ── Save profile ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      await updateProfile(user.id, {
        name:  form.name.trim(),
        bio:   form.bio.trim(),
        phone: form.phone.trim(),
      });
      updateUser({ name: form.name.trim(), bio: form.bio.trim(), phone: form.phone.trim() });
      setEditing(false);
    } catch (e) {
      Alert.alert('Could not save', e?.response?.data?.errors?.join(', ') || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setForm({ name: user?.name||'', email: user?.email||'', bio: user?.bio||user?.description||'', phone: user?.phone||'' });
    setEditing(false);
  };

  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: doLogout },
    ]);
  };

  const displayName = form.name || user?.name || user?.email?.split('@')[0] || 'You';
  const joinDate    = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  const scoreColor = stats.completed && stats.reminders
    ? stats.completed / stats.reminders >= 0.7 ? C.sage
    : stats.completed / stats.reminders >= 0.4 ? C.amber : C.rose
    : C.inkMid;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={C.bg} />

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <View style={[top.bar, { paddingTop: insets.top + 8, borderBottomColor: C.border, backgroundColor: C.bg }]}>
        <Text style={[top.title, { color: C.ink }]}>Profile</Text>
        <View style={top.actions}>
          {/* Dark mode toggle in header */}
          <TouchableOpacity
            style={[top.iconBtn, { backgroundColor: C.surface, borderColor: C.border }]}
            onPress={toggleTheme}
          >
            <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={18} color={isDark ? C.amber : C.violet} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[top.editBtn, editing && { backgroundColor: C.sage, borderColor: C.sage }]}
            onPress={() => editing ? handleSave() : setEditing(true)}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator size="small" color={editing ? '#000' : C.sage} />
              : <>
                  <Ionicons name={editing ? 'checkmark' : 'pencil-outline'} size={15} color={editing ? '#000' : C.sage} />
                  <Text style={[top.editTxt, { color: editing ? '#000' : C.sage }]}>
                    {editing ? 'Save' : 'Edit'}
                  </Text>
                </>
            }
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
      >
        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <View style={[hero.wrap, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
          {/* Glow backdrop */}
          <View style={[hero.glow, { backgroundColor: `hsla(${avatarHue(displayName)},60%,55%,${isDark ? 0.08 : 0.05})` }]} />

          <Avatar name={displayName} size={90} C={C} />

          <Text style={[hero.name, { color: C.ink }]}>{displayName}</Text>
          <Text style={[hero.email, { color: C.inkMid }]}>{user?.email || ''}</Text>

          {form.bio ? (
            <Text style={[hero.bio, { color: C.inkMid }]}>{form.bio}</Text>
          ) : null}

          {joinDate && (
            <View style={hero.joinRow}>
              <Ionicons name="leaf-outline" size={12} color={C.sage} />
              <Text style={[hero.joinTxt, { color: C.sage }]}>Member since {joinDate}</Text>
            </View>
          )}
        </View>

        {/* ── Stats ─────────────────────────────────────────────────────────── */}
        <View style={[stat.wrap, { backgroundColor: C.surface, borderColor: C.border }]}>
          <StatPill icon="alarm-outline"            value={stats.reminders} label="Reminders" color={C.sky}    C={C} />
          <View style={[stat.div, { backgroundColor: C.border }]} />
          <StatPill icon="checkmark-circle-outline" value={stats.completed} label="Completed" color={C.sage}   C={C} />
          <View style={[stat.div, { backgroundColor: C.border }]} />
          <StatPill icon="people-outline"           value={stats.friends}   label="Friends"   color={C.violet} C={C} />
          <View style={[stat.div, { backgroundColor: C.border }]} />
          <StatPill icon="flame-outline"            value={stats.streak}    label="Streak"    color={C.amber}  C={C} />
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>

          {/* ── Edit form ────────────────────────────────────────────────────── */}
          <Animated.View style={{ opacity: editOp, maxHeight: editH.interpolate({ inputRange:[0,1], outputRange:[0, 600] }), overflow: 'hidden', marginBottom: editing ? 20 : 0 }}>
            <SectionCard title="Edit Profile" C={C}>
              <View style={{ padding: 16 }}>
                <Field label="Name"  icon="person-outline"             value={form.name}  onChange={t => setForm(f=>({...f,name:t}))}  placeholder="Your full name"       C={C} />
                <Field label="Phone" icon="call-outline"               value={form.phone} onChange={t => setForm(f=>({...f,phone:t}))} placeholder="+254 7XX XXX XXX"     C={C} />
                <Field label="Bio"   icon="chatbubble-ellipses-outline" value={form.bio}   onChange={t => setForm(f=>({...f,bio:t}))}   placeholder="A short bio…" multiline C={C} />
                <Field label="Email" icon="mail-outline"               value={form.email} editable={false} placeholder="Email"         C={C} />
                <TouchableOpacity
                  onPress={handleCancelEdit}
                  style={{ alignItems: 'center', paddingVertical: 12, marginTop: 4 }}
                >
                  <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: C.inkDim }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </SectionCard>
          </Animated.View>

          {/* ── Account ──────────────────────────────────────────────────────── */}
          <SectionCard title="Account" C={C}>
            <SettingRow icon="person-outline"       label="Name"     value={displayName}       color={C.sky}    C={C} isLast={false} />
            <SettingRow icon="mail-outline"         label="Email"    value={user?.email || '—'} color={C.violet} C={C} isLast={false} />
            <SettingRow icon="call-outline"         label="Phone"    value={form.phone || '—'} color={C.sage}   C={C} isLast={false} />
            <SettingRow
              icon="lock-closed-outline"
              label="Change Password"
              subtitle="Update your password"
              color={C.amber}
              C={C}
              isLast
              onPress={() => Alert.alert('Change Password', 'A reset link will be sent to your email.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Send link', onPress: () => {} },
              ])}
            />
          </SectionCard>

          {/* ── Preferences ──────────────────────────────────────────────────── */}
          <SectionCard title="Preferences" C={C}>
            <SettingRow
              icon={isDark ? 'moon' : 'sunny'}
              label="Dark Mode"
              subtitle={isDark ? 'Currently dark' : 'Currently light'}
              color={isDark ? C.violet : C.amber}
              C={C}
              isLast={false}
              rightEl={
                <Switch
                  value={isDark}
                  onValueChange={v => useThemeStore.getState().setDark(v)}
                  trackColor={{ false: C.border, true: C.violet + '80' }}
                  thumbColor={isDark ? C.violet : C.inkDim}
                />
              }
            />
            <SettingRow
              icon="notifications-outline"
              label="Push Notifications"
              subtitle={notifs ? 'Enabled' : 'Disabled'}
              color={C.amber}
              C={C}
              isLast={false}
              rightEl={
                <Switch
                  value={notifs}
                  onValueChange={setNotifs}
                  trackColor={{ false: C.border, true: C.sage + '60' }}
                  thumbColor={notifs ? C.sage : C.inkDim}
                />
              }
            />
            <SettingRow icon="language-outline" label="Language" value="English" color={C.sky}   C={C} isLast={false} />
            <SettingRow icon="time-outline"     label="Timezone" value="Auto"    color={C.inkMid} C={C} isLast />
          </SectionCard>

          {/* ── Activity ─────────────────────────────────────────────────────── */}
          <SectionCard title="Activity" C={C}>
            <SettingRow
              icon="checkmark-done-outline"
              label="Completed Tasks"
              subtitle="View all your completed reminders"
              color={C.sage}
              C={C}
              isLast={false}
              onPress={() => navigation?.navigate('RemindersTab', { screen: 'CompletedTasks' })}
            />
            <SettingRow
              icon="people-outline"
              label="Friends"
              subtitle="Manage your connections"
              color={C.sky}
              C={C}
              isLast={false}
              onPress={() => navigation?.navigate('SocialTab', { screen: 'Friends' })}
            />
            <SettingRow
              icon="mail-unread-outline"
              label="Invitations"
              subtitle="Pending task invites"
              color={C.amber}
              C={C}
              isLast
              onPress={() => navigation?.navigate('RemindersTab', { screen: 'Invitations' })}
            />
          </SectionCard>

          {/* ── Support ──────────────────────────────────────────────────────── */}
          <SectionCard title="Support" C={C}>
            <SettingRow
              icon="help-circle-outline"
              label="Help & FAQ"
              color={C.sky}
              C={C}
              isLast={false}
              onPress={() => Linking.openURL('https://remind.app/help')}
            />
            <SettingRow
              icon="shield-checkmark-outline"
              label="Privacy Policy"
              color={C.sage}
              C={C}
              isLast={false}
              onPress={() => Linking.openURL('https://remind.app/privacy')}
            />
            <SettingRow
              icon="document-text-outline"
              label="Terms of Use"
              color={C.inkMid}
              C={C}
              isLast
              onPress={() => Linking.openURL('https://remind.app/terms')}
            />
          </SectionCard>

          {/* ── Danger ───────────────────────────────────────────────────────── */}
          <SectionCard title="Account Actions" C={C}>
            <SettingRow
              icon="log-out-outline"
              label="Sign Out"
              subtitle="You'll need to log in again"
              color={C.rose}
              C={C}
              danger
              isLast
              onPress={handleLogout}
            />
          </SectionCard>

          {/* Version */}
          <View style={{ alignItems: 'center', paddingVertical: 12, gap: 4 }}>
            <View style={[ver.dot, { backgroundColor: C.sage }]} />
            <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: C.inkDim }}>
              Timo v1.0.0 · remind
            </Text>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const top = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title:   { fontFamily: fonts.serifBold, fontSize: 28, letterSpacing: -0.8 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 99, borderWidth: 1, borderColor: 'rgba(74,222,128,0.4)',
    backgroundColor: 'rgba(74,222,128,0.1)',
  },
  editTxt: { fontFamily: fonts.sansMedium, fontSize: 13 },
});

const hero = StyleSheet.create({
  wrap: {
    alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20,
    borderBottomWidth: 1, overflow: 'hidden', gap: 6,
  },
  glow: {
    position: 'absolute', top: -40, width: 200, height: 200,
    borderRadius: 100,
  },
  name:    { fontFamily: fonts.serifBold, fontSize: 26, letterSpacing: -0.8, marginTop: 12 },
  email:   { fontFamily: fonts.sans, fontSize: 13 },
  bio:     { fontFamily: fonts.sans, fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 24, marginTop: 4 },
  joinRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, backgroundColor: 'rgba(74,222,128,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  joinTxt: { fontFamily: fonts.sansMedium, fontSize: 11 },
});

const stat = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 16,
    borderRadius: 18, borderWidth: 1, padding: 16, gap: 4,
  },
  div: { width: 1, alignSelf: 'stretch', marginHorizontal: 4 },
});

const ver = StyleSheet.create({
  dot: { width: 6, height: 6, borderRadius: 3 },
});