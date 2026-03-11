// src/screens/profile/ProfileScreen.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Animated, ActivityIndicator, Alert,
  StatusBar, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import useAuthStore from '../../store/authStore';
import { colors, fonts, spacing, radius, shadows } from '../../theme';
import { updateProfile, getProfile } from '../../api/social';
import { getReminders } from '../../api/reminders';
import { getAcceptedFriends } from '../../api/social';

// ── Avatar ────────────────────────────────────────────────────────────────────
function BigAvatar({ name, size = 88 }) {
  const initials = name?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const hue = name
    ? (name.charCodeAt(0) * 53 + (name.charCodeAt(name.length - 1) || 0) * 17) % 360
    : 140;
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: `hsl(${hue},35%,82%)`,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 3, borderColor: colors.bg,
    }}>
      <Text style={{ fontFamily: fonts.serifBold, fontSize: size * 0.36, color: `hsl(${hue},42%,34%)` }}>
        {initials}
      </Text>
    </View>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, value, label, color }) {
  return (
    <View style={sc.card}>
      <View style={[sc.iconWrap, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={sc.value}>{value ?? '—'}</Text>
      <Text style={sc.label}>{label}</Text>
    </View>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <View style={sec.wrap}>
      <Text style={sec.title}>{title}</Text>
      <View style={sec.card}>{children}</View>
    </View>
  );
}

// ── Menu row ──────────────────────────────────────────────────────────────────
function MenuRow({ icon, label, value, onPress, color, isLast, rightElement, danger }) {
  return (
    <TouchableOpacity
      style={[mr.row, !isLast && mr.rowBorder]}
      onPress={onPress}
      activeOpacity={onPress ? 0.65 : 1}
      disabled={!onPress && !rightElement}
    >
      <View style={[mr.iconWrap, { backgroundColor: (color || colors.textSecondary) + '15' }]}>
        <Ionicons name={icon} size={17} color={color || colors.textSecondary} />
      </View>
      <Text style={[mr.label, danger && { color: colors.error }]}>{label}</Text>
      <View style={mr.right}>
        {rightElement ? rightElement : (
          <>
            {value !== undefined && <Text style={mr.value}>{value}</Text>}
            {onPress && <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Edit field ────────────────────────────────────────────────────────────────
function EditField({ label, value, onChangeText, multiline, placeholder, icon }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={ef.wrap}>
      <Text style={ef.label}>{label}</Text>
      <View style={[ef.inputWrap, focused && ef.inputFocused]}>
        {icon && <Ionicons name={icon} size={16} color={focused ? colors.primary : colors.textMuted} style={{ marginLeft: 12 }} />}
        <TextInput
          style={[ef.input, multiline && { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder || label}
          placeholderTextColor={colors.textMuted}
          multiline={multiline}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const insets      = useSafeAreaInsets();
  const user        = useAuthStore((s) => s.user);
  const updateUser  = useAuthStore((s) => s.updateUser);
  const doLogout    = useAuthStore((s) => s.logout);

  const [editing,     setEditing]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [stats,       setStats]       = useState({ reminders: null, friends: null, completed: null });
  const [notifEnabled,setNotifEnabled]= useState(true);
  const [form,        setForm]        = useState({
    name:  user?.name  || '',
    email: user?.email || '',
    bio:   user?.bio   || user?.description || '',
    phone: user?.phone || '',
  });

  // Animate edit panel
  const editAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    Animated.spring(editAnim, {
      toValue: editing ? 1 : 0,
      useNativeDriver: false,
      speed: 20,
      bounciness: 4,
    }).start();
  }, [editing]);

  const loadStats = async () => {
    try {
      const [remData, friendsData] = await Promise.all([
        getReminders().catch(() => []),
        getAcceptedFriends().catch(() => []),
      ]);
      const reminders  = Array.isArray(remData)    ? remData    : (remData?.reminders    || remData?.data    || []);
      const friends    = Array.isArray(friendsData) ? friendsData : (friendsData?.friends || friendsData?.data || []);
      const completed  = reminders.filter((r) => r.completed || r.status === 'completed').length;
      setStats({ reminders: reminders.length, friends: friends.length, completed });
    } catch (e) {
      console.error('Stats error:', e);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const updated = await updateProfile(user.id, {
        name:  form.name.trim(),
        bio:   form.bio.trim(),
        phone: form.phone.trim(),
      });
      updateUser({ name: form.name.trim(), bio: form.bio.trim(), phone: form.phone.trim() });
      setEditing(false);
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.errors?.join(', ') || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: doLogout },
      ]
    );
  };

  const displayName = form.name || user?.name || user?.email?.split('@')[0] || 'You';
  const joinDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity
          style={[styles.editBtn, editing && styles.editBtnActive]}
          onPress={() => editing ? handleSave() : setEditing(true)}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={editing ? '#fff' : colors.primary} />
          ) : (
            <>
              <Ionicons
                name={editing ? 'checkmark' : 'pencil-outline'}
                size={15}
                color={editing ? '#fff' : colors.primary}
              />
              <Text style={[styles.editBtnTxt, editing && styles.editBtnTxtActive]}>
                {editing ? 'Save' : 'Edit'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
      >
        {/* ── Hero / Avatar ── */}
        <View style={styles.hero}>
          <View style={styles.heroBg} />
          <BigAvatar name={displayName} size={88} />
          <Text style={styles.heroName}>{displayName}</Text>
          <Text style={styles.heroEmail}>{user?.email || ''}</Text>
          {(user?.bio || form.bio) && !editing && (
            <Text style={styles.heroBio}>{form.bio || user?.bio}</Text>
          )}
          {joinDate && (
            <View style={styles.joinRow}>
              <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
              <Text style={styles.joinTxt}>Joined {joinDate}</Text>
            </View>
          )}
        </View>

        {/* ── Stats ── */}
        <View style={styles.statsRow}>
          <StatCard icon="alarm-outline"         value={stats.reminders} label="Reminders" color={colors.primary} />
          <StatCard icon="checkmark-circle-outline" value={stats.completed} label="Completed"  color="#6B9E78" />
          <StatCard icon="people-outline"         value={stats.friends}   label="Friends"    color="#5B8DEF" />
        </View>

        {/* ── Edit form ── */}
        {editing && (
          <Animated.View style={[styles.editSection, {
            opacity: editAnim,
            transform: [{ translateY: editAnim.interpolate({ inputRange: [0,1], outputRange: [20,0] }) }],
          }]}>
            <Text style={styles.sectionTitle}>Edit Profile</Text>
            <View style={styles.editCard}>
              <EditField
                label="Name"
                icon="person-outline"
                value={form.name}
                onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
                placeholder="Your full name"
              />
              <EditField
                label="Phone"
                icon="call-outline"
                value={form.phone}
                onChangeText={(t) => setForm((f) => ({ ...f, phone: t }))}
                placeholder="+1 234 567 8900"
              />
              <EditField
                label="Bio"
                icon="chatbubble-ellipses-outline"
                value={form.bio}
                onChangeText={(t) => setForm((f) => ({ ...f, bio: t }))}
                placeholder="Tell people a bit about yourself…"
                multiline
              />
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
                <Text style={styles.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* ── Account ── */}
        <Section title="Account">
          <MenuRow icon="person-outline"    label="Name"          value={displayName}       color={colors.primary} isLast={false} />
          <MenuRow icon="mail-outline"      label="Email"         value={user?.email || '—'} color="#5B8DEF" isLast={false} />
          <MenuRow icon="call-outline"      label="Phone"         value={form.phone || '—'} color="#6B9E78" isLast={false} />
          <MenuRow icon="lock-closed-outline" label="Password"    value="••••••••"           color={colors.warning} onPress={() => Alert.alert('Change Password', 'Password change coming soon.')} isLast />
        </Section>

        {/* ── Preferences ── */}
        <Section title="Preferences">
          <MenuRow
            icon="notifications-outline"
            label="Push Notifications"
            color="#E09F3E"
            isLast={false}
            rightElement={
              <Switch
                value={notifEnabled}
                onValueChange={setNotifEnabled}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={notifEnabled ? colors.primary : colors.textMuted}
              />
            }
          />
          <MenuRow icon="moon-outline"    label="Dark Mode"    color="#9B6FE6" isLast={false}
            rightElement={<Text style={styles.comingSoon}>Soon</Text>}
          />
          <MenuRow icon="language-outline" label="Language"    color="#5B8DEF" value="English" isLast />
        </Section>

        {/* ── Support ── */}
        <Section title="Support">
          <MenuRow icon="help-circle-outline" label="Help & FAQ"      color={colors.primary} onPress={() => {}} isLast={false} />
          <MenuRow icon="shield-checkmark-outline" label="Privacy Policy" color="#6B9E78"    onPress={() => {}} isLast={false} />
          <MenuRow icon="document-text-outline"    label="Terms of Use"  color={colors.textSecondary} onPress={() => {}} isLast />
        </Section>

        {/* ── Danger zone ── */}
        <Section title="Account Actions">
          <MenuRow
            icon="log-out-outline"
            label="Sign Out"
            color={colors.error}
            danger
            onPress={handleLogout}
            isLast
          />
        </Section>

        <Text style={styles.version}>Timo v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

// ── Stat card styles ──────────────────────────────────────────────────────────
const sc = StyleSheet.create({
  card:     { flex: 1, alignItems: 'center', gap: 4, padding: spacing.sm },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  value:    { fontFamily: fonts.serifBold, fontSize: 22, color: colors.textPrimary, letterSpacing: -0.5 },
  label:    { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, textAlign: 'center' },
});

// ── Section styles ────────────────────────────────────────────────────────────
const sec = StyleSheet.create({
  wrap:  { paddingHorizontal: spacing.md, marginBottom: spacing.md },
  title: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: spacing.sm, paddingLeft: 2 },
  card:  { backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
});

// ── Menu row styles ───────────────────────────────────────────────────────────
const mr = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 14, gap: spacing.sm },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  iconWrap:  { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  label:     { flex: 1, fontFamily: fonts.sans, fontSize: 15, color: colors.textPrimary },
  right:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  value:     { fontFamily: fonts.sans, fontSize: 14, color: colors.textMuted },
});

// ── Edit field styles ─────────────────────────────────────────────────────────
const ef = StyleSheet.create({
  wrap:         { marginBottom: spacing.sm },
  label:        { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.textMuted, letterSpacing: 0.3, marginBottom: 6, paddingLeft: 2 },
  inputWrap:    { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgInput, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  inputFocused: { borderColor: colors.primary, backgroundColor: colors.bgCard },
  input:        { flex: 1, fontFamily: fonts.sans, fontSize: 15, color: colors.textPrimary, paddingHorizontal: 12, paddingVertical: 12 },
});

// ── Main styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  headerTitle: { fontFamily: fonts.serif, fontSize: 28, color: colors.textPrimary, letterSpacing: -0.3 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    borderWidth: 1, borderColor: colors.primary + '40',
  },
  editBtnActive:   { backgroundColor: colors.primary },
  editBtnTxt:      { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.primary },
  editBtnTxtActive:{ color: '#fff' },

  scroll: { paddingTop: 0 },

  hero: { alignItems: 'center', paddingBottom: spacing.lg, paddingHorizontal: spacing.md },
  heroBg: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 80,
    backgroundColor: colors.primaryLight, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl,
  },
  heroName:  { fontFamily: fonts.serifBold, fontSize: 24, color: colors.textPrimary, marginTop: spacing.sm, letterSpacing: -0.3 },
  heroEmail: { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted, marginTop: 2 },
  heroBio:   { fontFamily: fonts.sans, fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20, paddingHorizontal: spacing.lg },
  joinRow:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  joinTxt:   { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted },

  statsRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.md, marginBottom: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    paddingVertical: spacing.md,
  },

  sectionTitle: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: spacing.sm, paddingLeft: 2 },
  editSection: { paddingHorizontal: spacing.md, marginBottom: spacing.md },
  editCard: { backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  cancelBtn: { marginTop: spacing.sm, alignItems: 'center', padding: spacing.sm },
  cancelTxt: { fontFamily: fonts.sans, fontSize: 14, color: colors.textMuted },

  comingSoon: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, backgroundColor: colors.bgInput, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  version:    { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, textAlign: 'center', paddingTop: spacing.md },
});