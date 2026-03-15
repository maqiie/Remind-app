// src/screens/social/FriendsScreen.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, StatusBar, ActivityIndicator, RefreshControl,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, spacing, radius } from '../../theme';
import {
  getAcceptedFriends, getReceivedRequests, getSentRequests,
  searchUsers, sendFriendRequest, acceptFriendRequest, declineFriendRequest,
} from '../../api/social';

const TABS = ['Friends', 'Requests', 'Find'];

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, size = 44, color }) {
  const hue = name ? (name.charCodeAt(0) * 53) % 360 : 180;
  const bg  = color || `hsl(${hue},35%,82%)`;
  const fg  = color ? '#fff' : `hsl(${hue},40%,32%)`;
  return (
    <View style={[av.wrap, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[av.txt, { color: fg, fontSize: size * 0.38 }]}>
        {(name || '?').charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}
const av = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  txt:  { fontFamily: fonts.serifBold },
});

// ── Friend row ────────────────────────────────────────────────────────────────
function FriendRow({ item, onChat }) {
  const name  = item.name  || item.friend?.name  || 'Friend';
  const email = item.email || item.friend?.email || '';
  return (
    <View style={fr.row}>
      <Avatar name={name} />
      <View style={fr.info}>
        <Text style={fr.name}>{name}</Text>
        {!!email && <Text style={fr.email} numberOfLines={1}>{email}</Text>}
      </View>
      <TouchableOpacity style={fr.chatBtn} onPress={() => onChat(item)} hitSlop={8}>
        <Ionicons name="chatbubble-outline" size={16} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}
const fr = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: spacing.md, gap: 12 },
  info:   { flex: 1 },
  name:   { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.textPrimary },
  email:  { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, marginTop: 1 },
  chatBtn:{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
});

// ── Request row ───────────────────────────────────────────────────────────────
function RequestRow({ item, onAccept, onDecline, acting }) {
  const name  = item.sender?.name  || item.name  || 'Someone';
  const email = item.sender?.email || item.email || '';
  const cat   = item.relationship_category || 'friend';
  return (
    <View style={rr.row}>
      <Avatar name={name} />
      <View style={rr.info}>
        <Text style={rr.name}>{name}</Text>
        <Text style={rr.sub}>{email || `Wants to connect as ${cat}`}</Text>
      </View>
      <View style={rr.btns}>
        <TouchableOpacity style={rr.decBtn} onPress={() => onDecline(item.id)} disabled={!!acting}>
          <Ionicons name="close" size={16} color={colors.error} />
        </TouchableOpacity>
        <TouchableOpacity style={rr.accBtn} onPress={() => onAccept(item.id)} disabled={!!acting}>
          {acting === 'accept'
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="checkmark" size={16} color="#fff" />
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}
const rr = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: spacing.md, gap: 12 },
  info:  { flex: 1 },
  name:  { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.textPrimary },
  sub:   { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, marginTop: 1 },
  btns:  { flexDirection: 'row', gap: 8 },
  decBtn:{ width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: colors.error + '50', alignItems: 'center', justifyContent: 'center' },
  accBtn:{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});

// ── Search user row ───────────────────────────────────────────────────────────
function SearchRow({ item, onAdd, acting }) {
  const name  = item.name  || 'User';
  const email = item.email || '';
  return (
    <View style={sr.row}>
      <Avatar name={name} />
      <View style={sr.info}>
        <Text style={sr.name}>{name}</Text>
        {!!email && <Text style={sr.email} numberOfLines={1}>{email}</Text>}
      </View>
      <TouchableOpacity
        style={[sr.addBtn, item.request_sent && sr.addBtnSent]}
        onPress={() => !item.request_sent && onAdd(item.id)}
        disabled={item.request_sent || acting === item.id}
      >
        {acting === item.id
          ? <ActivityIndicator size="small" color={item.request_sent ? colors.textMuted : '#fff'} />
          : <Ionicons name={item.request_sent ? 'checkmark' : 'person-add-outline'} size={15} color={item.request_sent ? colors.textMuted : '#fff'} />
        }
      </TouchableOpacity>
    </View>
  );
}
const sr = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: spacing.md, gap: 12 },
  info:     { flex: 1 },
  name:     { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.textPrimary },
  email:    { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, marginTop: 1 },
  addBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  addBtnSent:{ backgroundColor: colors.bgInput },
});

