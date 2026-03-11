// src/screens/social/ChatScreen.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, StatusBar, Animated, KeyboardAvoidingView,
  Platform, ActivityIndicator, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import useAuthStore from '../../store/authStore';
import { colors, fonts, spacing, radius, shadows } from '../../theme';
import { getMessages, sendMessage, markConversationRead, getOrCreateConversation } from '../../api/social';
import { cable } from '../../services/cable';

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString()
    ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function isSameDay(a, b) {
  if (!a || !b) return false;
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function dayLabel(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, size = 36 }) {
  const initials = name?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const hue = name
    ? (name.charCodeAt(0) * 53 + name.charCodeAt(name.length - 1) * 17) % 360
    : 200;
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: `hsl(${hue},35%,85%)`,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{
        fontFamily: fonts.sansMedium,
        fontSize: size * 0.38,
        color: `hsl(${hue},40%,35%)`,
      }}>
        {initials}
      </Text>
    </View>
  );
}

// ── Message bubble ─────────────────────────────────────────────────────────────
function Bubble({ msg, isMe, showTime, showAvatar, name }) {
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const opacAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: false, speed: 30, bounciness: 5 }),
      Animated.timing(opacAnim,  { toValue: 1, duration: 160, useNativeDriver: false }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[
      bs.row,
      isMe ? bs.rowMe : bs.rowThem,
      { opacity: opacAnim, transform: [{ scale: scaleAnim }] },
    ]}>
      {/* Avatar slot — keeps alignment even when avatar is hidden */}
      {!isMe && (
        <View style={bs.avatarSlot}>
          {showAvatar ? <Avatar name={name} size={28} /> : null}
        </View>
      )}

      <View style={[bs.col, isMe ? bs.colMe : bs.colThem]}>
        <View style={[
          bs.bubble,
          isMe   ? bs.bubbleMe   : bs.bubbleThem,
          msg.pending && bs.bubblePending,
          msg.failed  && bs.bubbleFailed,
        ]}>
          <Text style={[bs.text, isMe ? bs.textMe : bs.textThem]}>
            {msg.content}
          </Text>
        </View>

        {showTime && (
          <View style={[bs.meta, isMe ? bs.metaMe : bs.metaThem]}>
            {msg.pending && (
              <Ionicons name="time-outline" size={10} color={colors.textMuted} style={{ marginRight: 3 }} />
            )}
            {msg.failed && (
              <Ionicons name="alert-circle-outline" size={10} color="#e05" style={{ marginRight: 3 }} />
            )}
            <Text style={[bs.time, msg.failed && { color: '#e05' }]}>
              {msg.failed ? 'Failed · tap to retry' : timeLabel(msg.created_at)}
            </Text>
            {isMe && !msg.pending && !msg.failed && (
              <Text style={[bs.check, msg.read && bs.checkRead]}>
                {msg.read ? ' ✓✓' : ' ✓'}
              </Text>
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingBubble({ name }) {
  const d1   = useRef(new Animated.Value(0)).current;
  const d2   = useRef(new Animated.Value(0)).current;
  const d3   = useRef(new Animated.Value(0)).current;
  const opac = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opac, { toValue: 1, duration: 200, useNativeDriver: false }).start();
    const bounce = (dot, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -6, duration: 260, useNativeDriver: false }),
          Animated.timing(dot, { toValue: 0,  duration: 260, useNativeDriver: false }),
          Animated.delay(480),
        ])
      ).start();
    bounce(d1, 0);
    bounce(d2, 180);
    bounce(d3, 360);
  }, []);

  return (
    <Animated.View style={[tb.row, { opacity: opac }]}>
      <View style={tb.avatarSlot}>
        <Avatar name={name} size={28} />
      </View>
      <View style={tb.bubble}>
        {[d1, d2, d3].map((d, i) => (
          <Animated.View key={i} style={[tb.dot, { transform: [{ translateY: d }] }]} />
        ))}
      </View>
    </Animated.View>
  );
}

