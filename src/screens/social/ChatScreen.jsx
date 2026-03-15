// src/screens/social/ChatScreen.jsx
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, StatusBar, Animated, KeyboardAvoidingView,
  Platform, ActivityIndicator, Pressable, Modal, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import useAuthStore from '../../store/authStore';
import { colors, fonts, shadows } from '../../theme';
import {
  getMessages, sendMessage, markConversationRead, getOrCreateConversation,
  getInvitations, acceptInvitation, declineInvitation, createInvitation,
} from '../../api/social';
import { getReminders } from '../../api/reminders';
import { cable } from '../../services/cable';

// Inline tab style to avoid circular import (navigation → ChatScreen → navigation)
const FLOATING_TAB_STYLE = {
  position: 'absolute',
  backgroundColor: '#FFFFFF',
  borderTopWidth: 0,
  marginHorizontal: 14,
  marginBottom: Platform.OS === 'ios' ? 24 : 14,
  borderRadius: 26,
  height: 66,
  paddingBottom: 0,
  paddingTop: 0,
  shadowColor: '#1C1917',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.1,
  shadowRadius: 20,
  elevation: 14,
  borderWidth: 1,
  borderColor: 'rgba(0,0,0,0.07)',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr), now = new Date();
  return d.toDateString() === now.toDateString()
    ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function isSameDay(a, b) {
  return !!a && !!b && new Date(a).toDateString() === new Date(b).toDateString();
}
function dayLabel(dateStr) {
  const d = new Date(dateStr), now = new Date(), y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString())   return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
function priorityColor(p) {
  if (p === 'high')   return '#EF4444';
  if (p === 'medium') return '#F59E0B';
  return colors.primary;
}
function formatDue(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name = '?', size = 36, online = false }) {
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const hue = (name.charCodeAt(0) * 53 + (name.charCodeAt(name.length - 1) || 0) * 17) % 360;
  return (
    <View style={{ width: size, height: size }}>
      <View style={[av.circle, {
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: `hsl(${hue},50%,92%)`,
      }]}>
        <Text style={[av.txt, { fontSize: size * 0.38, color: `hsl(${hue},50%,32%)` }]}>
          {initials}
        </Text>
      </View>
      {online && (
        <View style={[av.online, { width: size * 0.3, height: size * 0.3, borderRadius: size * 0.15 }]} />
      )}
    </View>
  );
}
const av = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  txt:    { fontFamily: fonts.sansMedium, letterSpacing: 0.3 },
  online: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#fff' },
});

