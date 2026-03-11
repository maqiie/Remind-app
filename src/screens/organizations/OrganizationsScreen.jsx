// src/screens/organizations/OrganizationsScreen.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, ActivityIndicator, RefreshControl, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, spacing, radius } from '../../theme';
import { getOrganizations } from '../../api/social';

function OrgCard({ item, onPress, index }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 280, delay: index * 50, useNativeDriver: true }).start();
  }, []);

  const name        = item.name || 'Organization';
  const description = item.description || '';
  const memberCount = item.memberships_count ?? item.members_count ?? 0;
  const hue         = name ? (name.charCodeAt(0) * 67) % 360 : 200;

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0,1], outputRange: [12,0] }) }] }}>
      <TouchableOpacity style={oc.card} onPress={onPress} activeOpacity={0.75}>
        {/* Color band */}
        <View style={[oc.band, { backgroundColor: `hsl(${hue},40%,88%)` }]}>
          <Text style={[oc.initial, { color: `hsl(${hue},45%,35%)` }]}>
            {name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={oc.body}>
          <Text style={oc.name} numberOfLines={1}>{name}</Text>
          {!!description && <Text style={oc.desc} numberOfLines={2}>{description}</Text>}
          <View style={oc.foot}>
            <Ionicons name="people-outline" size={12} color={colors.textMuted} />
            <Text style={oc.footTxt}>{memberCount} member{memberCount !== 1 ? 's' : ''}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function OrganizationsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const fabAnim = useRef(new Animated.Value(0)).current;
  const [orgs,      setOrgs]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    Animated.spring(fabAnim, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 14 }).start();
    load();
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await getOrganizations();
      const list = Array.isArray(data) ? data : (data?.organizations || data?.data || []);
      setOrgs(list);
    } catch {
      setError('Could not load organizations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      <View style={s.header}>
        <View>
          <Text style={s.title}>Organizations</Text>
          {!loading && <Text style={s.subtitle}>{orgs.length} total</Text>}
        </View>
      </View>

      {error && (
        <TouchableOpacity style={s.errorBanner} onPress={load}>
          <Ionicons name="wifi-outline" size={13} color={colors.error} />
          <Text style={s.errorTxt}>{error} · tap to retry</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <FlatList
          data={orgs}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item, index }) => (
            <OrgCard
              item={item}
              index={index}
              onPress={() => navigation.navigate('OrgDetail', { id: item.id, org: item })}
            />
          )}
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 110 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyIcon}><Ionicons name="business-outline" size={34} color={colors.textMuted} /></View>
              <Text style={s.emptyTitle}>No organizations yet</Text>
              <Text style={s.emptySub}>Tap + to create or join one</Text>
            </View>
          }
        />
      )}

      <Animated.View style={[s.fab, { transform: [{ scale: fabAnim }], bottom: insets.bottom + 90 }]}>
        <TouchableOpacity style={s.fabBtn} onPress={() => navigation.navigate('CreateOrg')} activeOpacity={0.85}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const oc = StyleSheet.create({
  card:    { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.md, marginBottom: 10, backgroundColor: colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', paddingRight: spacing.md, paddingVertical: 14, gap: 12 },
  band:    { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginLeft: spacing.md, flexShrink: 0 },
  initial: { fontFamily: fonts.serifBold, fontSize: 22 },
  body:    { flex: 1, gap: 3 },
  name:    { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.textPrimary },
  desc:    { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  foot:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  footTxt: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted },
});

const s = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: colors.bg },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:    { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, paddingBottom: spacing.md },
  title:     { fontFamily: fonts.serifBold, fontSize: 28, color: colors.textPrimary, letterSpacing: -0.6 },
  subtitle:  { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted, marginTop: 2 },
  errorBanner:{ flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: spacing.md, marginBottom: 8, padding: spacing.sm + 2, borderRadius: radius.md, backgroundColor: colors.errorLight, borderWidth: 1, borderColor: colors.error + '30' },
  errorTxt:  { fontFamily: fonts.sans, fontSize: 12, color: colors.error },
  list:      { paddingTop: 4 },
  empty:     { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.bgInput, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle:{ fontFamily: fonts.serif, fontSize: 20, color: colors.textPrimary },
  emptySub:  { fontFamily: fonts.sans, fontSize: 14, color: colors.textMuted },
  fab:       { position: 'absolute', right: spacing.md },
  fabBtn:    { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 10 },
});