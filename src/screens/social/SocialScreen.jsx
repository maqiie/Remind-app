// src/screens/social/SocialScreen.jsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, StatusBar, Animated, RefreshControl, ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import useAuthStore from '../../store/authStore';
import { colors, fonts, spacing, radius } from '../../theme';
import {
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  getReceivedRequests,
  getAcceptedFriends,
} from '../../api/social';

const TABS = ['Friends', 'Requests', 'Find'];

// ── Avatar ────────────────────────────────────────────────────────────────────
function UserAvatar({ name, size = 46, online = false }) {
  const initials = name ? name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() : '?';
  const hue = name ? name.charCodeAt(0) * 37 % 360 : 200;
  return (
    <View style={{ position: 'relative' }}>
      <View style={[av.wrap, { width: size, height: size, borderRadius: size / 2, backgroundColor: `hsl(${hue},40%,88%)` }]}>
        <Text style={[av.text, { color: `hsl(${hue},45%,38%)`, fontSize: size * 0.36 }]}>{initials}</Text>
      </View>
      {online && <View style={av.online} />}
    </View>
  );
}

// ── Friend row ────────────────────────────────────────────────────────────────
function FriendRow({ item, onChat, index }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, delay: index * 40, useNativeDriver: false, speed: 16 }).start();
  }, []);

  // item may be a user directly or wrapped in { friend: {...} }
  const user = item.friend || item.user || item;

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateX: anim.interpolate({ inputRange:[0,1], outputRange:[-20,0] }) }] }}>
      <View style={fr.row}>
        <UserAvatar name={user.name} />
        <View style={fr.info}>
          <Text style={fr.name}>{user.name}</Text>
          <Text style={fr.sub} numberOfLines={1}>{user.email}</Text>
        </View>
        <TouchableOpacity style={fr.chatBtn} onPress={() => onChat(user)} activeOpacity={0.8}>
          <Ionicons name="chatbubble-outline" size={16} color={colors.primary} />
          <Text style={fr.chatTxt}>Chat</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ── Request row ───────────────────────────────────────────────────────────────