// ── Task Card ─────────────────────────────────────────────────────────────────
function TaskCard({ inv, isMe, currentUserId, onAccept, onDecline, onEdit, acting }) {
  const title      = inv.reminder?.title       || inv.title    || 'Untitled task';
  const dueDate    = inv.reminder?.due_date    || inv.due_date;
  const priority   = inv.reminder?.priority   || inv.priority  || 'low';
  const notes      = inv.reminder?.description || inv.reminder?.notes || inv.notes;
  const pColor     = priorityColor(priority);
  const isPending  = !inv.status || inv.status === 'pending';
  const reminderId = inv.reminder?.id || inv.reminder_id;
  const senderName = inv.sender?.name || (isMe ? 'You' : 'Them');

  const enter = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(enter, {
      toValue: 1, useNativeDriver: true,
      tension: 100, friction: 12, delay: 80,
    }).start();
  }, []);

  const statusConfig = {
    accepted: { label: 'Accepted', color: colors.primary,  bg: colors.primaryLight,  icon: 'checkmark-circle' },
    declined: { label: 'Declined', color: '#EF4444',       bg: '#FEF2F2',            icon: 'close-circle'     },
  };
  const sc = statusConfig[inv.status] || null;

  const pLabel = priority.charAt(0).toUpperCase() + priority.slice(1);

  return (
    <Animated.View style={[
      tsk.outer,
      { opacity: enter, transform: [{ scale: enter.interpolate({ inputRange:[0,1], outputRange:[0.93,1] }) }] },
    ]}>
      {/* Context pill — centered above card */}
      <View style={tsk.contextRow}>
        <View style={tsk.contextLine} />
        <View style={tsk.contextPill}>
          <Ionicons name="checkbox-outline" size={11} color={colors.primary} />
          <Text style={tsk.contextTxt}>
            {isMe ? 'You shared a task' : `${senderName} shared a task`}
          </Text>
        </View>
        <View style={tsk.contextLine} />
      </View>

      {/* The card itself — centered, full-width-ish */}
      <Pressable
        onPressIn={() => Animated.spring(pressScale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(pressScale, { toValue: 1,    useNativeDriver: true, speed: 50 }).start()}
        onPress={isMe && reminderId ? () => onEdit(reminderId) : undefined}
      >
        <Animated.View style={[tsk.card, { transform: [{ scale: pressScale }] }]}>
          {/* Colored top band */}
          <View style={[tsk.topBand, { backgroundColor: pColor }]}>
            <View style={tsk.bandLeft}>
              <Ionicons name="flag" size={13} color="rgba(255,255,255,0.9)" />
              <Text style={tsk.bandPriority}>{pLabel} priority</Text>
            </View>
            {sc && (
              <View style={tsk.bandStatus}>
                <Ionicons name={sc.icon} size={13} color="rgba(255,255,255,0.9)" />
                <Text style={tsk.bandStatusTxt}>{sc.label}</Text>
              </View>
            )}
          </View>

          {/* Card body */}
          <View style={tsk.body}>
            {/* Title */}
            <Text style={tsk.title}>{title}</Text>

            {/* Meta row */}
            {(dueDate || notes) && (
              <View style={tsk.metaRow}>
                {!!dueDate && (
                  <View style={tsk.metaChip}>
                    <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
                    <Text style={tsk.metaChipTxt}>{formatDue(dueDate)}</Text>
                  </View>
                )}
                {!!notes && (
                  <View style={[tsk.metaChip, { flex: 1 }]}>
                    <Ionicons name="document-text-outline" size={12} color={colors.textSecondary} />
                    <Text style={tsk.metaChipTxt} numberOfLines={1}>{notes}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Action area */}
            {isPending && !isMe && (
              <View style={tsk.actions}>
                <TouchableOpacity
                  style={tsk.btnNo}
                  onPress={() => onDecline(inv.id)}
                  disabled={!!acting}
                  activeOpacity={0.75}
                >
                  {acting === `dec_${inv.id}`
                    ? <ActivityIndicator size="small" color="#EF4444" />
                    : <Text style={tsk.btnNoTxt}>Decline</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  style={[tsk.btnYes, { backgroundColor: pColor }]}
                  onPress={() => onAccept(inv.id)}
                  disabled={!!acting}
                  activeOpacity={0.85}
                >
                  {acting === `acc_${inv.id}`
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={tsk.btnYesTxt}>Accept task</Text>
                  }
                </TouchableOpacity>
              </View>
            )}

            {/* Sender's edit hint */}
            {isMe && !!reminderId && (
              <View style={tsk.editHint}>
                <Ionicons name="open-outline" size={12} color={colors.textMuted} />
                <Text style={tsk.editHintTxt}>Tap to open task</Text>
              </View>
            )}
          </View>
        </Animated.View>
      </Pressable>

      {/* Timestamp — centered */}
      <Text style={tsk.time}>{timeLabel(inv.created_at)}</Text>
    </Animated.View>
  );
}

const tsk = StyleSheet.create({
  // Centered full-width wrapper
  outer: {
    alignSelf: 'center',
    width: '88%',
    marginVertical: 6,
    paddingHorizontal: 0,
  },

  // Context separator row
  contextRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  contextLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  contextPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20,
  },
  contextTxt: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.primary, letterSpacing: 0.2 },

  // Card shell
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#6B9E78',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },

  // Colored top band
  topBand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bandLeft:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bandPriority:  { fontFamily: fonts.sansMedium, fontSize: 12, color: 'rgba(255,255,255,0.95)', letterSpacing: 0.3 },
  bandStatus:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  bandStatusTxt: { fontFamily: fonts.sansMedium, fontSize: 11, color: '#fff' },

  // Body
  body:  { padding: 16, gap: 10 },
  title: { fontFamily: fonts.sansMedium, fontSize: 16, color: colors.textPrimary, lineHeight: 22, letterSpacing: -0.1 },

  // Meta chips
  metaRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaChip:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.bgInput, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  metaChipTxt: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary },

  // Actions
  actions: { flexDirection: 'row', gap: 10, paddingTop: 4 },
  btnNo: {
    flex: 1, paddingVertical: 11, borderRadius: 14,
    backgroundColor: '#FEF2F2',
    borderWidth: 1, borderColor: '#FECACA',
    alignItems: 'center',
  },
  btnNoTxt:  { fontFamily: fonts.sansMedium, fontSize: 13, color: '#EF4444' },
  btnYes: {
    flex: 2, paddingVertical: 11, borderRadius: 14,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnYesTxt: { fontFamily: fonts.sansMedium, fontSize: 13, color: '#fff', letterSpacing: 0.2 },

  // Edit hint
  editHint:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  editHintTxt: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted },

  // Time
  time: { fontFamily: fonts.sans, fontSize: 10, color: colors.textMuted, textAlign: 'center', marginTop: 6 },
});

// ── Reply preview ─────────────────────────────────────────────────────────────
function ReplyPreview({ replyTo, onCancel, currentUserId }) {
  if (!replyTo) return null;
  const isMe = replyTo.user_id === currentUserId;
  return (
    <View style={rp.wrap}>
      <View style={rp.bar} />
      <View style={rp.body}>
        <Text style={rp.who}>{isMe ? 'You' : 'Them'}</Text>
        <Text style={rp.txt} numberOfLines={1}>{replyTo.content}</Text>
      </View>
      <TouchableOpacity onPress={onCancel} hitSlop={12}>
        <View style={rp.closeBtn}>
          <Ionicons name="close" size={14} color={colors.textSecondary} />
        </View>
      </TouchableOpacity>
    </View>
  );
}
const rp = StyleSheet.create({
  wrap:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.primaryLight, borderTopWidth: 1, borderTopColor: colors.primary + '30', gap: 10 },
  bar:      { width: 3, height: 34, borderRadius: 2, backgroundColor: colors.primary },
  body:     { flex: 1 },
  who:      { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.primary, marginBottom: 1 },
  txt:      { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary },
  closeBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center' },
});