// ── Date separator ─────────────────────────────────────────────────────────────
function DateSep({ dateStr }) {
  return (
    <View style={sep.wrap}>
      <View style={sep.line} />
      <Text style={sep.label}>{dayLabel(dateStr)}</Text>
      <View style={sep.line} />
    </View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ChatScreen({ route, navigation }) {
  const { conversationId, name, userId } = route.params || {};
  const currentUser = useAuthStore((s) => s.user);
  const insets = useSafeAreaInsets();

  const [messages,    setMessages]    = useState([]);
  const [input,       setInput]       = useState('');
  const [loading,     setLoading]     = useState(true);
  const [sending,     setSending]     = useState(false);
  const [isTyping,    setIsTyping]    = useState(false);
  const [page,        setPage]        = useState(1);
  const [hasMore,     setHasMore]     = useState(true);
  const [convId,      setConvId]      = useState(conversationId);
  const [inputH,      setInputH]      = useState(40);

  const listRef     = useRef(null);
  const inputRef    = useRef(null);
  const typingTimer = useRef(null);
  const unsubRef    = useRef(null);
  const sendScale   = useRef(new Animated.Value(1)).current;

  // ── ActionCable ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      cable.connect();
      let activeConvId = conversationId;
      if (!activeConvId && userId) {
        try {
          const conv = await getOrCreateConversation(userId);
          activeConvId = conv.id;
          setConvId(activeConvId);
        } catch (e) {
          console.error('Conversation init:', e);
          setLoading(false);
          return;
        }
      }
      unsubRef.current = cable.subscribe(
        'ChatChannel',
        { conversation_id: activeConvId },
        (msg) => {
          if (msg.type === 'message') {
            setMessages((prev) => {
              if (prev.find((m) => m.id === msg.message.id)) return prev;
              return [msg.message, ...prev];
            });
          }
          if (msg.type === 'typing' && msg.user_id !== currentUser?.id) {
            setIsTyping(true);
            clearTimeout(typingTimer.current);
            typingTimer.current = setTimeout(() => setIsTyping(false), 2500);
          }
        }
      );
      loadMessages(activeConvId);
      markConversationRead(activeConvId).catch(() => {});
    };
    init();
    return () => {
      unsubRef.current?.();
      clearTimeout(typingTimer.current);
    };
  }, []);

  const loadMessages = async (id, p = 1) => {
    if (!id) { setLoading(false); return; }
    try {
      const data = await getMessages(id, p);
      const msgs = data?.messages || data || [];
      setMessages((prev) => p === 1 ? msgs : [...prev, ...msgs]);
      setHasMore(msgs.length >= 20);
      setPage(p);
    } catch (e) {
      console.error('Load messages:', e);
    } finally {
      setLoading(false);
    }
  };

  // ── Send ────────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    Animated.sequence([
      Animated.timing(sendScale, { toValue: 0.82, duration: 70, useNativeDriver: false }),
      Animated.spring(sendScale, { toValue: 1, speed: 35, bounciness: 14, useNativeDriver: false }),
    ]).start();

    const temp = {
      id: `temp_${Date.now()}`,
      content: text,
      user_id: currentUser?.id,
      created_at: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [temp, ...prev]);
    setInput('');
    setInputH(40);
    setSending(true);

    try {
      const sent = await sendMessage(convId, text);
      setMessages((prev) =>
        prev.map((m) => m.id === temp.id ? { ...sent, pending: false } : m)
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) => m.id === temp.id ? { ...m, failed: true } : m)
      );
    } finally {
      setSending(false);
    }
  };

  const handleInputChange = (text) => {
    setInput(text);
    if (convId) cable.perform('ChatChannel', { conversation_id: convId }, 'typing', {});
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const renderItem = useCallback(({ item, index }) => {
    const isMe     = item.user_id === currentUser?.id;
    const prev     = messages[index + 1];
    const next     = messages[index - 1];
    const showDate  = !prev || !isSameDay(item.created_at, prev.created_at);
    const showAvatar = !next || next.user_id !== item.user_id;
    const showTime   = !next || next.user_id !== item.user_id ||
      (new Date(next.created_at) - new Date(item.created_at)) > 300000;

    return (
      <>
        <Bubble
          msg={item}
          isMe={isMe}
          showTime={showTime}
          showAvatar={showAvatar}
          name={name}
        />
        {showDate && <DateSep dateStr={item.created_at} />}
      </>
    );
  }, [messages, currentUser, name]);

  const canSend = input.trim().length > 0;

  // The screen lives inside a Tab navigator.
  // KAV offset = header height (56) + status bar.
  // On Android we use 'height' behaviour so offset doesn't matter.
  const kavOffset = insets.top + 56;

  return (
    <View style={[styles.screen]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      {/* Header — sits above KAV so it never moves */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerCenter} activeOpacity={0.75}>
          <View style={styles.avatarOnlineWrap}>
            <Avatar name={name} size={38} />
            <View style={styles.onlineDot} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerName} numberOfLines={1}>{name || 'Chat'}</Text>
            <Text style={[styles.headerSub, isTyping && styles.headerSubTyping]}>
              {isTyping ? 'typing…' : 'online'}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="call-outline" size={19} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="videocam-outline" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* KAV wraps only the list + input bar */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={kavOffset}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            inverted
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onEndReached={() => hasMore && !loading && loadMessages(convId, page + 1)}
            onEndReachedThreshold={0.4}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={isTyping ? <TypingBubble name={name} /> : null}
          />
        )}

        {/* ── Input bar ── */}
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>

          <TouchableOpacity style={styles.sideBtn} hitSlop={8}>
            <Ionicons name="add-circle-outline" size={27} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.inputPill, { minHeight: Math.max(44, inputH + 12) }]}>
            <TextInput
              ref={inputRef}
              style={[styles.inputField, { height: Math.max(22, Math.min(inputH, 108)) }]}
              value={input}
              onChangeText={handleInputChange}
              onContentSizeChange={(e) =>
                setInputH(e.nativeEvent.contentSize.height)
              }
              placeholder="Message…"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={2000}
            />
            <TouchableOpacity style={styles.emojiBtn} hitSlop={8}>
              <Ionicons name="happy-outline" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {canSend ? (
            <Animated.View style={{ transform: [{ scale: sendScale }] }}>
              <TouchableOpacity
                style={styles.sendBtn}
                onPress={handleSend}
                disabled={sending}
                activeOpacity={0.85}
              >
                {sending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="arrow-up" size={20} color="#fff" />
                }
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <TouchableOpacity style={styles.sideBtn} hitSlop={8}>
              <Ionicons name="mic-outline" size={25} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Bubble styles ─────────────────────────────────────────────────────────────
const bs = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, marginBottom: 2 },
  rowMe:      { justifyContent: 'flex-end' },
  rowThem:    { justifyContent: 'flex-start' },
  avatarSlot: { width: 34, marginRight: 5, alignItems: 'center', justifyContent: 'flex-end' },
  col:        { maxWidth: '74%' },
  colMe:      { alignItems: 'flex-end' },
  colThem:    { alignItems: 'flex-start' },

  bubble:        { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMe:      { backgroundColor: colors.textPrimary, borderBottomRightRadius: 4 },
  bubbleThem:    { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bubblePending: { opacity: 0.6 },
  bubbleFailed:  { borderColor: '#e05', borderWidth: 1 },

  text:    { fontSize: 15, lineHeight: 22 },
  textMe:   { fontFamily: fonts.sans, color: '#fff' },
  textThem: { fontFamily: fonts.sans, color: colors.textPrimary },

  meta:     { flexDirection: 'row', alignItems: 'center', marginTop: 3, paddingHorizontal: 2 },
  metaMe:   { justifyContent: 'flex-end' },
  metaThem: { justifyContent: 'flex-start' },
  time:     { fontFamily: fonts.sans, fontSize: 10, color: colors.textMuted },
  check:    { fontFamily: fonts.sans, fontSize: 10, color: colors.textMuted },
  checkRead:{ color: colors.primary },
});

// ── Typing bubble ─────────────────────────────────────────────────────────────
const tb = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, marginBottom: spacing.sm },
  avatarSlot: { width: 34, marginRight: 5 },
  bubble:     {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.bgCard, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textMuted },
});