function RequestRow({ item, onAccept, onDecline, index }) {
  const anim   = useRef(new Animated.Value(0)).current;
  const [acting, setActing] = useState(false);

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, delay: index * 40, useNativeDriver: false, speed: 16 }).start();
  }, []);

  const handle = async (fn) => {
    setActing(true);
    try { await fn(); } catch (e) { console.error(e); } finally { setActing(false); }
  };

  // Sender info may be nested
  const sender = item.sender || item.requester || item.user || item;

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateX: anim.interpolate({ inputRange:[0,1], outputRange:[-20,0] }) }] }}>
      <View style={rr.row}>
        <UserAvatar name={sender.name} />
        <View style={rr.info}>
          <Text style={rr.name}>{sender.name}</Text>
          <Text style={rr.sub}>Wants to be friends</Text>
        </View>
        {acting ? <ActivityIndicator color={colors.primary} /> : (
          <View style={rr.btns}>
            <TouchableOpacity style={rr.accept} onPress={() => handle(onAccept)}>
              <Ionicons name="checkmark" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={rr.decline} onPress={() => handle(onDecline)}>
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

// ── Search result row ─────────────────────────────────────────────────────────
function SearchRow({ item, index }) {
  const [status,       setStatus]       = useState(item.friendship_status || 'none');
  const [showRelPicker, setShowRelPicker] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, delay: index * 40, useNativeDriver: false, speed: 16 }).start();
  }, []);

  const RELATIONSHIPS = ['friend', 'family', 'coworker'];

  const handleAdd = async (relationship = 'friend') => {
    setStatus('pending');
    setShowRelPicker(false);
    try {
      await sendFriendRequest(item.id, relationship);
    } catch {
      setStatus('none');
    }
  };

  const statusCfg = {
    none:    { label: 'Add',     bg: colors.primary,      color: '#fff',           icon: 'person-add-outline'       },
    pending: { label: 'Pending', bg: colors.bgInput,      color: colors.textMuted, icon: 'time-outline'             },
    friends: { label: 'Friends', bg: colors.primaryLight, color: colors.primary,   icon: 'checkmark-circle-outline' },
  }[status] || { label: 'Add', bg: colors.primary, color: '#fff', icon: 'person-add-outline' };

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateX: anim.interpolate({ inputRange:[0,1], outputRange:[-20,0] }) }] }}>
      <View style={sr.wrap}>
        <View style={sr.row}>
          <UserAvatar name={item.name} />
          <View style={sr.info}>
            <Text style={sr.name}>{item.name}</Text>
            <Text style={sr.sub}>{item.email}</Text>
          </View>
          <TouchableOpacity
            style={[sr.addBtn, { backgroundColor: statusCfg.bg }]}
            onPress={status === 'none' ? () => setShowRelPicker((v) => !v) : undefined}
            disabled={status !== 'none'}
            activeOpacity={0.8}
          >
            <Ionicons name={statusCfg.icon} size={14} color={statusCfg.color} />
            <Text style={[sr.addTxt, { color: statusCfg.color }]}>{statusCfg.label}</Text>
          </TouchableOpacity>
        </View>
        {showRelPicker && (
          <View style={sr.picker}>
            <Text style={sr.pickerLabel}>Add as...</Text>
            <View style={sr.pickerRow}>
              {RELATIONSHIPS.map((r) => (
                <TouchableOpacity key={r} style={sr.relBtn} onPress={() => handleAdd(r)} activeOpacity={0.8}>
                  <Text style={sr.relTxt}>{r.charAt(0).toUpperCase() + r.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ tab }) {
  const cfg = {
    Friends:  { icon: '👥', title: 'No friends yet',      sub: 'Search for people to add'   },
    Requests: { icon: '📬', title: 'No pending requests', sub: "You're all caught up!"       },
    Find:     { icon: '🔍', title: 'Search for people',   sub: 'Type a name or email above'  },
  }[tab];
  return (
    <View style={es.wrap}>
      <Text style={es.icon}>{cfg.icon}</Text>
      <Text style={es.title}>{cfg.title}</Text>
      <Text style={es.sub}>{cfg.sub}</Text>
    </View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SocialScreen({ navigation }) {
  const [tab,        setTab]        = useState('Friends');
  const [friends,    setFriends]    = useState([]);
  const [requests,   setRequests]   = useState([]);
  const [results,    setResults]    = useState([]);
  const [search,     setSearch]     = useState('');
  const [loading,    setLoading]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reqCount,   setReqCount]   = useState(0);
  const [error,      setError]      = useState(null);

  const tabAnim    = useRef(new Animated.Value(0)).current;
  const searchRef  = useRef(null);
  const searchTimer = useRef(null);

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    Animated.spring(tabAnim, { toValue: TABS.indexOf(tab), useNativeDriver: false, speed: 20, bounciness: 6 }).start();
  }, [tab]);

  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (tab === 'Find' && search.length >= 2) {
      searchTimer.current = setTimeout(() => runSearch(search), 400);
    } else if (search.length < 2) {
      setResults([]);
    }
    return () => clearTimeout(searchTimer.current);
  }, [search, tab]);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [friendsData, requestsData] = await Promise.all([
        getAcceptedFriends().catch(() => []),
        getReceivedRequests().catch(() => []),
      ]);
      const friendsList  = Array.isArray(friendsData)  ? friendsData  : (friendsData?.friends  || friendsData?.data || []);
      // Filter to only pending requests — Rails returns all received including accepted
      const allRequests  = Array.isArray(requestsData) ? requestsData : (requestsData?.friend_requests || requestsData?.data || []);
      const requestsList = allRequests.filter((r) => !r.status || r.status === 'pending');
      setFriends(friendsList);
      setRequests(requestsList);
      setReqCount(requestsList.length);
    } catch (e) {
      console.error('Social load error:', e);
      setError('Could not load social data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => { setRefreshing(true); await loadAll(); setRefreshing(false); };

  const runSearch = async (q) => {
    setLoading(true);
    try {
      const data = await searchUsers(q);
      setResults(Array.isArray(data) ? data : (data?.users || data?.data || []));
    } catch (e) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (req) => {
    try {
      await acceptFriendRequest(req.id);
    } catch (e) {
      console.error('Accept error:', e);
    }
    setRequests((prev) => prev.filter((r) => r.id !== req.id));
    setReqCount((n) => Math.max(0, n - 1));
    await loadAll();
  };

  const handleDecline = async (req) => {
    try {
      await declineFriendRequest(req.id);
    } catch (e) {
      console.error('Decline error:', e);
    }
    setRequests((prev) => prev.filter((r) => r.id !== req.id));
    setReqCount((n) => Math.max(0, n - 1));
  };

  const handleChat = (friend) => {
    navigation.navigate('Chat', {
      conversationId: null, // will be created on ChatScreen open
      name: friend.name,
      userId: friend.id,
    });
  };

  const tabIndicatorLeft = tabAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: ['2%', '35%', '68%'],
  });

  const listData = tab === 'Friends' ? friends : tab === 'Requests' ? requests : results;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Social</Text>
          <Text style={styles.sub}>{friends.length} friends</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={() => { setTab('Find'); setTimeout(() => searchRef.current?.focus(), 200); }}>
          <Ionicons name="person-add-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {error ? (
        <TouchableOpacity style={styles.errorBanner} onPress={loadAll}>
          <Ionicons name="alert-circle-outline" size={16} color="#FF6B6B" />
          <Text style={styles.errorText}>{error} · Tap to retry</Text>
        </TouchableOpacity>
      ) : null}

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <Animated.View style={[styles.tabIndicator, { left: tabIndicatorLeft }]} />
        {TABS.map((t) => (
          <TouchableOpacity key={t} style={styles.tabItem} onPress={() => setTab(t)} activeOpacity={0.7}>
            <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>{t}</Text>
            {t === 'Requests' && reqCount > 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>{reqCount}</Text></View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Search (Find tab) */}
      {tab === 'Find' && (
        <View style={styles.searchWrap}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={16} color={colors.textMuted} />
            <TextInput
              ref={searchRef}
              style={styles.searchInput}
              placeholder="Search by name or email..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
            {search ? (
              <TouchableOpacity onPress={() => { setSearch(''); setResults([]); }}>
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      )}

      {/* List */}
      {loading && listData.length === 0 ? (
        <View style={styles.loadingWrap}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.list, listData.length === 0 && styles.listEmpty]}
          showsVerticalScrollIndicator={false}
          refreshControl={tab !== 'Find' ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
          ListEmptyComponent={<EmptyState tab={tab} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item, index }) => {
            if (tab === 'Friends')  return <FriendRow  item={item} index={index} onChat={handleChat} />;
            if (tab === 'Requests') return <RequestRow item={item} index={index} onAccept={() => handleAccept(item)} onDecline={() => handleDecline(item)} />;
            return <SearchRow item={item} index={index} />;
          }}
        />
      )}
    </View>
  );
}