// ── Quoted message inside bubble ──────────────────────────────────────────────
function QuotedMsg({ quote, isParentMe, currentUserId }) {
  if (!quote) return null;
  const isMe = quote.user_id === currentUserId;
  return (
    <View style={[qm.wrap, isParentMe ? qm.wrapMe : qm.wrapThem]}>
      <View style={[qm.bar, isParentMe ? qm.barMe : qm.barThem]} />
      <View style={qm.body}>
        <Text style={[qm.who, isParentMe ? qm.whoMe : qm.whoThem]}>{isMe ? 'You' : 'Them'}</Text>
        <Text style={[qm.txt, isParentMe ? qm.txtMe : qm.txtThem]} numberOfLines={2}>{quote.content}</Text>
      </View>
    </View>
  );
}
const qm = StyleSheet.create({
  wrap:    { flexDirection: 'row', gap: 6, borderRadius: 10, padding: 8, marginBottom: 6 },
  wrapMe:  { backgroundColor: 'rgba(255,255,255,0.15)' },
  wrapThem:{ backgroundColor: colors.bgInput },
  bar:     { width: 2.5, borderRadius: 2 },
  barMe:   { backgroundColor: 'rgba(255,255,255,0.7)' },
  barThem: { backgroundColor: colors.primary },
  body:    { flex: 1 },
  who:     { fontFamily: fonts.sansMedium, fontSize: 10, marginBottom: 2 },
  whoMe:   { color: 'rgba(255,255,255,0.85)' },
  whoThem: { color: colors.primary },
  txt:     { fontFamily: fonts.sans, fontSize: 12, lineHeight: 16 },
  txtMe:   { color: 'rgba(255,255,255,0.75)' },
  txtThem: { color: colors.textSecondary },
});

