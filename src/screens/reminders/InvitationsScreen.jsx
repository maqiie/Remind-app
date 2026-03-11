// src/screens/reminders/InvitationsScreen.jsx
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, RefreshControl, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, spacing, radius, shadows } from '../../theme';
import client from '../../api/client';

const PRIORITY_COLOR = {
  high:   '#D94F4F',
  medium: '#E09F3E',
  low:    '#6B9E78',
};

function formatDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Invitation Card ───────────────────────────────────────────────────────────
function InvitationCard({ item, onAccept, onDecline, index }) {
  const [responding, setResponding] = useState(false);
  const anim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 260, delay: index * 50, useNativeDriver: true,
    }).start();
  }, []);

  const priorityColor = PRIORITY_COLOR[item.reminder?.priority] || PRIORITY_COLOR.low;

  const handleAccept = async () => {
    setResponding(true);
    await onAccept(item.id);
    setResponding(false);
  };

  const handleDecline = async () => {
    setResponding(true);
    await onDecline(item.id);
    setResponding(false);
  };

  return (
    <Animated.View style={{
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
    }}>
      <View style={card.wrap}>
        {/* Priority accent */}
        <View style={[card.accent, { backgroundColor: priorityColor }]} />

        <View style={card.body}>
          {/* Sender line */}
          <View style={card.senderRow}>
            <View style={[card.avatar, { backgroundColor: priorityColor + '20' }]}>
              <Text style={[card.avatarText, { color: priorityColor }]}>
                {(item.sender?.name || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={card.senderName}>{item.sender?.name || 'Someone'}</Text>
              <Text style={card.senderLabel}>invited you to a reminder</Text>
            </View>
          </View>

          {/* Reminder info */}
          <View style={card.reminderBox}>
            <Text style={card.reminderTitle} numberOfLines={2}>
              {item.reminder?.title}
            </Text>
            {item.reminder?.description ? (
              <Text style={card.reminderDesc} numberOfLines={1}>
                {item.reminder.description}
              </Text>
            ) : null}
            {item.reminder?.due_date ? (
              <View style={card.metaRow}>
                <Ionicons name="time-outline" size={11} color={colors.textMuted} />
                <Text style={card.metaText}>{formatDate(item.reminder.due_date)}</Text>
              </View>
            ) : null}
          </View>

          {/* Action buttons */}
          <View style={card.actions}>
            <TouchableOpacity
              style={[card.btn, card.declineBtn]}
              onPress={handleDecline}
              disabled={responding}
              activeOpacity={0.75}
            >
              <Ionicons name="close" size={15} color={colors.textSecondary} />
              <Text style={card.declineBtnText}>Decline</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[card.btn, card.acceptBtn]}
              onPress={handleAccept}
              disabled={responding}
              activeOpacity={0.75}
            >
              <Ionicons name="checkmark" size={15} color="#fff" />
              <Text style={card.acceptBtnText}>Accept</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <View style={em.wrap}>
      <Text style={em.emoji}>📬</Text>
      <Text style={em.title}>No pending invitations</Text>
      <Text style={em.sub}>When someone tags you in a reminder, it'll show up here</Text>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function InvitationsScreen({ navigation }) {
  const [invitations, setInvitations] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [error,       setError]       = useState(null);

  const loadInvitations = useCallback(async () => {
    setError(null);
    try {
      const res  = await client.get('/invitations');
      const data = res.data;
      const list = Array.isArray(data) ? data : (data?.invitations || []);
      setInvitations(list);
    } catch (e) {
      setError('Could not load invitations');
      console.error('Invitations load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    loadInvitations();
    const unsub = navigation.addListener('focus', loadInvitations);
    return unsub;
  }, [navigation]);

  const respond = async (id, status) => {
    try {
      await client.patch(`/invitations/${id}`, { status });
      // Remove from list after responding
      setInvitations((prev) => prev.filter((inv) => inv.id !== id));
    } catch (e) {
      console.error(`Invitation ${status} error:`, e.response?.data || e.message);
    }
  };

  const onRefresh = async () => { setRefreshing(true); await loadInvitations(); };

  const pendingCount = invitations.length;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View>
          <Text style={s.title}>Invitations</Text>
          {pendingCount > 0 && (
            <Text style={s.subtitle}>{pendingCount} pending</Text>
          )}
        </View>
        <View style={{ width: 36 }} />
      </View>

      <View style={s.headerRule} />

      {/* Error */}
      {error ? (
        <TouchableOpacity style={s.errorRow} onPress={loadInvitations}>
          <Text style={s.errorText}>! {error} — tap to retry</Text>
        </TouchableOpacity>
      ) : null}

      {/* List */}
      <FlatList
        data={invitations}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[s.list, !invitations.length && s.listEmpty]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={!loading ? <EmptyState /> : null}
        renderItem={({ item, index }) => (
          <InvitationCard
            item={item}
            index={index}
            onAccept={(id) => respond(id, 'accepted')}
            onDecline={(id) => respond(id, 'declined')}
          />
        )}
      />
    </SafeAreaView>
  );
}

// ── Stylesheets ───────────────────────────────────────────────────────────────
const card = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    marginHorizontal: spacing.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  accent: { width: 4 },
  body: { flex: 1, padding: spacing.md, gap: spacing.sm },

  senderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.sansMedium, fontSize: 15 },
  senderName:  { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.textPrimary },
  senderLabel: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, marginTop: 1 },

  reminderBox: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 4,
  },
  reminderTitle: { fontFamily: fonts.sansMedium, fontSize: 14.5, color: colors.textPrimary },
  reminderDesc:  { fontFamily: fonts.sans, fontSize: 12.5, color: colors.textMuted },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaText: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.textMuted },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: 2 },
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 10, borderRadius: radius.md,
  },
  declineBtn: { backgroundColor: colors.bg, borderWidth: 1.5, borderColor: colors.border },
  acceptBtn:  { backgroundColor: colors.primary },
  declineBtnText: { fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.textSecondary },
  acceptBtnText:  { fontFamily: fonts.sansMedium, fontSize: 13.5, color: '#fff' },
});

const em = StyleSheet.create({
  wrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingTop: 64, paddingHorizontal: spacing.xl, gap: spacing.sm,
  },
  emoji: { fontSize: 40, marginBottom: spacing.sm },
  title: { fontFamily: fonts.serifBold, fontSize: 22, color: colors.textPrimary, letterSpacing: -0.4 },
  sub: { fontFamily: fonts.sans, fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
});

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: { padding: 4 },
  title:   { fontFamily: fonts.serifBold, fontSize: 24, color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle:{ fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted, marginTop: 2 },
  headerRule: { height: 3, backgroundColor: colors.textPrimary, marginHorizontal: spacing.lg, marginBottom: spacing.sm },
  errorRow: {
    paddingHorizontal: spacing.lg, paddingVertical: 8,
    borderBottomWidth: 1, borderColor: '#FFCDD2', backgroundColor: '#FFF5F5',
  },
  errorText: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.error },
  list:      { paddingTop: spacing.md, paddingBottom: 60 },
  listEmpty: { flex: 1 },
});