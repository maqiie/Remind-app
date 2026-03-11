// src/screens/organizations/CreateOrganizationScreen.jsx
import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, StatusBar, ActivityIndicator, KeyboardAvoidingView,
  Platform, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, spacing, radius } from '../../theme';
import { createOrganization } from '../../api/social';

const CATEGORIES = ['Business', 'Education', 'Non-profit', 'Sports', 'Community', 'Other'];

export default function CreateOrganizationScreen({ navigation }) {
  const insets   = useSafeAreaInsets();
  const saveScale = useRef(new Animated.Value(1)).current;

  const [form, setForm] = useState({
    name:        '',
    description: '',
    category:    '',
    website:     '',
  });
  const [errors,  setErrors]  = useState({});
  const [saving,  setSaving]  = useState(false);

  const set = (key) => (val) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    Animated.sequence([
      Animated.timing(saveScale, { toValue: 0.93, duration: 80, useNativeDriver: true }),
      Animated.spring(saveScale,  { toValue: 1,    speed: 30, bounciness: 10, useNativeDriver: true }),
    ]).start();
    setSaving(true);
    try {
      const payload = {
        name:        form.name.trim(),
        description: form.description.trim() || undefined,
        category:    form.category || undefined,
        website:     form.website.trim() || undefined,
      };
      Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
      await createOrganization(payload);
      navigation.goBack();
    } catch (err) {
      const msg = err?.response?.data?.errors?.join('\n') || err?.response?.data?.message || 'Could not create organization';
      setErrors((e) => ({ ...e, _server: msg }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      <View style={s.nav}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.navClose} hitSlop={10}>
          <Ionicons name="chevron-down" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={s.navTitle}>New Organization</Text>
        <Animated.View style={{ transform: [{ scale: saveScale }] }}>
          <TouchableOpacity style={[s.saveBtn, saving && s.saveBtnDis]} onPress={handleSave} disabled={saving}>
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={s.saveBtnTxt}>Create</Text>
            }
          </TouchableOpacity>
        </Animated.View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {!!errors._server && (
            <View style={s.errorBanner}>
              <Ionicons name="alert-circle-outline" size={15} color={colors.error} />
              <Text style={s.errorBannerTxt}>{errors._server}</Text>
            </View>
          )}

          {/* Name + desc card */}
          <View style={s.card}>
            <TextInput
              style={s.nameInput}
              value={form.name}
              onChangeText={set('name')}
              placeholder="Organization name"
              placeholderTextColor={colors.textMuted}
              autoFocus
              maxLength={80}
            />
            {!!errors.name && <Text style={s.fieldError}>{errors.name}</Text>}
            <View style={s.cardDivider} />
            <TextInput
              style={s.descInput}
              value={form.description}
              onChangeText={set('description')}
              placeholder="What is this organization about? (optional)"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={400}
            />
          </View>

          {/* Category */}
          <Text style={s.sectionLabel}>CATEGORY</Text>
          <View style={s.chipGrid}>
            {CATEGORIES.map((cat) => {
              const on = form.category === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[s.chip, on && s.chipOn]}
                  onPress={() => set('category')(on ? '' : cat)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.chipTxt, on && s.chipTxtOn]}>{cat}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Website */}
          <Text style={s.sectionLabel}>WEBSITE</Text>
          <View style={s.rowCard}>
            <View style={s.rowIcon}>
              <Ionicons name="globe-outline" size={17} color="#5B8DEF" />
            </View>
            <TextInput
              style={s.rowInput}
              value={form.website}
              onChangeText={set('website')}
              placeholder="https://example.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  screen:     { flex: 1, backgroundColor: colors.bg },
  nav:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  navClose:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  navTitle:   { fontFamily: fonts.serifBold, fontSize: 17, color: colors.textPrimary, letterSpacing: -0.3 },
  saveBtn:    { backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.full, minWidth: 72, alignItems: 'center' },
  saveBtnDis: { opacity: 0.55 },
  saveBtnTxt: { fontFamily: fonts.sansMedium, fontSize: 14, color: '#fff' },
  scroll:     { padding: spacing.md },
  errorBanner:{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: colors.errorLight, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.error + '30' },
  errorBannerTxt:{ fontFamily: fonts.sans, fontSize: 13, color: colors.error, flex: 1 },
  fieldError: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.error, marginTop: 4, paddingHorizontal: spacing.md },

  card:        { backgroundColor: colors.bgCard, borderRadius: 18, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, overflow: 'hidden' },
  nameInput:   { fontFamily: fonts.sansMedium, fontSize: 18, color: colors.textPrimary, padding: spacing.md, paddingBottom: 12 },
  cardDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginHorizontal: spacing.md },
  descInput:   { fontFamily: fonts.sans, fontSize: 14, color: colors.textPrimary, padding: spacing.md, minHeight: 80, textAlignVertical: 'top' },

  sectionLabel:{ fontFamily: fonts.sansMedium, fontSize: 10.5, color: colors.textMuted, letterSpacing: 0.9, textTransform: 'uppercase', marginBottom: 10, marginTop: 4 },
  chipGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  chip:        { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgInput },
  chipOn:      { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
  chipTxt:     { fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary },
  chipTxtOn:   { fontFamily: fonts.sansMedium, color: '#fff' },

  rowCard:     { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 13, gap: 10 },
  rowIcon:     { width: 34, height: 34, borderRadius: 10, backgroundColor: '#EBF1FD', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowInput:    { flex: 1, fontFamily: fonts.sans, fontSize: 15, color: colors.textPrimary, padding: 0 },
});