// ── Message Bubble ────────────────────────────────────────────────────────────
const Bubble = React.memo(function Bubble({ msg, isMe, showTime, showAvatar, name, onRetry, onReply, currentUserId }) {
  const enter  = useRef(new Animated.Value(0)).current;
  const swipeX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(enter, { toValue: 1, useNativeDriver: true, tension: 130, friction: 14 }).start();
  }, []);

  const handleReplyGesture = () => {
    Animated.sequence([
      Animated.spring(swipeX, { toValue: isMe ? -36 : 36, useNativeDriver: true, speed: 50, bounciness: 6 }),
      Animated.spring(swipeX, { toValue: 0, useNativeDriver: true, speed: 30, bounciness: 5 }),
    ]).start(() => onReply(msg));
  };

  const tx = enter.interpolate({ inputRange: [0, 1], outputRange: [isMe ? 20 : -20, 0] });

  return (
    <Animated.View style={[
      bub.row,
      isMe ? bub.rowMe : bub.rowThem,
      { opacity: enter, transform: [{ translateX: tx }] },
    ]}>
      {!isMe && (
        <View style={bub.slot}>
          {showAvatar ? <Avatar name={name} size={28} /> : <View style={{ width: 28 }} />}
        </View>
      )}

      <View style={bub.group}>
        <Animated.View style={{ transform: [{ translateX: swipeX }] }}>
          <Pressable
            onPress={msg.failed && onRetry ? onRetry : undefined}
            onLongPress={handleReplyGesture}
            delayLongPress={250}
            style={{ maxWidth: 290 }}
          >
            <View style={[bub.bubble, isMe ? bub.me : bub.them, msg.pending && bub.pending, msg.failed && bub.failed]}>
              {msg.reply_to && <QuotedMsg quote={msg.reply_to} isParentMe={isMe} currentUserId={currentUserId} />}
              <Text style={[bub.txt, isMe ? bub.txtMe : bub.txtThem]}>{msg.content}</Text>
            </View>

            {showTime && (
              <View style={[bub.meta, isMe ? bub.metaMe : bub.metaThem]}>
                {msg.pending && <Ionicons name="time-outline" size={10} color={colors.textMuted} style={{ marginRight: 2 }} />}
                {msg.failed  && <Ionicons name="alert-circle-outline" size={10} color={colors.error} style={{ marginRight: 2 }} />}
                <Text style={[bub.time, msg.failed && { color: colors.error }]}>
                  {msg.failed ? 'Tap to retry' : timeLabel(msg.created_at)}
                </Text>
                {isMe && !msg.pending && !msg.failed && (
                  <Text style={[bub.tick, msg.read && bub.tickRead]}>{msg.read ? '  ✓✓' : '  ✓'}</Text>
                )}
              </View>
            )}
          </Pressable>
        </Animated.View>

        {/* Reply button */}
        <TouchableOpacity onPress={handleReplyGesture} style={[bub.replyBtn, isMe && bub.replyBtnMe]} hitSlop={10}>
          <Ionicons name="arrow-undo-outline" size={13} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});

const bub = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, marginBottom: 2 },
  rowMe:     { justifyContent: 'flex-end' },
  rowThem:   { justifyContent: 'flex-start' },
  slot:      { marginRight: 6 },
  group:     { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  bubble:    { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, maxWidth: 280 },
  me: {
    backgroundColor: colors.primary, borderBottomRightRadius: 4,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 4,
  },
  them:      { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  pending:   { opacity: 0.55 },
  failed:    { borderWidth: 1.5, borderColor: colors.error + '60' },
  txt:       { fontSize: 15, lineHeight: 22, letterSpacing: 0.1 },
  txtMe:     { fontFamily: fonts.sans, color: '#fff' },
  txtThem:   { fontFamily: fonts.sans, color: colors.textPrimary },
  meta:      { flexDirection: 'row', alignItems: 'center', marginTop: 4, paddingHorizontal: 4 },
  metaMe:    { justifyContent: 'flex-end' },
  metaThem:  { justifyContent: 'flex-start' },
  time:      { fontFamily: fonts.sans, fontSize: 10, color: colors.textMuted, letterSpacing: 0.2 },
  tick:      { fontFamily: fonts.sans, fontSize: 10, color: colors.textMuted },
  tickRead:  { color: colors.primaryDark || colors.primary },
  replyBtn:  { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.bgInput, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  replyBtnMe:{ order: -1 },
});

// ── Typing bubble ─────────────────────────────────────────────────────────────
function TypingBubble({ name }) {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  const wrap = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(wrap, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    dots.forEach((d, i) => {
      Animated.loop(Animated.sequence([
        Animated.delay(i * 150),
        Animated.spring(d, { toValue: -6, speed: 28, bounciness: 10, useNativeDriver: true }),
        Animated.spring(d, { toValue: 0,  speed: 28, bounciness: 6,  useNativeDriver: true }),
        Animated.delay(400),
      ])).start();
    });
  }, []);

  return (
    <Animated.View style={[tp2.row, { opacity: wrap }]}>
      <View style={tp2.slot}><Avatar name={name} size={28} /></View>
      <View style={tp2.bubble}>
        {dots.map((d, i) => (
          <Animated.View key={i} style={[tp2.dot, { transform: [{ translateY: d }] }]} />
        ))}
      </View>
    </Animated.View>
  );
}
const tp2 = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, marginBottom: 8 },
  slot:   { marginRight: 6 },
  bubble: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff', borderRadius: 20, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 14 },
  dot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, opacity: 0.75 },
});

// ── Date separator ─────────────────────────────────────────────────────────────
function DateSep({ dateStr }) {
  return (
    <View style={ds.wrap}>
      <View style={ds.line} />
      <View style={ds.pill}><Text style={ds.lbl}>{dayLabel(dateStr)}</Text></View>
      <View style={ds.line} />
    </View>
  );
}
const ds = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, paddingHorizontal: 16, gap: 10 },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  pill: { backgroundColor: colors.bgInput, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: colors.border },
  lbl:  { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, letterSpacing: 0.4 },
});

