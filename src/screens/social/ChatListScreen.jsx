// src/screens/social/ChatListScreen.jsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, Animated, RefreshControl, ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, spacing, radius } from '../../theme';
import { getConversations } from '../../api/social';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr);
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function ConvRow({ item, onPress, index }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, delay: index * 40, useNativeDriver: false, speed: 16 }).start();
  }, []);

  const name     = item.other_participant?.name || item.name || 'Unknown';
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const hue      = name.charCodeAt(0) * 37 % 360;
  const unread   = item.unread_count || 0;
  const lastMsg  = item.last_message?.content || '';
  const lastTime = item.last_message?.created_at;

  return (
    <Animated.View style={{
      opacity: anim,
      transform: [{ translateX: anim.interpolate({ inputRange:[0,1], outputRange:[-24,0] }) }],
    }}>
      <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.75}>
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: `hsl(${hue},40%,88%)` }]}>
          <Text style={[styles.avatarTxt, { color: `hsl(${hue},45%,38%)` }]}>{initials}</Text>
        </View>

        {/* Content */}
        <View style={styles.info}>
          <View style={styles.infoTop}>
            <Text style={[styles.name, unread > 0 && styles.nameUnread]}>{name}</Text>
            <Text style={styles.time}>{timeAgo(lastTime)}</Text>
          </View>
          <View style={styles.infoBottom}>
            <Text style={[styles.preview, unread > 0 && styles.previewUnread]} numberOfLines={1}>
              {lastMsg || 'Start a conversation'}
            </Text>
            {unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadTxt}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ChatListScreen({ navigation }) {
  const [convs,      setConvs]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getConversations();
      setConvs(data?.conversations || data || []);
    } catch (e) {
      console.error('Convs error:', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Messages</Text>
        <TouchableOpacity style={styles.composeBtn} onPress={() => navigation.navigate('Social')}>
          <Ionicons name="create-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={convs}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.list, convs.length === 0 && styles.listEmpty]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySub}>Chat with a friend to get started</Text>
            </View>
          )}
          renderItem={({ item, index }) => (
            <ConvRow
              item={item}
              index={index}
              onPress={() => navigation.navigate('Chat', {
                conversationId: item.id,
                name: item.other_participant?.name || item.name,
                userId: item.other_participant?.id,
              })}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: spacing.xl + spacing.sm, paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
  },
  title: { flex: 1, fontFamily: fonts.serifBold, fontSize: 22, color: colors.textPrimary, letterSpacing: -0.3 },
  composeBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.primaryLight, borderWidth: 1.5, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md,
  },
  avatar: {
    width: 50, height: 50, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { fontFamily: fonts.serifBold, fontSize: 18 },
  info: { flex: 1 },
  infoTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.textPrimary },
  nameUnread: { fontFamily: fonts.sansMedium, color: colors.textPrimary },
  time: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted },
  infoBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 },
  preview: { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted, flex: 1 },
  previewUnread: { fontFamily: fonts.sansMedium, color: colors.textSecondary },
  unreadBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  unreadTxt: { fontFamily: fonts.sansMedium, fontSize: 10, color: '#fff' },

  sep: { height: 1, backgroundColor: colors.border, marginLeft: spacing.lg + 50 + spacing.md },
  list: { paddingBottom: 100 },
  listEmpty: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: spacing.sm },
  emptyIcon: { fontSize: 48, marginBottom: spacing.sm },
  emptyTitle: { fontFamily: fonts.serif, fontSize: 20, color: colors.textPrimary, letterSpacing: -0.3 },
  emptySub: { fontFamily: fonts.sans, fontSize: 14, color: colors.textMuted },
});