const av = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: fonts.serifBold },
  online: { position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: 6, backgroundColor: '#6BC99E', borderWidth: 2, borderColor: colors.bg },
});
const fr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md },
  info: { flex: 1 },
  name: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.textPrimary },
  sub:  { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  chatBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.primaryLight },
  chatTxt: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.primary },
});
const rr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md },
  info: { flex: 1 },
  name: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.textPrimary },
  sub:  { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  btns: { flexDirection: 'row', gap: spacing.sm },
  accept: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  decline: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
});
const sr = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.md },
  info: { flex: 1 },
  name: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.textPrimary },
  sub:  { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.full },
  addTxt: { fontFamily: fonts.sansMedium, fontSize: 12 },
  picker: { backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  pickerLabel: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  pickerRow: { flexDirection: 'row', gap: spacing.sm },
  relBtn: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.primaryLight, borderWidth: 1.5, borderColor: colors.primary },
  relTxt: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.primary },
});
const es = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: spacing.sm },
  icon: { fontSize: 48, marginBottom: spacing.sm },
  title: { fontFamily: fonts.serif, fontSize: 20, color: colors.textPrimary, letterSpacing: -0.3 },
  sub: { fontFamily: fonts.sans, fontSize: 14, color: colors.textMuted },
});
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: spacing.lg, paddingTop: spacing.xl + spacing.sm, paddingBottom: spacing.md },
  title: { fontFamily: fonts.serifBold, fontSize: 28, color: colors.textPrimary, letterSpacing: -0.5 },
  sub:   { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted, marginTop: 2 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primaryLight, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: '#FFF0F0', borderRadius: radius.md, padding: spacing.md, marginHorizontal: spacing.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: '#FFCDD2' },
  errorText: { fontFamily: fonts.sans, fontSize: 13, color: '#FF6B6B', flex: 1 },
  tabBar: { flexDirection: 'row', marginHorizontal: spacing.lg, marginBottom: spacing.md, backgroundColor: colors.bgCard, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 4, position: 'relative', height: 44 },
  tabIndicator: { position: 'absolute', top: 4, bottom: 4, width: '31%', backgroundColor: colors.textPrimary, borderRadius: radius.lg },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5, zIndex: 1 },
  tabLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textMuted },
  tabLabelActive: { color: '#fff' },
  badge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#FF6B6B', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { fontFamily: fonts.sansMedium, fontSize: 10, color: '#fff' },
  searchWrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  searchInput: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.textPrimary, padding: 0 },
  list: { paddingBottom: 120 },
  listEmpty: { flex: 1 },
  separator: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});