// ── Typing status ─────────────────────────────────────────────────────────────
function HeaderSub({ isTyping, name }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: isTyping ? 1 : 0, duration: 220, useNativeDriver: false }).start();
  }, [isTyping]);
  return (
    <Animated.Text style={[
      hs.txt,
      { color: anim.interpolate({ inputRange: [0,1], outputRange: [colors.textMuted, colors.primary] }) },
    ]}>
      {isTyping ? `${name?.split(' ')[0] || 'Someone'} is typing…` : 'online'}
    </Animated.Text>
  );
}
const hs = StyleSheet.create({
  txt: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 0.2, marginTop: 1 },
});

// ── Task Picker ───────────────────────────────────────────────────────────────
function TaskPicker({ visible, onClose, onSelect }) {
  const [list, setList]     = useState([]);
  const [loading, setLoad]  = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoad(true);
    getReminders()
      .then((d) => {
        const r = Array.isArray(d) ? d : (d?.reminders || []);
        setList(r.filter((x) => !x.completed));
      })
      .catch(console.error)
      .finally(() => setLoad(false));
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={pk.overlay} onPress={onClose}>
        <Pressable style={pk.sheet} onPress={() => {}}>
          <View style={pk.handle} />

          <View style={pk.hdr}>
            <View style={pk.hdrLeft}>
              <View style={pk.hdrIcon}>
                <Ionicons name="checkbox-outline" size={16} color={colors.primary} />
              </View>
              <Text style={pk.hdrTitle}>Share a Task</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <View style={pk.closeBtn}><Ionicons name="close" size={16} color={colors.textSecondary} /></View>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={pk.center}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={pk.sub}>Loading your tasks…</Text>
            </View>
          ) : list.length === 0 ? (
            <View style={pk.center}>
              <Ionicons name="calendar-outline" size={32} color={colors.textMuted} />
              <Text style={pk.emptyTitle}>No active tasks</Text>
              <Text style={pk.sub}>Create a task first to share it</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              <View style={pk.list}>
                {list.map((r) => {
                  const pc = priorityColor(r.priority);
                  return (
                    <TouchableOpacity key={r.id} style={pk.item} onPress={() => onSelect(r)} activeOpacity={0.7}>
                      <View style={[pk.itemAccent, { backgroundColor: pc }]} />
                      <View style={pk.itemBody}>
                        <Text style={pk.itemTitle} numberOfLines={1}>{r.title}</Text>
                        {!!r.due_date && <Text style={pk.itemDate}>{formatDue(r.due_date)}</Text>}
                      </View>
                      <View style={[pk.itemBadge, { backgroundColor: pc + '18' }]}>
                        <Text style={[pk.itemBadgeTxt, { color: pc }]}>{r.priority || 'low'}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={{ height: 32 }} />
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
const pk = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '78%', paddingBottom: 20 },
  handle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  hdr:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  hdrLeft:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hdrIcon:    { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  hdrTitle:   { fontFamily: fonts.sansMedium, fontSize: 16, color: colors.textPrimary },
  closeBtn:   { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.bgInput, alignItems: 'center', justifyContent: 'center' },
  center:     { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyTitle: { fontFamily: fonts.sansMedium, fontSize: 16, color: colors.textPrimary },
  sub:        { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted },
  list:       { paddingTop: 8 },
  item:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  itemAccent: { width: 4, height: 40, borderRadius: 2 },
  itemBody:   { flex: 1 },
  itemTitle:  { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.textPrimary },
  itemDate:   { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  itemBadge:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  itemBadgeTxt:{ fontFamily: fonts.sansMedium, fontSize: 10, letterSpacing: 0.3 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ChatScreen({ route, navigation }) {
  const { conversationId, name, userId } = route.params || {};
  const currentUser = useAuthStore((s) => s.user);
  const insets      = useSafeAreaInsets();

  const [messages,      setMessages]      = useState([]);
  const [invitations,   setInvitations]   = useState([]);
  const [input,         setInput]         = useState('');
  const [loading,       setLoading]       = useState(true);
  const [sending,       setSending]       = useState(false);
  const [isTyping,      setIsTyping]      = useState(false);
  const [page,          setPage]          = useState(1);
  const [hasMore,       setHasMore]       = useState(true);
  const [inputFocus,    setInputFocus]    = useState(false);
  const [inputH,        setInputH]        = useState(40);
  const [otherUserId,   setOtherUserId]   = useState(userId || null);
  const [replyTo,       setReplyTo]       = useState(null);
  const [showPicker,    setShowPicker]    = useState(false);
  const [actingInv,     setActingInv]     = useState(null);

  const listRef        = useRef(null);
  const inputRef       = useRef(null);
  const typingTimer    = useRef(null);
  const typingDebounce = useRef(null);
  const unsubRef       = useRef(null);
  const sendScale      = useRef(new Animated.Value(1)).current;
  const convIdRef      = useRef(conversationId);

  // ── Hide tab bar ─────────────────────────────────────────────────────────
  useEffect(() => {
    const tabNav = navigation.getParent();
    tabNav?.setOptions({ tabBarStyle: { display: 'none' } });
    return () => tabNav?.setOptions({ tabBarStyle: FLOATING_TAB_STYLE });
  }, [navigation]);

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      cable.connect();
      let activeConvId = conversationId;
      let resolvedOther = userId || null;
      if (activeConvId) convIdRef.current = activeConvId;

      if (!activeConvId && userId) {
        try {
          const conv = await getOrCreateConversation(userId);
          activeConvId = conv?.id || conv?.conversation?.id;
          if (conv?.other_participant?.id) {
            resolvedOther = conv.other_participant.id;
            setOtherUserId(resolvedOther);
          }
          convIdRef.current = activeConvId;
        } catch (e) {
          console.error('[Chat] init:', e?.response?.data || e.message);
          setLoading(false);
          return;
        }
      }

      if (!activeConvId) { setLoading(false); return; }

      unsubRef.current = cable.subscribe('ChatChannel', { conversation_id: activeConvId }, (msg) => {
        if (msg.type === 'message') {
          setMessages((prev) => {
            const filtered = prev.filter(
              (m) => !(String(m.id).startsWith('temp_') && m.content === msg.message.content)
            );
            if (filtered.find((m) => m.id === msg.message.id)) return filtered;
            return [msg.message, ...filtered];
          });
        }
        if (msg.type === 'typing' && msg.user_id !== currentUser?.id) {
          setIsTyping(true);
          clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => setIsTyping(false), 2500);
        }
      });

      await Promise.all([loadMessages(activeConvId), loadInvitations(resolvedOther)]);
      markConversationRead(activeConvId).catch(() => {});
    };
    init();
    return () => {
      unsubRef.current?.();
      clearTimeout(typingTimer.current);
      clearTimeout(typingDebounce.current);
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
    } catch (e) { console.error('[Chat] loadMessages:', e); }
    finally { setLoading(false); }
  };

  const loadInvitations = async (resolvedOther) => {
    try {
      const data = await getInvitations();
      const list = Array.isArray(data) ? data : (data?.invitations || []);
      const other = resolvedOther || otherUserId || userId;
      const myId  = currentUser?.id;
      const relevant = list.filter((inv) => {
        const s = inv.sender_id, r = inv.user_id;
        if (!other) return s === myId || r === myId;
        return (s === myId && r === other) || (s === other && r === myId);
      });
      setInvitations(relevant);
    } catch (e) { console.error('[Chat] loadInvitations:', e); }
  };

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    Animated.sequence([
      Animated.timing(sendScale, { toValue: 0.78, duration: 55, useNativeDriver: true }),
      Animated.spring(sendScale, { toValue: 1, speed: 45, bounciness: 20, useNativeDriver: true }),
    ]).start();

    const tempId = `temp_${Date.now()}`;
    setMessages((prev) => [{
      id: tempId, content: text,
      user_id: currentUser?.id,
      created_at: new Date().toISOString(),
      pending: true,
      reply_to: replyTo ? { id: replyTo.id, content: replyTo.content, user_id: replyTo.user_id } : null,
    }, ...prev]);
    setInput('');
    setInputH(40);
    setReplyTo(null);
    setSending(true);

    try {
      const sent = await sendMessage(convIdRef.current, text);
      setMessages((prev) => prev.map((m) => m.id === tempId ? { ...sent, pending: false } : m));
    } catch {
      setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, pending: false, failed: true } : m));
    } finally {
      setSending(false);
    }
  };

  const handleRetry  = useCallback((msg) => {
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    setInput(msg.content);
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  const handleReply  = useCallback((msg) => {
    setReplyTo(msg);
    inputRef.current?.focus();
  }, []);

  const handleInputChange = (text) => {
    setInput(text);
    if (!convIdRef.current) return;
    if (typingDebounce.current) return;
    cable.perform('ChatChannel', { conversation_id: convIdRef.current }, 'typing', {});
    typingDebounce.current = setTimeout(() => { typingDebounce.current = null; }, 800);
  };

  const handleShareTask = async (reminder) => {
    setShowPicker(false);
    const other = otherUserId || userId;
    if (!other) return;
    try {
      const inv = await createInvitation({ reminder_id: reminder.id, user_id: other });
      setInvitations((prev) => [inv, ...prev]);
    } catch (e) { console.error('[Chat] shareTask:', e?.response?.data || e.message); }
  };

  const handleAccept = async (id) => {
    setActingInv(`acc_${id}`);
    try {
      await acceptInvitation(id);
      setInvitations((prev) => prev.map((i) => i.id === id ? { ...i, status: 'accepted' } : i));
    } catch (e) { console.error(e); }
    finally { setActingInv(null); }
  };

  const handleDecline = async (id) => {
    setActingInv(`dec_${id}`);
    try {
      await declineInvitation(id);
      setInvitations((prev) => prev.map((i) => i.id === id ? { ...i, status: 'declined' } : i));
    } catch (e) { console.error(e); }
    finally { setActingInv(null); }
  };

  const handleEditTask = useCallback((reminderId) => {
    // ReminderDetail lives in RemindersStack inside RemindersTab
    // We must navigate the parent tab navigator first
    navigation.getParent()?.navigate('RemindersTab', {
      screen: 'ReminderDetail',
      params: { id: reminderId },
    });
  }, [navigation]);

  // ── Merge feed ────────────────────────────────────────────────────────────
  const feedData = useMemo(() => {
    const invItems = invitations.map((inv) => ({ ...inv, _type: 'invitation' }));
    const msgItems = messages.map((m) => ({ ...m, _type: 'message' }));
    return [...invItems, ...msgItems].sort(
      (a, b) => new Date(b.created_at || b.updated_at || 0) - new Date(a.created_at || a.updated_at || 0)
    );
  }, [messages, invitations]);

  const renderItem = useCallback(({ item, index }) => {
    if (item._type === 'invitation') {
      const isMe = item.sender_id === currentUser?.id;
      return (
        <TaskCard
          inv={item} isMe={isMe} currentUserId={currentUser?.id}
          onAccept={handleAccept} onDecline={handleDecline}
          onEdit={handleEditTask} acting={actingInv}
        />
      );
    }
    const isMe       = item.user_id === currentUser?.id;
    const prev       = feedData[index + 1];
    const next       = feedData[index - 1];
    const showDate   = (!prev || prev._type === 'invitation' || !isSameDay(item.created_at, prev.created_at));
    const showAvatar = !isMe && (!next || next._type === 'invitation' || next.user_id !== item.user_id);
    const showTime   = !next || next._type === 'invitation' || next.user_id !== item.user_id ||
      (new Date(next.created_at) - new Date(item.created_at)) > 300_000;
    return (
      <>
        <Bubble
          msg={item} isMe={isMe} showTime={showTime}
          showAvatar={showAvatar} name={name}
          onRetry={item.failed ? () => handleRetry(item) : undefined}
          onReply={handleReply} currentUserId={currentUser?.id}
        />
        {showDate && <DateSep dateStr={item.created_at} />}
      </>
    );
  }, [feedData, currentUser, name, handleRetry, handleReply, actingInv, handleEditTask]);

  const pendingCount = invitations.filter((i) => !i.status || i.status === 'pending').length;
  const canSend      = input.trim().length > 0;
  const kavOffset    = insets.top + 64;

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        <Avatar name={name || '?'} size={40} online />

        <View style={s.headerMeta}>
          <Text style={s.headerName} numberOfLines={1}>{name || 'Chat'}</Text>
          <HeaderSub isTyping={isTyping} name={name} />
        </View>

        {/* Share task */}
        <TouchableOpacity style={s.iconBtnPrimary} onPress={() => setShowPicker(true)} hitSlop={8}>
          <Ionicons name="checkbox-outline" size={17} color={colors.primary} />
          {pendingCount > 0 && <View style={s.iconBadge}><Text style={s.iconBadgeTxt}>{pendingCount}</Text></View>}
        </TouchableOpacity>
        <TouchableOpacity style={s.iconBtn} hitSlop={8}>
          <Ionicons name="call-outline" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={s.iconBtn} hitSlop={8}>
          <Ionicons name="ellipsis-vertical" size={17} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ── KAV ── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={kavOffset}
      >
        {loading ? (
          <View style={s.center}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={s.loadTxt}>Loading messages…</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={feedData}
            keyExtractor={(item) => `${item._type}_${item.id}`}
            renderItem={renderItem}
            inverted
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onEndReached={() => hasMore && !loading && loadMessages(convIdRef.current, page + 1)}
            onEndReachedThreshold={0.5}
            contentContainerStyle={s.list}
            ListHeaderComponent={isTyping ? <TypingBubble name={name} /> : null}
            ListEmptyComponent={
              <View style={s.empty}>
                <View style={s.emptyIcon}>
                  <Ionicons name="chatbubbles-outline" size={32} color={colors.textMuted} />
                </View>
                <Text style={s.emptyTitle}>Start the conversation</Text>
                <Text style={s.emptySub}>Say hello to {name?.split(' ')[0] || 'them'} 👋</Text>
              </View>
            }
          />
        )}

        {replyTo && (
          <ReplyPreview replyTo={replyTo} onCancel={() => setReplyTo(null)} currentUserId={currentUser?.id} />
        )}

        {/* ── Input ── */}
        <View style={[s.bar, inputFocus && s.barActive, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <TouchableOpacity style={s.attachBtn} onPress={() => setShowPicker(true)} hitSlop={8}>
            <Ionicons name="add-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={[s.pill, inputFocus && s.pillActive, { minHeight: Math.max(44, inputH + 12) }]}>
            <TextInput
              ref={inputRef}
              style={[s.input, { height: Math.max(22, Math.min(inputH, 120)) }]}
              value={input}
              onChangeText={handleInputChange}
              onContentSizeChange={(e) => setInputH(e.nativeEvent.contentSize.height)}
              onFocus={() => setInputFocus(true)}
              onBlur={() => setInputFocus(false)}
              placeholder={replyTo ? 'Reply…' : 'Message…'}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={2000}
              selectionColor={colors.primary}
            />
            <TouchableOpacity style={s.emojiBtn} hitSlop={8}>
              <Ionicons name="happy-outline" size={20} color={inputFocus ? colors.primary : colors.textMuted} />
            </TouchableOpacity>
          </View>

          {canSend ? (
            <Animated.View style={{ transform: [{ scale: sendScale }] }}>
              <TouchableOpacity style={s.sendBtn} onPress={handleSend} disabled={sending} activeOpacity={0.85}>
                {sending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="arrow-up" size={20} color="#fff" />
                }
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <TouchableOpacity style={s.micBtn} hitSlop={8}>
              <Ionicons name="mic-outline" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      <TaskPicker visible={showPicker} onClose={() => setShowPicker(false)} onSelect={handleShareTask} />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: colors.bg },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadTxt:   { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingBottom: 12,
    backgroundColor: colors.bg,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    gap: 8,
  },
  backBtn:   { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerMeta:{ flex: 1, paddingLeft: 2 },
  headerName:{ fontFamily: fonts.sansMedium, fontSize: 15, color: colors.textPrimary },
  iconBtn:   { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.bgInput, alignItems: 'center', justifyContent: 'center' },
  iconBtnPrimary: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  iconBadge: { position: 'absolute', top: -3, right: -3, backgroundColor: colors.error, borderRadius: 7, minWidth: 14, height: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: colors.bg },
  iconBadgeTxt: { fontFamily: fonts.sansMedium, fontSize: 8, color: '#fff' },

  list:       { paddingTop: 16, paddingBottom: 10 },
  empty:      { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyIcon:  { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: fonts.sansMedium, fontSize: 17, color: colors.textPrimary },
  emptySub:   { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted },

  bar: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: '#fff', gap: 6,
  },
  barActive:   { borderTopColor: colors.primary + '40' },
  attachBtn:   { width: 42, height: 44, alignItems: 'center', justifyContent: 'center' },
  pill: {
    flex: 1, flexDirection: 'row', alignItems: 'flex-end',
    backgroundColor: colors.bgInput, borderRadius: 24,
    borderWidth: 1.5, borderColor: colors.border,
    paddingLeft: 14, paddingRight: 4,
    paddingTop:    Platform.OS === 'ios' ? 11 : 6,
    paddingBottom: Platform.OS === 'ios' ? 11 : 6,
  },
  pillActive:  { borderColor: colors.primary, backgroundColor: '#fff' },
  input: {
    flex: 1, fontFamily: fonts.sans, fontSize: 15,
    color: colors.textPrimary, padding: 0, lineHeight: 22,
    textAlignVertical: 'center',
  },
  emojiBtn:  { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', marginBottom: Platform.OS === 'ios' ? -1 : 0 },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
  },
  micBtn: { width: 42, height: 44, alignItems: 'center', justifyContent: 'center' },
});