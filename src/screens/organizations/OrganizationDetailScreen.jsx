// src/screens/organizations/OrganizationDetailScreen.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity,
  StatusBar, ActivityIndicator, RefreshControl, TextInput, Alert, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, spacing, radius } from '../../theme';
import { getOrganization, addMember, deleteOrganization } from '../../api/social';
import { searchUsers } from '../../api/social';

function MemberRow({ item }) {
  const name  = item.user?.name  || item.name  || 'Member';
  const email = item.user?.email || item.email || '';
  const role  = item.role || 'member';
  const hue   = name ? (name.charCodeAt(0) * 53) % 360 : 200;
  return (
    <View style={mr.row}>
      <View style={[mr.avatar, { backgroundColor: `hsl(${hue},35%,84%)` }]}>
        <Text style={[mr.avatarTxt, { color: `hsl(${hue},40%,34%)` }]}>
          {name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={mr.info}>
        <Text style={mr.name}>{name}</Text>
        {!!email && <Text style={mr.email} numberOfLines={1}>{email}</Text>}
      </View>
      <View style={[mr.roleBadge, role === 'admin' && mr.roleBadgeAdmin]}>
        <Text style={[mr.roleTxt, role === 'admin' && mr.roleTxtAdmin]}>{role}</Text>
      </View>
    </View>
  );
}

const mr = StyleSheet.create({
  row:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: spacing.md, gap: 12 },
  avatar:      { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarTxt:   { fontFamily: fonts.serifBold, fontSize: 16 },
  info:        { flex: 1 },
  name:        { fontFamily: fonts.sansMedium, fontSize: 14.5, color: colors.textPrimary },
  email:       { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, marginTop: 1 },
  roleBadge:   { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.full, backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border },
  roleBadgeAdmin:{ backgroundColor: colors.primaryLight, borderColor: colors.primary + '40' },
  roleTxt:     { fontFamily: fonts.sansMedium, fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  roleTxtAdmin:{ color: colors.primary },
});

export default function OrganizationDetailScreen({ route, navigation }) {
  const { id, org: initialOrg } = route.params || {};
  const insets = useSafeAreaInsets();

  const [org,        setOrg]        = useState(initialOrg || null);
  const [members,    setMembers]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQ,    setSearchQ]    = useState('');
  const [searchRes,  setSearchRes]  = useState([]);
  const [searching,  setSearching]  = useState(false);
  const [adding,     setAdding]     = useState(null);

  useEffect(() => { load(); }, [id]);

  const load = useCallback(async () => {
    try {
      const data = await getOrganization(id);
      const o    = data?.organization || data;
      setOrg(o);
      const mList = o?.memberships || o?.members || [];
      setMembers(mList);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [id]);

  const doSearch = async (q) => {
    if (!q.trim()) { setSearchRes([]); return; }
    setSearching(true);
    try {
      const data = await searchUsers(q.trim());
      setSearchRes(Array.isArray(data) ? data : (data?.users || []));
    } catch {}
    finally { setSearching(false); }
  };

  const handleAdd = async (userId) => {
    setAdding(userId);
    try {
      await addMember(id, { user_id: userId, role: 'member' });
      setShowAddModal(false);
      setSearchQ('');
      setSearchRes([]);
      load();
    } catch {
      Alert.alert('Error', 'Could not add member');
    } finally {
      setAdding(null);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Organization', `Are you sure you want to delete "${org?.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteOrganization(id);
            navigation.goBack();
          } catch {
            Alert.alert('Error', 'Could not delete organization');
          }
        },
      },
    ]);
  };

  const name        = org?.name || 'Organization';
  const description = org?.description || '';
  const hue         = name ? (name.charCodeAt(0) * 67) % 360 : 200;

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      {/* Nav */}
      <View style={s.nav}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.navTitle} numberOfLines={1}>{name}</Text>
        <TouchableOpacity onPress={handleDelete} style={s.deleteBtn} hitSlop={8}>
          <Ionicons name="trash-outline" size={18} color={colors.error} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        >
          {/* Hero */}
          <View style={s.hero}>
            <View style={[s.heroAvatar, { backgroundColor: `hsl(${hue},40%,88%)` }]}>
              <Text style={[s.heroInitial, { color: `hsl(${hue},45%,35%)` }]}>
                {name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={s.heroName}>{name}</Text>
            {!!description && <Text style={s.heroDesc}>{description}</Text>}
            <View style={s.heroMeta}>
              <Ionicons name="people-outline" size={13} color={colors.textMuted} />
              <Text style={s.heroMetaTxt}>{members.length} member{members.length !== 1 ? 's' : ''}</Text>
            </View>
          </View>

          {/* Members section */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Members</Text>
              <TouchableOpacity style={s.addMemberBtn} onPress={() => setShowAddModal(true)}>
                <Ionicons name="person-add-outline" size={15} color={colors.primary} />
                <Text style={s.addMemberTxt}>Add</Text>
              </TouchableOpacity>
            </View>
            <View style={s.membersList}>
              {members.length === 0 ? (
                <Text style={s.emptyTxt}>No members yet</Text>
              ) : (
                members.map((m) => <MemberRow key={String(m.id || m.user?.id)} item={m} />)
              )}
            </View>
          </View>
        </ScrollView>
      )}

      {/* Add member modal */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View style={am.overlay}>
          <TouchableOpacity style={am.backdrop} onPress={() => setShowAddModal(false)} activeOpacity={1} />
          <View style={[am.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={am.handle} />
            <Text style={am.title}>Add Member</Text>
            <View style={am.search}>
              <Ionicons name="search-outline" size={14} color={colors.textMuted} />
              <TextInput
                style={am.searchInput}
                value={searchQ}
                onChangeText={(q) => { setSearchQ(q); doSearch(q); }}
                placeholder="Search by name or email…"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoFocus
              />
              {searching && <ActivityIndicator size="small" color={colors.primary} />}
            </View>
            <FlatList
              data={searchRes}
              keyExtractor={(item) => String(item.id)}
              style={{ maxHeight: 280 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const alreadyIn = members.some((m) => (m.user?.id || m.id) === item.id);
                return (
                  <TouchableOpacity
                    style={am.row}
                    onPress={() => !alreadyIn && handleAdd(item.id)}
                    disabled={alreadyIn || adding === item.id}
                  >
                    <View style={am.avatar}>
                      <Text style={am.avatarTxt}>{(item.name || '?').charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={am.name}>{item.name}</Text>
                      <Text style={am.email}>{item.email}</Text>
                    </View>
                    {alreadyIn ? (
                      <Text style={am.alreadyTxt}>Added</Text>
                    ) : adding === item.id ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={searchQ.trim() && !searching ? <Text style={am.emptyTxt}>No users found</Text> : null}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const am = StyleSheet.create({
  overlay:   { flex: 1, justifyContent: 'flex-end' },
  backdrop:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:     { backgroundColor: colors.bgCard, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  handle:    { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.md },
  title:     { fontFamily: fonts.serifBold, fontSize: 20, color: colors.textPrimary, marginBottom: spacing.md, letterSpacing: -0.4 },
  search:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.bgInput, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, marginBottom: spacing.sm },
  searchInput:{ flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.textPrimary, padding: 0 },
  row:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 10 },
  avatar:    { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.bgInput, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.textSecondary },
  name:      { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.textPrimary },
  email:     { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted },
  alreadyTxt:{ fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted },
  emptyTxt:  { fontFamily: fonts.sans, fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingVertical: 20 },
});

const s = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: colors.bg },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  nav:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, gap: spacing.sm },
  backBtn:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  navTitle:  { flex: 1, fontFamily: fonts.serifBold, fontSize: 17, color: colors.textPrimary, letterSpacing: -0.3 },
  deleteBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  hero:      { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  heroAvatar:{ width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  heroInitial:{ fontFamily: fonts.serifBold, fontSize: 36 },
  heroName:  { fontFamily: fonts.serifBold, fontSize: 24, color: colors.textPrimary, letterSpacing: -0.5 },
  heroDesc:  { fontFamily: fonts.sans, fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  heroMeta:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroMetaTxt:{ fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted },
  section:   { marginTop: spacing.md },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, marginBottom: 8 },
  sectionTitle: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  addMemberBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primaryLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full },
  addMemberTxt: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.primary },
  membersList:  { backgroundColor: colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: colors.border, marginHorizontal: spacing.md, overflow: 'hidden' },
  emptyTxt:     { fontFamily: fonts.sans, fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.lg },
});