// ── Divider ───────────────────────────────────────────────────────────────────
function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 68 }} />;
}

// ── Empty ─────────────────────────────────────────────────────────────────────
function Empty({ icon, title, sub }) {
  return (
    <View style={em.wrap}>
      <View style={em.icon}><Ionicons name={icon} size={32} color={colors.textMuted} /></View>
      <Text style={em.title}>{title}</Text>
      <Text style={em.sub}>{sub}</Text>
    </View>
  );
}
const em = StyleSheet.create({
  wrap:  { alignItems: 'center', paddingTop: 60, gap: 8 },
  icon:  { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.bgInput, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  title: { fontFamily: fonts.serif, fontSize: 19, color: colors.textPrimary },
  sub:   { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
});

// ── Main ──────────────────────────────────────────────────────────────────────
export default function FriendsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [tab,       setTab]       = useState('Friends');
  const [friends,   setFriends]   = useState([]);
  const [requests,  setRequests]  = useState([]);
  const [results,   setResults]   = useState([]);
  const [query,     setQuery]     = useState('');
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [searching, setSearching] = useState(false);
  const [acting,    setActing]    = useState(null);  // request id | user id
  const [reqActing, setReqActing] = useState({});    // { id: 'accept'|'decline' }
  const searchTimer = useRef(null);
  const underline   = useRef(new Animated.Value(0)).current;

  useEffect(() => { loadFriends(); loadRequests(); }, []);

  useEffect(() => {
    const idx = TABS.indexOf(tab);
    Animated.spring(underline, { toValue: idx, useNativeDriver: false, speed: 20, bounciness: 8 }).start();
  }, [tab]);

  useEffect(() => {
    if (tab !== 'Find') return;
    clearTimeout(searchTimer.current);
    if (!query.trim()) { setResults([]); return; }
    searchTimer.current = setTimeout(doSearch, 400);
    return () => clearTimeout(searchTimer.current);
  }, [query, tab]);

  const loadFriends = async () => {
    try {
      const data = await getAcceptedFriends();
      const list = Array.isArray(data) ? data : (data?.friends || data?.data || []);
      setFriends(list);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  const loadRequests = async () => {
    try {
      const data = await getReceivedRequests();
      const list = Array.isArray(data) ? data : (data?.friend_requests || data?.data || []);
      setRequests(list.filter((r) => r.status === 'pending'));
    } catch {}
  };

  const doSearch = async () => {
    setSearching(true);
    try {
      const data = await searchUsers(query.trim());
      const list = Array.isArray(data) ? data : (data?.users || data?.data || []);
      setResults(list);
    } catch {}
    finally { setSearching(false); }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadFriends();
    loadRequests();
  };

  const handleAccept = async (id) => {
    setReqActing((p) => ({ ...p, [id]: 'accept' }));
    try {
      await acceptFriendRequest(id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
      loadFriends();
    } catch {}
    finally { setReqActing((p) => { const n = { ...p }; delete n[id]; return n; }); }
  };

  const handleDecline = async (id) => {
    setReqActing((p) => ({ ...p, [id]: 'decline' }));
    try {
      await declineFriendRequest(id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch {}
    finally { setReqActing((p) => { const n = { ...p }; delete n[id]; return n; }); }
  };

  const handleAdd = async (userId) => {
    setActing(userId);
    try {
      await sendFriendRequest(userId);
      setResults((prev) => prev.map((u) => u.id === userId ? { ...u, request_sent: true } : u));
    } catch {}
    finally { setActing(null); }
  };

  const handleChat = (friend) => {
    const userId = friend.friend?.id || friend.id;
    const name   = friend.friend?.name || friend.name || 'Friend';
    console.log('[FriendsScreen] handleChat — raw friend:', JSON.stringify(friend));
    console.log('[FriendsScreen] → Chat with userId:', userId, 'name:', name);
    navigation.navigate('Chat', { userId, name });
  };

  const tabW = `${100 / TABS.length}%`;
  const pendingCount = requests.length;

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Social</Text>
        <TouchableOpacity
          style={s.chatListBtn}
          onPress={() => navigation.navigate('ChatList')}
          hitSlop={8}
        >
          <Ionicons name="chatbubbles-outline" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {TABS.map((t, i) => (
          <TouchableOpacity key={t} style={s.tabBtn} onPress={() => setTab(t)} activeOpacity={0.75}>
            <View style={s.tabBtnInner}>
              <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>{t}</Text>
              {t === 'Requests' && pendingCount > 0 && (
                <View style={s.reqBadge}>
                  <Text style={s.reqBadgeTxt}>{pendingCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
        {/* Sliding underline */}
        <Animated.View style={[s.underline, {
          width: tabW,
          left: underline.interpolate({
            inputRange: [0, 1, 2],
            outputRange: ['0%', `${100 / TABS.length}%`, `${200 / TABS.length}%`],
          }),
        }]} />
      </View>

      {/* ── Friends tab ── */}
      {tab === 'Friends' && (
        loading ? (
          <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>
        ) : (
          <FlatList
            data={friends}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => <FriendRow item={item} onChat={handleChat} />}
            ItemSeparatorComponent={Divider}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
            ListEmptyComponent={<Empty icon="people-outline" title="No friends yet" sub={`Switch to "Find" to connect\nwith people`} />}
            showsVerticalScrollIndicator={false}
          />
        )
      )}

      {/* ── Requests tab ── */}
      {tab === 'Requests' && (
        <FlatList
          data={requests}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <RequestRow
              item={item}
              onAccept={handleAccept}
              onDecline={handleDecline}
              acting={reqActing[item.id]}
            />
          )}
          ItemSeparatorComponent={Divider}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRequests(); setRefreshing(false); }} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          ListEmptyComponent={<Empty icon="checkmark-done-outline" title="All clear" sub="No pending friend requests" />}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Find tab ── */}
      {tab === 'Find' && (
        <View style={{ flex: 1 }}>
          <View style={s.searchWrap}>
            <View style={s.searchBar}>
              <Ionicons name="search-outline" size={15} color={colors.textMuted} />
              <TextInput
                style={s.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search by name or email…"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
              {searching && <ActivityIndicator size="small" color={colors.primary} />}
              {query.length > 0 && !searching && (
                <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </View>
          <FlatList
            data={results}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <SearchRow item={item} onAdd={handleAdd} acting={acting} />
            )}
            ItemSeparatorComponent={Divider}
            contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
            ListEmptyComponent={
              query.trim()
                ? (!searching && <Empty icon="person-outline" title="No results" sub="Try a different name or email" />)
                : <Empty icon="search-outline" title="Find people" sub="Search by name or email\nto send a friend request" />
            }
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: colors.bg },
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  title:    { fontFamily: fonts.serifBold, fontSize: 28, color: colors.textPrimary, letterSpacing: -0.6 },
  chatListBtn:{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  tabBar:   { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, position: 'relative' },
  tabBtn:   { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnInner:{ flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabTxt:   { fontFamily: fonts.sans, fontSize: 14, color: colors.textMuted },
  tabTxtActive:{ fontFamily: fonts.sansMedium, color: colors.textPrimary },
  underline:{ position: 'absolute', bottom: 0, height: 2, backgroundColor: colors.primary, borderRadius: 1 },
  reqBadge: { backgroundColor: '#D94F4F', minWidth: 17, height: 17, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  reqBadgeTxt:{ fontFamily: fonts.sansMedium, fontSize: 10, color: '#fff' },
  searchWrap: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.bgCard, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 11 },
  searchInput:{ flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.textPrimary, padding: 0 },
});