// ── Date separator ────────────────────────────────────────────────────────────
const sep = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', marginVertical: 18, paddingHorizontal: 20, gap: 10 },
  line:  { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  label: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, letterSpacing: 0.3 },
});

// ── Main styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: colors.bg },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    backgroundColor: colors.bg, gap: 4,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  avatarOnlineWrap: { position: 'relative' },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#22c55e',
    borderWidth: 2, borderColor: colors.bg,
  },
  headerText: { flex: 1 },
  headerName: { fontFamily: fonts.sansMedium, fontSize: 16, color: colors.textPrimary },
  headerSub:  { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  headerSubTyping: { color: colors.primary },
  iconBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },

  listContent: { paddingTop: 10, paddingBottom: 6 },

  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 8, paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
    backgroundColor: colors.bg, gap: 6,
  },
  sideBtn: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  inputPill: {
    flex: 1,
    flexDirection: 'row', alignItems: 'flex-end',
    backgroundColor: colors.bgCard,
    borderRadius: 22, borderWidth: 1, borderColor: colors.border,
    paddingLeft: 14, paddingRight: 4,
    paddingTop: Platform.OS === 'ios' ? 11 : 4,
    paddingBottom: Platform.OS === 'ios' ? 11 : 4,
  },
  inputField: {
    flex: 1,
    fontFamily: fonts.sans, fontSize: 15,
    color: colors.textPrimary,
    padding: 0,
    textAlignVertical: 'center',
  },
  emojiBtn: {
    width: 34, height: 34,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? -2 : 0,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
});