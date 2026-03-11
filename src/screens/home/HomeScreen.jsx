// src/screens/home/HomeScreen.jsx
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Animated, RefreshControl, Dimensions, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import useAuthStore from '../../store/authStore';
import { colors, fonts, spacing, radius, shadows } from '../../theme';
import { getReminders, computeStats } from '../../api/reminders';

const { width: W } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens — override / extend theme for this screen
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  // Warm cream base
  cream:      '#FAF8F5',
  creamDeep:  '#F2EEE8',
  creamBorder:'rgba(0,0,0,0.07)',

  // Stone text scale
  ink:        '#1C1917',
  inkMid:     '#57534E',
  inkLight:   '#A8A29E',
  inkGhost:   '#D6D3D1',

  // Accent — forest sage
  sage:       '#4A7C59',
  sageMid:    '#6B9E78',
  sageLight:  '#EAF2EC',
  sageFaint:  '#F3F8F4',

  // Status
  ember:      '#C2500A',
  emberLight: '#FEF3EC',
  sky:        '#2563EB',
  skyLight:   '#EFF6FF',
  rose:       '#BE185D',
  roseLight:  '#FDF2F8',

  // Surface
  white:      '#FFFFFF',
  cardBg:     '#FFFFFF',
  inputBg:    '#F5F2EE',

  // Shadows
  shadowColor:'#1C1917',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function getDaysInMonth(year, month) {
  const days = [];
  const total = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= total; d++) days.push(new Date(year, month, d));
  return days;
}
function pad(n) { return String(n).padStart(2, '0'); }

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 5)  return 'Still up?';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
};

/**
 * Converts a date string / Date object → human-readable relative string.
 * e.g.  "just now" / "5 min ago" / "2 hours ago" / "Yesterday" / "3 days ago" / "Mar 4"
 */
function relativeTime(dateInput) {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';
  const now  = new Date();
  const diff = now - date; // ms, positive = past

  if (diff < 0)                      return 'upcoming';
  if (diff < 60_000)                 return 'just now';
  if (diff < 3_600_000) {
    const m = Math.floor(diff / 60_000);
    return `${m} min ago`;
  }
  if (diff < 86_400_000) {
    const h = Math.floor(diff / 3_600_000);
    return `${h} hour${h > 1 ? 's' : ''} ago`;
  }

  // Calendar-day comparison
  const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
  const dateStart  = new Date(date); dateStart.setHours(0,0,0,0);
  const dayDiff    = Math.round((todayStart - dateStart) / 86_400_000);

  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff < 7)   return `${dayDiff} days ago`;
  if (dayDiff < 30)  return `${Math.floor(dayDiff / 7)} week${Math.floor(dayDiff / 7) > 1 ? 's' : ''} ago`;
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

function fmtTime(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function fmtShortDate(date) {
  const d = new Date(date);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** Compute a 0-100 "productivity score" from stats */
function productivityScore(stats) {
  if (!stats.total) return 0;
  const completionRate = stats.completed / stats.total;
  const overduePenalty = Math.min(stats.overdue / Math.max(stats.total, 1), 0.5);
  return Math.round(Math.max(0, (completionRate - overduePenalty) * 100));
}

/** Return a color + label for the score */
function scoreTheme(score) {
  if (score >= 80) return { color: T.sage,  label: 'Excellent', bg: T.sageLight };
  if (score >= 55) return { color: '#B45309', label: 'Good',      bg: '#FEF9EC' };
  if (score >= 30) return { color: T.ember,  label: 'Fair',       bg: T.emberLight };
  return                   { color: T.rose,  label: 'Needs work', bg: T.roseLight };
}

// ─────────────────────────────────────────────────────────────────────────────
// AnimatedEntrance — stagger-fades children in on mount
// ─────────────────────────────────────────────────────────────────────────────
function Entrance({ children, delay = 0, from = 18 }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      delay,
      useNativeDriver: true,
      tension: 60,
      friction: 10,
    }).start();
  }, []);
  return (
    <Animated.View style={{
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0,1], outputRange: [from, 0] }) }],
    }}>
      {children}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pill badge
// ─────────────────────────────────────────────────────────────────────────────
function Pill({ children, color = T.sage, bg = T.sageLight, size = 11 }) {
  return (
    <View style={[p.pill, { backgroundColor: bg }]}>
      <Text style={[p.pillTxt, { color, fontSize: size }]}>{children}</Text>
    </View>
  );
}
const p = StyleSheet.create({
  pill:    { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  pillTxt: { fontFamily: fonts.sansMedium, letterSpacing: 0.2, textTransform: 'capitalize' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Section heading
// ─────────────────────────────────────────────────────────────────────────────
function SectionHead({ title, badge, action, onAction }) {
  return (
    <View style={sh.row}>
      <View style={sh.left}>
        <Text style={sh.title}>{title}</Text>
        {badge != null && (
          <View style={sh.badge}><Text style={sh.badgeTxt}>{badge}</Text></View>
        )}
      </View>
      {action ? (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
          <Text style={sh.action}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
const sh = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 4 },
  left:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title:    { fontFamily: fonts.serif, fontSize: 16, color: T.ink, letterSpacing: -0.3 },
  badge:    { backgroundColor: T.creamDeep, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  badgeTxt: { fontFamily: fonts.sansMedium, fontSize: 11, color: T.inkMid },
  action:   { fontFamily: fonts.sansMedium, fontSize: 13, color: T.sage },
});

// ─────────────────────────────────────────────────────────────────────────────
// Divider
// ─────────────────────────────────────────────────────────────────────────────
const Divider = ({ mx = 16 }) => (
  <View style={{ height: 1, backgroundColor: T.creamBorder, marginHorizontal: mx }} />
);

// ─────────────────────────────────────────────────────────────────────────────
// Hero Banner
// ─────────────────────────────────────────────────────────────────────────────
function HeroBanner({ user, stats }) {
  const score    = productivityScore(stats);
  const theme    = scoreTheme(score);
  const firstName = user?.name?.split(' ')[0] || 'there';

  const arcAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(arcAnim, { toValue: score, duration: 1200, delay: 400, useNativeDriver: false }).start();
  }, [score]);

  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <Entrance delay={0}>
      <View style={hb.card}>
        {/* Subtle texture overlay */}
        <LinearGradient
          colors={['#FFFFFF', T.sageFaint]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          borderRadius={20}
        />
        {/* Decorative circle */}
        <View style={hb.decCircle} />

        <View style={hb.inner}>
          {/* Left */}
          <View style={hb.left}>
            <Text style={hb.greeting}>{getGreeting()}</Text>
            <Text style={hb.name}>{firstName} 👋</Text>
            <Text style={hb.date}>{dateStr}</Text>

            {/* Mini stats row */}
            <View style={hb.miniRow}>
              <View style={hb.miniStat}>
                <Text style={hb.miniNum}>{stats.total}</Text>
                <Text style={hb.miniLbl}>tasks</Text>
              </View>
              <View style={hb.miniDiv} />
              <View style={hb.miniStat}>
                <Text style={hb.miniNum}>{stats.today || 0}</Text>
                <Text style={hb.miniLbl}>today</Text>
              </View>
              <View style={hb.miniDiv} />
              <View style={hb.miniStat}>
                <Text style={[hb.miniNum, stats.overdue > 0 && { color: T.ember }]}>
                  {stats.overdue}
                </Text>
                <Text style={hb.miniLbl}>overdue</Text>
              </View>
            </View>
          </View>

          {/* Right — score ring */}
          <View style={hb.right}>
            <View style={hb.ring}>
              <View style={[hb.ringTrack, { borderColor: T.creamBorder }]} />
              {/* Score arc — CSS trick with overflow hidden half */}
              <View style={[hb.ringFill, {
                borderColor: theme.color,
                transform: [{ rotate: `${(score / 100) * 360}deg` }],
                opacity: score > 0 ? 1 : 0,
              }]} />
              <View style={hb.ringCenter}>
                <Text style={[hb.ringPct, { color: theme.color }]}>{score}</Text>
                <Text style={hb.ringLbl}>score</Text>
              </View>
            </View>
            <View style={[hb.scoreBadge, { backgroundColor: theme.bg }]}>
              <Text style={[hb.scoreBadgeTxt, { color: theme.color }]}>{theme.label}</Text>
            </View>
          </View>
        </View>
      </View>
    </Entrance>
  );
}
const hb = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.creamBorder,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: T.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  decCircle: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: T.sageLight,
    opacity: 0.5,
    top: -50,
    right: -50,
  },
  inner: { flexDirection: 'row', justifyContent: 'space-between', padding: 22 },
  left:  { flex: 1, justifyContent: 'center', gap: 4 },
  greeting: { fontFamily: fonts.sans, fontSize: 12, color: T.inkLight, letterSpacing: 0.2 },
  name:     { fontFamily: fonts.serifBold, fontSize: 26, color: T.ink, letterSpacing: -0.8, marginBottom: 2 },
  date:     { fontFamily: fonts.sans, fontSize: 12, color: T.inkLight },
  miniRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  miniStat: { alignItems: 'center', gap: 2 },
  miniNum:  { fontFamily: fonts.serifBold, fontSize: 18, color: T.ink, letterSpacing: -0.5 },
  miniLbl:  { fontFamily: fonts.sans, fontSize: 10, color: T.inkLight, textTransform: 'lowercase' },
  miniDiv:  { width: 1, height: 20, backgroundColor: T.creamBorder },
  right:    { alignItems: 'center', gap: 8, justifyContent: 'center' },
  ring:     { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  ringTrack:{ position: 'absolute', width: 78, height: 78, borderRadius: 39, borderWidth: 5 },
  ringFill: { position: 'absolute', width: 78, height: 78, borderRadius: 39, borderWidth: 5, borderTopColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: 'transparent' },
  ringCenter:{ alignItems: 'center' },
  ringPct:  { fontFamily: fonts.serifBold, fontSize: 20, letterSpacing: -0.5 },
  ringLbl:  { fontFamily: fonts.sans, fontSize: 9, color: T.inkLight, marginTop: -2 },
  scoreBadge:    { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  scoreBadgeTxt: { fontFamily: fonts.sansMedium, fontSize: 11 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Countdown Timer — editorial style
// ─────────────────────────────────────────────────────────────────────────────
function CountdownTimer({ targetDate, title }) {
  const [time, setTime] = useState({ d:0, h:0, m:0, s:0, past:false });

  useEffect(() => {
    const tick = () => {
      const diff = new Date(targetDate) - new Date();
      if (diff <= 0) { setTime({ d:0, h:0, m:0, s:0, past:true }); return; }
      setTime({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
        past: false,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  const TimeBlock = ({ value, label }) => (
    <View style={cd.block}>
      <View style={cd.numBox}>
        <Text style={cd.num}>{pad(value)}</Text>
      </View>
      <Text style={cd.lbl}>{label}</Text>
    </View>
  );

  return (
    <View style={cd.card}>
      {/* Left info */}
      <View style={cd.topRow}>
        <View style={[cd.liveDot, time.past && { backgroundColor: T.ember }]} />
        <Text style={cd.eventTitle} numberOfLines={1}>{title}</Text>
        {time.past && <Pill color={T.ember} bg={T.emberLight} size={10}>Overdue</Pill>}
      </View>
      {/* Countdown blocks */}
      <View style={cd.blocksRow}>
        <TimeBlock value={time.d} label="days" />
        <Text style={cd.sep}>:</Text>
        <TimeBlock value={time.h} label="hrs" />
        <Text style={cd.sep}>:</Text>
        <TimeBlock value={time.m} label="min" />
        <Text style={cd.sep}>:</Text>
        <TimeBlock value={time.s} label="sec" />
      </View>
      {/* Due date label */}
      <Text style={cd.dueStr}>
        Due {new Date(targetDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );
}
const cd = StyleSheet.create({
  card: {
    backgroundColor: T.ink,
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
    shadowColor: T.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 4,
  },
  topRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
  liveDot:   { width: 7, height: 7, borderRadius: 4, backgroundColor: T.sageMid },
  eventTitle:{ fontFamily: fonts.sansMedium, fontSize: 13, color: 'rgba(255,255,255,0.65)', flex: 1 },
  blocksRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 14 },
  block:     { alignItems: 'center', gap: 6 },
  numBox:    { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, width: 60, height: 60, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  num:       { fontFamily: fonts.serifBold, fontSize: 26, color: '#FFFFFF', letterSpacing: -0.5 },
  lbl:       { fontFamily: fonts.sans, fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.6 },
  sep:       { fontFamily: fonts.serifBold, fontSize: 20, color: 'rgba(255,255,255,0.15)', marginBottom: 16 },
  dueStr:    { fontFamily: fonts.sans, fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Calendar Strip
// ─────────────────────────────────────────────────────────────────────────────
function CalendarStrip({ reminders = [], onDaySelect, selectedDay }) {
  const scrollRef  = useRef(null);
  const today      = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const days = getDaysInMonth(viewYear, viewMonth);

  const reminderDates = useMemo(() => new Set(
    reminders.map((r) => r.due_date ? new Date(r.due_date).toDateString() : null).filter(Boolean)
  ), [reminders]);

  useEffect(() => {
    const idx = days.findIndex((d) => d.toDateString() === today.toDateString());
    if (idx > 2 && scrollRef.current) {
      setTimeout(() => scrollRef.current?.scrollTo({ x: idx * 62, animated: true }), 300);
    }
  }, [viewMonth]);

  const changeMonth = (dir) => {
    setViewMonth((m) => {
      const nm = m + dir;
      if (nm < 0)  { setViewYear((y) => y - 1); return 11; }
      if (nm > 11) { setViewYear((y) => y + 1); return 0; }
      return nm;
    });
  };

  return (
    <View style={cs.wrapper}>
      {/* Month nav */}
      <View style={cs.monthRow}>
        <TouchableOpacity onPress={() => changeMonth(-1)} style={cs.navBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={16} color={T.inkMid} />
        </TouchableOpacity>
        <Text style={cs.monthTxt}>{MONTHS[viewMonth]} {viewYear}</Text>
        <TouchableOpacity onPress={() => changeMonth(1)} style={cs.navBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-forward" size={16} color={T.inkMid} />
        </TouchableOpacity>
      </View>
      {/* Days */}
      <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={cs.strip}>
        {days.map((day, i) => {
          const isToday    = day.toDateString() === today.toDateString();
          const isSel      = selectedDay && day.toDateString() === selectedDay.toDateString();
          const hasRemind  = reminderDates.has(day.toDateString());
          return (
            <TouchableOpacity key={i} onPress={() => onDaySelect(day)} activeOpacity={0.7}
              style={[cs.col, isSel && cs.colSel, isToday && !isSel && cs.colToday]}>
              <Text style={[cs.dayName, isSel && cs.txtSel, isToday && !isSel && cs.txtToday]}>
                {DAYS[day.getDay()]}
              </Text>
              <Text style={[cs.dayNum, isSel && cs.txtSel, isToday && !isSel && cs.numToday]}>
                {day.getDate()}
              </Text>
              {hasRemind && (
                <View style={[cs.dot, isSel && cs.dotSel]} />
              )}
              {!hasRemind && <View style={{ height: 5 }} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
const cs = StyleSheet.create({
  wrapper:   { backgroundColor: T.cardBg, borderRadius: 18, borderWidth: 1, borderColor: T.creamBorder, paddingTop: 14, marginBottom: 12, overflow: 'hidden', shadowColor: T.shadowColor, shadowOffset:{width:0,height:1}, shadowOpacity:0.05, shadowRadius:8, elevation:1 },
  monthRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 },
  navBtn:    { width: 30, height: 30, borderRadius: 15, backgroundColor: T.creamDeep, alignItems: 'center', justifyContent: 'center' },
  monthTxt:  { fontFamily: fonts.sansMedium, fontSize: 14, color: T.ink },
  strip:     { paddingHorizontal: 12, paddingBottom: 14, gap: 4 },
  col:       { width: 54, alignItems: 'center', gap: 4, paddingVertical: 8, borderRadius: 14 },
  colSel:    { backgroundColor: T.ink },
  colToday:  { backgroundColor: T.sageLight },
  dayName:   { fontFamily: fonts.sans, fontSize: 10, color: T.inkLight, textTransform: 'uppercase', letterSpacing: 0.4 },
  dayNum:    { fontFamily: fonts.sansMedium, fontSize: 16, color: T.ink },
  numToday:  { color: T.sage },
  txtSel:    { color: '#FFFFFF' },
  txtToday:  { color: T.sage },
  dot:       { width: 5, height: 5, borderRadius: 3, backgroundColor: T.sage },
  dotSel:    { backgroundColor: 'rgba(255,255,255,0.5)' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Reminder Row
// ─────────────────────────────────────────────────────────────────────────────
function ReminderRow({ item, onPress }) {
  const pConfig = {
    high:   { color: T.ember, bg: T.emberLight },
    medium: { color: '#B45309', bg: '#FEF9EC' },
    low:    { color: T.sage,   bg: T.sageLight },
  }[item.priority?.toLowerCase()] || { color: T.inkLight, bg: T.creamDeep };

  const due = fmtTime(item.due_date);

  return (
    <TouchableOpacity style={rr.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[rr.accent, { backgroundColor: pConfig.color }]} />
      <View style={rr.info}>
        <Text style={[rr.title, item.completed && rr.done]} numberOfLines={1}>
          {item.title}
        </Text>
        {item.description ? (
          <Text style={rr.desc} numberOfLines={1}>{item.description}</Text>
        ) : null}
      </View>
      <View style={rr.right}>
        {due ? <Text style={rr.time}>{due}</Text> : null}
        <Pill color={pConfig.color} bg={pConfig.bg} size={10}>{item.priority || 'none'}</Pill>
        {item.completed && (
          <Ionicons name="checkmark-circle" size={14} color={T.sage} />
        )}
      </View>
    </TouchableOpacity>
  );
}
const rr = StyleSheet.create({
  row:   { flexDirection:'row', alignItems:'center', paddingVertical:12, paddingHorizontal:16, gap:10 },
  accent:{ width:3, height:34, borderRadius:2, flexShrink:0 },
  info:  { flex:1, gap:2 },
  title: { fontFamily:fonts.sansMedium, fontSize:14, color:T.ink },
  done:  { textDecorationLine:'line-through', color:T.inkLight },
  desc:  { fontFamily:fonts.sans, fontSize:12, color:T.inkLight },
  right: { alignItems:'flex-end', gap:4 },
  time:  { fontFamily:fonts.sans, fontSize:11, color:T.inkLight },
});

// ─────────────────────────────────────────────────────────────────────────────
// Quick Action
// ─────────────────────────────────────────────────────────────────────────────
function QAction({ icon, label, color, bg, onPress, delay = 0 }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, delay, useNativeDriver: true, tension: 55, friction: 8 }).start();
  }, []);

  const scale = useRef(new Animated.Value(1)).current;
  const press  = () => { Animated.sequence([Animated.spring(scale, { toValue: 0.93, useNativeDriver: true, speed: 50 }), Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 })]).start(); onPress?.(); };

  return (
    <Animated.View style={{ flex:1, opacity:anim, transform:[{scale:Animated.multiply(anim, scale)}] }}>
      <TouchableOpacity onPress={press} activeOpacity={1}>
        <View style={[qa.card, { backgroundColor: bg }]}>
          <View style={[qa.iconWrap, { backgroundColor: color + '18' }]}>
            <Ionicons name={icon} size={20} color={color} />
          </View>
          <Text style={[qa.lbl, { color }]}>{label}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const qa = StyleSheet.create({
  card:     { borderRadius:16, padding:14, alignItems:'center', gap:8, borderWidth:1, borderColor:'rgba(0,0,0,0.05)' },
  iconWrap: { width:42, height:42, borderRadius:21, alignItems:'center', justifyContent:'center' },
  lbl:      { fontFamily:fonts.sansMedium, fontSize:11, letterSpacing:0.1 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Insights strip — smart contextual cards
// ─────────────────────────────────────────────────────────────────────────────
function InsightsStrip({ stats, reminders }) {
  const insights = useMemo(() => {
    const out = [];
    const score = productivityScore(stats);

    if (stats.overdue > 0) out.push({
      icon: 'alert-circle-outline',
      color: T.ember,
      bg:    T.emberLight,
      text:  `${stats.overdue} reminder${stats.overdue > 1 ? 's' : ''} overdue`,
    });
    if (stats.completed > 0 && stats.total > 0) out.push({
      icon: 'trending-up-outline',
      color: T.sage,
      bg:    T.sageLight,
      text:  `${Math.round(stats.completed / stats.total * 100)}% completion rate`,
    });
    const todayCount = reminders.filter((r) =>
      r.due_date && new Date(r.due_date).toDateString() === new Date().toDateString() && !r.completed
    ).length;
    if (todayCount > 0) out.push({
      icon: 'calendar-outline',
      color: T.sky,
      bg:    T.skyLight,
      text:  `${todayCount} task${todayCount > 1 ? 's' : ''} due today`,
    });
    if (score >= 80) out.push({
      icon: 'star-outline',
      color: '#B45309',
      bg:    '#FFFBEB',
      text:  'Great streak! Keep it up.',
    });
    if (out.length === 0) out.push({
      icon: 'leaf-outline',
      color: T.sage,
      bg:    T.sageLight,
      text:  'All clear — enjoy your day.',
    });
    return out.slice(0, 3);
  }, [stats, reminders]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingRight: 20 }}
      style={{ marginBottom: 20, marginLeft: -20, paddingLeft: 20 }}>
      {insights.map((ins, i) => (
        <View key={i} style={[ins2.card, { backgroundColor: ins.bg }]}>
          <Ionicons name={ins.icon} size={14} color={ins.color} />
          <Text style={[ins2.txt, { color: ins.color }]}>{ins.text}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
const ins2 = StyleSheet.create({
  card: { flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:14, paddingVertical:9, borderRadius:99, borderWidth:1, borderColor:'rgba(0,0,0,0.05)' },
  txt:  { fontFamily:fonts.sansMedium, fontSize:12, letterSpacing:0.1 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Activity Item — with real relative timestamps
// ─────────────────────────────────────────────────────────────────────────────
function ActivityItem({ icon, iconColor, iconBg, title, sub, timestamp, showDivider }) {
  return (
    <>
      <View style={ai.row}>
        <View style={[ai.iconBox, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={15} color={iconColor} />
        </View>
        <View style={ai.info}>
          <Text style={ai.title}>{title}</Text>
          {sub ? <Text style={ai.sub} numberOfLines={1}>{sub}</Text> : null}
        </View>
        <Text style={ai.time}>{relativeTime(timestamp)}</Text>
      </View>
      {showDivider && <Divider />}
    </>
  );
}
const ai = StyleSheet.create({
  row:    { flexDirection:'row', alignItems:'center', gap:12, padding:14 },
  iconBox:{ width:34, height:34, borderRadius:10, alignItems:'center', justifyContent:'center', flexShrink:0 },
  info:   { flex:1 },
  title:  { fontFamily:fonts.sansMedium, fontSize:13, color:T.ink },
  sub:    { fontFamily:fonts.sans, fontSize:12, color:T.inkLight, marginTop:2 },
  time:   { fontFamily:fonts.sans, fontSize:11, color:T.inkLight },
});

// ─────────────────────────────────────────────────────────────────────────────
// Surface card
// ─────────────────────────────────────────────────────────────────────────────
const Card = ({ children, style }) => (
  <View style={[kd.card, style]}>{children}</View>
);
const kd = StyleSheet.create({
  card: {
    backgroundColor: T.cardBg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: T.creamBorder,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: T.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────
const EmptyDay = () => (
  <View style={ed.wrap}>
    <Text style={ed.emoji}>🌿</Text>
    <Text style={ed.title}>Nothing scheduled</Text>
    <Text style={ed.sub}>A clear slate — or add something new.</Text>
  </View>
);
const ed = StyleSheet.create({
  wrap:  { alignItems:'center', paddingVertical:28, gap:4 },
  emoji: { fontSize:28, marginBottom:6 },
  title: { fontFamily:fonts.serif, fontSize:15, color:T.ink },
  sub:   { fontFamily:fonts.sans, fontSize:12, color:T.inkLight },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main HomeScreen
// ─────────────────────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const user   = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [reminders,   setReminders]   = useState([]);
  const [refreshing,  setRefreshing]  = useState(false);
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [stats,       setStats]       = useState({ total:0, today:0, completed:0, overdue:0 });
  const [error,       setError]       = useState(null);
  const [activities,  setActivities]  = useState([]);

  const scrollY  = useRef(new Animated.Value(0)).current;
  const hdrOpacity = scrollY.interpolate({ inputRange:[0,90], outputRange:[0,1], extrapolate:'clamp' });

  // ── Build activity log from reminders ──────────────────────────────────────
  const buildActivities = useCallback((list) => {
    const acts = [];

    // Static account events — use user.created_at / user.confirmed_at if available
    if (user?.confirmed_at || user?.created_at) {
      acts.push({
        key: 'email_verified',
        icon: 'shield-checkmark-outline',
        iconColor: T.sage,
        iconBg:    T.sageLight,
        title: 'Email verified',
        sub:   user.email || '',
        timestamp: user.confirmed_at || user.created_at,
      });
    }
    if (user?.created_at) {
      acts.push({
        key: 'account_created',
        icon: 'person-add-outline',
        iconColor: T.sky,
        iconBg:    T.skyLight,
        title: 'Account created',
        sub:   `Welcome, ${user.name?.split(' ')[0] || 'there'}!`,
        timestamp: user.created_at,
      });
    }

    // Completed reminders
    list
      .filter((r) => r.completed && (r.completed_at || r.updated_at))
      .slice(0, 5)
      .forEach((r) => {
        acts.push({
          key: `done_${r.id}`,
          icon: 'checkmark-circle-outline',
          iconColor: T.sage,
          iconBg:    T.sageLight,
          title: 'Reminder completed',
          sub:   r.title,
          timestamp: r.completed_at || r.updated_at,
        });
      });

    // Recently created reminders
    list
      .filter((r) => r.created_at)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 4)
      .forEach((r) => {
        acts.push({
          key: `created_${r.id}`,
          icon: 'add-circle-outline',
          iconColor: '#6366F1',
          iconBg:    '#EEF2FF',
          title: 'Reminder created',
          sub:   r.title,
          timestamp: r.created_at,
        });
      });

    // Overdue reminders
    list
      .filter((r) => !r.completed && r.due_date && new Date(r.due_date) < new Date())
      .slice(0, 3)
      .forEach((r) => {
        acts.push({
          key: `overdue_${r.id}`,
          icon: 'alert-circle-outline',
          iconColor: T.ember,
          iconBg:    T.emberLight,
          title: 'Reminder overdue',
          sub:   r.title,
          timestamp: r.due_date,
        });
      });

    // Sort all by timestamp desc, dedupe by key
    const seen = new Set();
    const sorted = acts
      .filter((a) => { if (seen.has(a.key)) return false; seen.add(a.key); return true; })
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

    setActivities(sorted.slice(0, 8));
  }, [user]);

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      setError(null);
      const data = await getReminders();
      const list = Array.isArray(data) ? data : (data?.reminders || data?.data || []);
      setReminders(list);
      setStats(computeStats(list));
      buildActivities(list);
    } catch (e) {
      console.error('Home load error:', e);
      setError('Could not load reminders');
    }
  }, [buildActivities]);

  useEffect(() => { loadData(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const dayReminders = useMemo(() => reminders.filter((r) =>
    r.due_date && new Date(r.due_date).toDateString() === selectedDay.toDateString()
  ), [reminders, selectedDay]);

  const nextReminder = useMemo(() => reminders
    .filter((r) => r.due_date && !r.completed && new Date(r.due_date) > new Date())
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0]
  , [reminders]);

  const isToday = selectedDay.toDateString() === new Date().toDateString();
  const dayLabel = isToday ? 'Today'
    : selectedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={T.cream} />

      {/* Sticky floating header (appears on scroll) */}
      <Animated.View style={[styles.stickyHdr, { opacity: hdrOpacity }]}>
        <Text style={styles.stickyLogo}>remind</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.stickyAv}>
          <Text style={styles.stickyAvTxt}>{user?.name?.[0]?.toUpperCase() || '?'}</Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.sage} colors={[T.sage]} />}
      >
        {/* ── Top bar ──────────────────────────────────────────────────── */}
        <View style={styles.topBar}>
          <View style={styles.logoRow}>
            <View style={styles.logoMark}>
              <View style={styles.logoRing} />
              <View style={styles.logoDot} />
            </View>
            <Text style={styles.logoWord}>remind</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.avWrap}>
            <View style={styles.av}>
              <Text style={styles.avTxt}>{user?.name?.[0]?.toUpperCase() || '?'}</Text>
            </View>
            <View style={styles.onlineDot} />
          </TouchableOpacity>
        </View>

        {/* ── Error banner ─────────────────────────────────────────────── */}
        {error ? (
          <TouchableOpacity style={styles.errBanner} onPress={loadData} activeOpacity={0.8}>
            <Ionicons name="alert-circle-outline" size={15} color={T.ember} />
            <Text style={styles.errTxt}>{error} · Tap to retry</Text>
          </TouchableOpacity>
        ) : null}

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <HeroBanner user={user} stats={stats} />

        {/* ── Insights strip ───────────────────────────────────────────── */}
        <Entrance delay={80}>
          <InsightsStrip stats={stats} reminders={reminders} />
        </Entrance>

        {/* ── Next Up countdown ────────────────────────────────────────── */}
        <Entrance delay={120}>
          <SectionHead title="Next Up" />
          {nextReminder ? (
            <CountdownTimer targetDate={nextReminder.due_date} title={nextReminder.title} />
          ) : (
            <Card style={{ padding:20, marginBottom:20 }}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
                <Ionicons name="timer-outline" size={20} color={T.inkGhost} />
                <Text style={{ fontFamily:fonts.sans, fontSize:13, color:T.inkLight }}>
                  No upcoming reminders
                </Text>
              </View>
            </Card>
          )}
        </Entrance>

        {/* ── Calendar ─────────────────────────────────────────────────── */}
        <Entrance delay={160}>
          <SectionHead
            title="Calendar"
            action={!isToday ? 'Today' : null}
            onAction={() => setSelectedDay(new Date())}
          />
          <CalendarStrip reminders={reminders} selectedDay={selectedDay} onDaySelect={setSelectedDay} />

          {/* Day header */}
          <View style={styles.dayHdr}>
            <Text style={styles.dayHdrTxt}>{dayLabel}</Text>
            <View style={styles.dayCount}>
              <Text style={styles.dayCountTxt}>{dayReminders.length}</Text>
            </View>
          </View>

          {/* Day reminders card */}
          <Card style={{ marginBottom:20 }}>
            {dayReminders.length > 0 ? (
              dayReminders.map((r, i) => (
                <View key={r.id || i}>
                  <ReminderRow
                    item={r}
                    onPress={() => navigation.navigate('RemindersTab', {
                      screen: 'ReminderDetail', params: { id: r.id },
                    })}
                  />
                  {i < dayReminders.length - 1 && <Divider />}
                </View>
              ))
            ) : (
              <EmptyDay />
            )}
          </Card>
        </Entrance>

        {/* ── Quick Actions ─────────────────────────────────────────────── */}
        <Entrance delay={200}>
          <SectionHead title="Quick Actions" />
          <View style={styles.qaRow}>
            <QAction icon="add-circle" label="Reminder" color={T.sage}  bg={T.sageLight}
              delay={0}   onPress={() => navigation.navigate('RemindersTab', { screen:'CreateReminder' })} />
            <QAction icon="people"     label="Friends"  color={T.sky}   bg={T.skyLight}
              delay={60}  onPress={() => navigation.navigate('SocialTab')} />
            <QAction icon="business"   label="Orgs"     color="#7C3AED" bg="#F5F3FF"
              delay={120} onPress={() => navigation.navigate('OrganizationsTab')} />
            <QAction icon="document-text" label="Notes" color="#B45309" bg="#FFFBEB"
              delay={180} onPress={() => navigation.navigate('RemindersTab', { screen:'Notes' })} />
          </View>
        </Entrance>

        {/* ── Progress strip ───────────────────────────────────────────── */}
        <Entrance delay={220}>
          <SectionHead title="Progress" />
          <Card style={{ padding:16, marginBottom:20 }}>
            {[
              { label:'Completed', value:stats.completed, total:stats.total, color:T.sage },
              { label:'Overdue',   value:stats.overdue,   total:stats.total, color:T.ember },
              { label:"Today's",   value:stats.today||0,  total:stats.total, color:T.sky },
            ].map(({ label, value, total, color }, i, arr) => {
              const pct = total > 0 ? Math.min(value / total, 1) : 0;
              return (
                <View key={label}>
                  <View style={pr.row}>
                    <Text style={pr.lbl}>{label}</Text>
                    <Text style={[pr.val, { color }]}>{value} <Text style={pr.of}>/ {total}</Text></Text>
                  </View>
                  <View style={pr.track}>
                    <View style={[pr.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
                  </View>
                  {i < arr.length - 1 && <View style={{ height:12 }} />}
                </View>
              );
            })}
          </Card>
        </Entrance>

        {/* ── Recent Activity ──────────────────────────────────────────── */}
        <Entrance delay={260}>
          <SectionHead title="Recent Activity" badge={activities.length} />
          <Card style={{ marginBottom:20 }}>
            {activities.length === 0 ? (
              <View style={{ padding:20, alignItems:'center' }}>
                <Text style={{ fontFamily:fonts.sans, fontSize:13, color:T.inkLight }}>No activity yet</Text>
              </View>
            ) : (
              activities.map((act, i) => (
                <ActivityItem
                  key={act.key}
                  icon={act.icon}
                  iconColor={act.iconColor}
                  iconBg={act.iconBg}
                  title={act.title}
                  sub={act.sub}
                  timestamp={act.timestamp}
                  showDivider={i < activities.length - 1}
                />
              ))
            )}
          </Card>
        </Entrance>

        {/* ── Sign out ─────────────────────────────────────────────────── */}
        <TouchableOpacity style={styles.signOut} onPress={logout} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={14} color={T.inkLight} />
          <Text style={styles.signOutTxt}>Sign out</Text>
        </TouchableOpacity>
        <View style={{ height: 100 }} />
      </Animated.ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress bar styles
// ─────────────────────────────────────────────────────────────────────────────
const pr = StyleSheet.create({
  row:   { flexDirection:'row', justifyContent:'space-between', marginBottom:6 },
  lbl:   { fontFamily:fonts.sans, fontSize:12, color:T.inkMid },
  val:   { fontFamily:fonts.sansMedium, fontSize:12 },
  of:    { color:T.inkLight, fontFamily:fonts.sans },
  track: { height:5, backgroundColor:T.creamDeep, borderRadius:99, overflow:'hidden' },
  fill:  { height:5, borderRadius:99 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Screen-level styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex:1, backgroundColor:T.cream },
  scroll: { paddingHorizontal:20, paddingTop:Platform.OS === 'ios' ? 60 : 50 },

  // Sticky header
  stickyHdr: {
    position:'absolute', top:0, left:0, right:0, zIndex:100,
    backgroundColor:T.cream,
    borderBottomWidth:1, borderBottomColor:T.creamBorder,
    flexDirection:'row', justifyContent:'space-between', alignItems:'center',
    paddingHorizontal:20,
    paddingTop: Platform.OS === 'ios' ? 54 : 18,
    paddingBottom:12,
  },
  stickyLogo:  { fontFamily:fonts.serifBold, fontSize:18, color:T.ink, letterSpacing:-0.4 },
  stickyAv:    { width:30, height:30, borderRadius:15, backgroundColor:T.sageLight, borderWidth:1.5, borderColor:T.sage, alignItems:'center', justifyContent:'center' },
  stickyAvTxt: { fontFamily:fonts.serifBold, fontSize:12, color:T.sage },

  // Top bar
  topBar:  { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:20 },
  logoRow: { flexDirection:'row', alignItems:'center', gap:8 },
  logoMark:{ width:30, height:30, alignItems:'center', justifyContent:'center' },
  logoRing:{ position:'absolute', width:30, height:30, borderRadius:15, borderWidth:2, borderColor:T.sage },
  logoDot: { position:'absolute', width:8, height:8, borderRadius:4, backgroundColor:T.sage },
  logoWord:{ fontFamily:fonts.serifBold, fontSize:22, color:T.ink, letterSpacing:-0.5 },
  avWrap:  { position:'relative' },
  av:      { width:44, height:44, borderRadius:22, backgroundColor:T.sageLight, borderWidth:2, borderColor:T.sage, alignItems:'center', justifyContent:'center' },
  avTxt:   { fontFamily:fonts.serifBold, fontSize:18, color:T.sage },
  onlineDot:{ position:'absolute', bottom:1, right:1, width:11, height:11, borderRadius:6, backgroundColor:'#34D399', borderWidth:2, borderColor:T.cream },

  // Error
  errBanner: { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:T.emberLight, borderRadius:12, padding:12, marginBottom:16, borderWidth:1, borderColor:'#FECACA' },
  errTxt:    { fontFamily:fonts.sans, fontSize:13, color:T.ember, flex:1 },

  // Day header
  dayHdr:     { flexDirection:'row', alignItems:'center', gap:8, marginBottom:8, marginTop:4 },
  dayHdrTxt:  { fontFamily:fonts.sansMedium, fontSize:14, color:T.ink },
  dayCount:   { backgroundColor:T.sageLight, borderRadius:99, width:22, height:22, alignItems:'center', justifyContent:'center' },
  dayCountTxt:{ fontFamily:fonts.sansMedium, fontSize:11, color:T.sage },

  // Quick action row
  qaRow: { flexDirection:'row', gap:8, marginBottom:20 },

  // Sign out
  signOut:    { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, paddingVertical:14 },
  signOutTxt: { fontFamily:fonts.sans, fontSize:13, color:T.inkLight },
});
// /// src/screens/home/HomeScreen.jsx
// import React, { useEffect, useRef, useState, useCallback } from 'react';
// import {
//   View, Text, StyleSheet, ScrollView, TouchableOpacity,
//   StatusBar, Animated, RefreshControl, Dimensions,
// } from 'react-native';
// import Ionicons from '@expo/vector-icons/Ionicons';
// import useAuthStore from '../../store/authStore';
// import { colors, fonts, spacing, radius, shadows } from '../../theme';
// import { getReminders, computeStats } from '../../api/reminders';

// const { width: W } = Dimensions.get('window');

// const getGreeting = () => {
//   const h = new Date().getHours();
//   if (h < 12) return 'Good morning';
//   if (h < 17) return 'Good afternoon';
//   return 'Good evening';
// };

// const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
// const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// function getDaysInMonth(year, month) {
//   const days = [];
//   const total = new Date(year, month + 1, 0).getDate();
//   for (let d = 1; d <= total; d++) days.push(new Date(year, month, d));
//   return days;
// }
// function pad(n) { return String(n).padStart(2, '0'); }

// // ── Countdown Timer ───────────────────────────────────────────────────────────
// function CountdownTimer({ targetDate, title }) {
//   const [time, setTime] = useState({ d: 0, h: 0, m: 0, s: 0, past: false });
//   const pulseAnim = useRef(new Animated.Value(1)).current;

//   useEffect(() => {
//     const loop = Animated.loop(
//       Animated.sequence([
//         Animated.timing(pulseAnim, { toValue: 1.04, duration: 800, useNativeDriver: false }),
//         Animated.timing(pulseAnim, { toValue: 1,    duration: 800, useNativeDriver: false }),
//       ])
//     );
//     loop.start();
//     return () => loop.stop();
//   }, []);

//   useEffect(() => {
//     const tick = () => {
//       const diff = new Date(targetDate) - new Date();
//       if (diff <= 0) { setTime({ d:0, h:0, m:0, s:0, past: true }); return; }
//       setTime({
//         d: Math.floor(diff / 86400000),
//         h: Math.floor((diff % 86400000) / 3600000),
//         m: Math.floor((diff % 3600000) / 60000),
//         s: Math.floor((diff % 60000) / 1000),
//         past: false,
//       });
//     };
//     tick();
//     const id = setInterval(tick, 1000);
//     return () => clearInterval(id);
//   }, [targetDate]);

//   const TimeBlock = ({ value, label }) => (
//     <View style={cds.block}>
//       <Animated.View style={[cds.numWrap, { transform: [{ scale: pulseAnim }] }]}>
//         <Text style={cds.num}>{pad(value)}</Text>
//       </Animated.View>
//       <Text style={cds.unit}>{label}</Text>
//     </View>
//   );

//   return (
//     <View style={cds.container}>
//       <View style={cds.header}>
//         <View style={cds.dot} />
//         <Text style={cds.label} numberOfLines={1}>{title}</Text>
//         {time.past && <View style={cds.pastBadge}><Text style={cds.pastText}>Due</Text></View>}
//       </View>
//       <View style={cds.row}>
//         <TimeBlock value={time.d} label="days" />
//         <Text style={cds.colon}>:</Text>
//         <TimeBlock value={time.h} label="hrs" />
//         <Text style={cds.colon}>:</Text>
//         <TimeBlock value={time.m} label="min" />
//         <Text style={cds.colon}>:</Text>
//         <TimeBlock value={time.s} label="sec" />
//       </View>
//     </View>
//   );
// }

// // ── Calendar Strip ────────────────────────────────────────────────────────────
// function CalendarStrip({ reminders = [], onDaySelect, selectedDay }) {
//   const scrollRef = useRef(null);
//   const today = new Date();
//   const [viewMonth, setViewMonth] = useState(today.getMonth());
//   const [viewYear,  setViewYear]  = useState(today.getFullYear());
//   const days = getDaysInMonth(viewYear, viewMonth);

//   const reminderDates = new Set(
//     reminders.map((r) => r.due_date ? new Date(r.due_date).toDateString() : null).filter(Boolean)
//   );

//   useEffect(() => {
//     const todayIndex = days.findIndex((d) => d.toDateString() === today.toDateString());
//     if (todayIndex > 2 && scrollRef.current) {
//       setTimeout(() => scrollRef.current?.scrollTo({ x: todayIndex * 60, animated: true }), 300);
//     }
//   }, []);

//   const prevMonth = () => {
//     if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
//     else setViewMonth((m) => m - 1);
//   };
//   const nextMonth = () => {
//     if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
//     else setViewMonth((m) => m + 1);
//   };

//   return (
//     <View style={cal.wrapper}>
//       <View style={cal.monthRow}>
//         <TouchableOpacity onPress={prevMonth} style={cal.monthBtn}>
//           <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
//         </TouchableOpacity>
//         <Text style={cal.monthLabel}>{MONTHS[viewMonth]} {viewYear}</Text>
//         <TouchableOpacity onPress={nextMonth} style={cal.monthBtn}>
//           <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
//         </TouchableOpacity>
//       </View>
//       <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={cal.dayScroll}>
//         {days.map((day, i) => {
//           const isToday     = day.toDateString() === today.toDateString();
//           const isSelected  = selectedDay && day.toDateString() === selectedDay.toDateString();
//           const hasReminder = reminderDates.has(day.toDateString());
//           return (
//             <TouchableOpacity
//               key={i}
//               onPress={() => onDaySelect(day)}
//               style={[cal.dayCol, isSelected && cal.dayColSelected, isToday && !isSelected && cal.dayColToday]}
//               activeOpacity={0.75}
//             >
//               <Text style={[cal.dayName, isSelected && cal.dayNameSelected]}>{DAYS[day.getDay()]}</Text>
//               <Text style={[cal.dayNum, isSelected && cal.dayNumSelected, isToday && !isSelected && cal.dayNumToday]}>
//                 {day.getDate()}
//               </Text>
//               {hasReminder
//                 ? <View style={[cal.reminderDot, isSelected && cal.reminderDotSelected]} />
//                 : <View style={cal.reminderDotPlaceholder} />
//               }
//             </TouchableOpacity>
//           );
//         })}
//       </ScrollView>
//     </View>
//   );
// }

// // ── Section Header ────────────────────────────────────────────────────────────
// function SectionHeader({ title, action, onAction }) {
//   return (
//     <View style={styles.sectionHeader}>
//       <View style={styles.sectionTitleRow}>
//         <View style={styles.sectionBar} />
//         <Text style={styles.sectionTitle}>{title}</Text>
//       </View>
//       {action ? (
//         <TouchableOpacity onPress={onAction}>
//           <Text style={styles.sectionAction}>{action}</Text>
//         </TouchableOpacity>
//       ) : null}
//     </View>
//   );
// }

// // ── Reminder Row ──────────────────────────────────────────────────────────────
// function ReminderRow({ item, onPress }) {
//   const p = {
//     high:   { color: '#FF6B6B', bg: '#FFF0F0' },
//     medium: { color: '#E09F3E', bg: '#FFF8EC' },
//     low:    { color: colors.primary, bg: colors.primaryLight },
//   }[item.priority?.toLowerCase()] || { color: colors.textMuted, bg: colors.bgInput };

//   const due = item.due_date
//     ? new Date(item.due_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
//     : null;

//   return (
//     <TouchableOpacity style={styles.reminderRow} onPress={onPress} activeOpacity={0.75}>
//       <View style={[styles.reminderAccent, { backgroundColor: p.color }]} />
//       <View style={styles.reminderInfo}>
//         <Text style={[styles.reminderTitle, item.completed && styles.reminderDone]} numberOfLines={1}>
//           {item.title}
//         </Text>
//         {item.description ? (
//           <Text style={styles.reminderDesc} numberOfLines={1}>{item.description}</Text>
//         ) : null}
//       </View>
//       <View style={styles.reminderRight}>
//         {due ? <Text style={styles.reminderTime}>{due}</Text> : null}
//         <View style={[styles.priorityChip, { backgroundColor: p.bg }]}>
//           <Text style={[styles.priorityChipText, { color: p.color }]}>{item.priority || 'none'}</Text>
//         </View>
//       </View>
//     </TouchableOpacity>
//   );
// }

// // ── Quick Action ──────────────────────────────────────────────────────────────
// function QuickAction({ icon, label, color, bg, onPress, delay = 0 }) {
//   const anim = useRef(new Animated.Value(0)).current;
//   useEffect(() => {
//     Animated.spring(anim, { toValue: 1, delay, useNativeDriver: false, speed: 14, bounciness: 8 }).start();
//   }, []);
//   return (
//     <Animated.View style={{ flex: 1, opacity: anim, transform: [{ scale: anim.interpolate({ inputRange:[0,1], outputRange:[0.85,1] }) }] }}>
//       <TouchableOpacity style={[styles.qaCard, { borderTopColor: color, borderTopWidth: 3 }]} onPress={onPress} activeOpacity={0.8}>
//         <View style={[styles.qaIcon, { backgroundColor: bg }]}>
//           <Ionicons name={icon} size={22} color={color} />
//         </View>
//         <Text style={styles.qaLabel}>{label}</Text>
//       </TouchableOpacity>
//     </Animated.View>
//   );
// }

// // ── Hero Banner ───────────────────────────────────────────────────────────────
// function HeroBanner({ user, stats }) {
//   const anim = useRef(new Animated.Value(0)).current;
//   useEffect(() => {
//     Animated.timing(anim, { toValue: 1, duration: 600, useNativeDriver: false }).start();
//   }, []);

//   const rate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
//   const firstName = user?.name?.split(' ')[0] || 'there';

//   return (
//     <Animated.View style={[styles.hero, { opacity: anim }]}>
//       <View style={styles.heroLeft}>
//         <Text style={styles.heroGreeting}>{getGreeting()}</Text>
//         <Text style={styles.heroName}>{firstName} 👋</Text>
//         <View style={styles.heroChip}>
//           <View style={styles.heroChipDot} />
//           <Text style={styles.heroChipText}>
//             {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
//           </Text>
//         </View>
//       </View>
//       <View style={styles.heroRight}>
//         <View style={styles.ring}>
//           <View style={styles.ringInner}>
//             <Text style={styles.ringPct}>{rate}%</Text>
//             <Text style={styles.ringLabel}>done</Text>
//           </View>
//           <View style={[styles.ringArc, { opacity: rate > 0 ? 1 : 0.2 }]} />
//         </View>
//         <View style={styles.heroMiniStats}>
//           <View style={styles.heroMiniStat}>
//             <Text style={styles.heroMiniNum}>{stats.total}</Text>
//             <Text style={styles.heroMiniLabel}>total</Text>
//           </View>
//           <View style={styles.heroMiniDivider} />
//           <View style={styles.heroMiniStat}>
//             <Text style={[styles.heroMiniNum, stats.overdue > 0 && { color: '#FF6B6B' }]}>{stats.overdue}</Text>
//             <Text style={styles.heroMiniLabel}>overdue</Text>
//           </View>
//         </View>
//       </View>
//     </Animated.View>
//   );
// }

// // ── Main ──────────────────────────────────────────────────────────────────────
// export default function HomeScreen({ navigation }) {
//   const user   = useAuthStore((s) => s.user);
//   const logout = useAuthStore((s) => s.logout);

//   const [reminders,   setReminders]   = useState([]);
//   const [refreshing,  setRefreshing]  = useState(false);
//   const [selectedDay, setSelectedDay] = useState(new Date());
//   const [stats,       setStats]       = useState({ total: 0, today: 0, completed: 0, overdue: 0 });
//   const [error,       setError]       = useState(null);

//   const scrollY       = useRef(new Animated.Value(0)).current;
//   const stickyOpacity = scrollY.interpolate({ inputRange: [0, 100], outputRange: [0, 1], extrapolate: 'clamp' });

//   const loadData = useCallback(async () => {
//     try {
//       setError(null);
//       const data = await getReminders();
//       // Rails may return { reminders: [...] } or plain array
//       const list = Array.isArray(data) ? data : (data?.reminders || data?.data || []);
//       setReminders(list);
//       setStats(computeStats(list));
//     } catch (e) {
//       console.error('Home load error:', e);
//       setError('Could not load reminders');
//     }
//   }, []);

//   useEffect(() => { loadData(); }, []);

//   const onRefresh = async () => {
//     setRefreshing(true);
//     await loadData();
//     setRefreshing(false);
//   };

//   const dayReminders = reminders.filter((r) =>
//     r.due_date && new Date(r.due_date).toDateString() === selectedDay.toDateString()
//   );

//   const nextReminder = reminders
//     .filter((r) => r.due_date && !r.completed && new Date(r.due_date) > new Date())
//     .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];

//   return (
//     <View style={styles.screen}>
//       <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

//       {/* Sticky header */}
//       <Animated.View style={[styles.sticky, { opacity: stickyOpacity }]}>
//         <Text style={styles.stickyWord}>remind</Text>
//         <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
//           <View style={styles.stickyAvatar}>
//             <Text style={styles.stickyAvatarTxt}>{user?.name?.charAt(0)?.toUpperCase() || '?'}</Text>
//           </View>
//         </TouchableOpacity>
//       </Animated.View>

//       <Animated.ScrollView
//         showsVerticalScrollIndicator={false}
//         contentContainerStyle={styles.scroll}
//         onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
//         scrollEventThrottle={16}
//         refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
//       >
//         {/* Top bar */}
//         <View style={styles.topBar}>
//           <View style={styles.logoRow}>
//             <View style={styles.logoRing}>
//               <View style={styles.logoRingInner} />
//               <View style={styles.logoDot} />
//             </View>
//             <Text style={styles.logoWord}>remind</Text>
//           </View>
//           <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.avatarWrap}>
//             <View style={styles.avatar}>
//               <Text style={styles.avatarTxt}>{user?.name?.charAt(0)?.toUpperCase() || '?'}</Text>
//             </View>
//             <View style={styles.onlineDot} />
//           </TouchableOpacity>
//         </View>

//         {/* Error banner */}
//         {error ? (
//           <TouchableOpacity style={styles.errorBanner} onPress={loadData}>
//             <Ionicons name="alert-circle-outline" size={16} color="#FF6B6B" />
//             <Text style={styles.errorText}>{error} · Tap to retry</Text>
//           </TouchableOpacity>
//         ) : null}

//         {/* Hero */}
//         <HeroBanner user={user} stats={stats} />

//         {/* Countdown */}
//         <SectionHeader title="Next Up" />
//         {nextReminder ? (
//           <CountdownTimer targetDate={nextReminder.due_date} title={nextReminder.title} />
//         ) : (
//           <View style={styles.noCountdown}>
//             <Ionicons name="timer-outline" size={28} color={colors.textMuted} />
//             <Text style={styles.noCountdownText}>No upcoming reminders</Text>
//           </View>
//         )}

//         {/* Calendar */}
//         <SectionHeader
//           title="Calendar"
//           action={new Date().toDateString() !== selectedDay.toDateString() ? 'Today' : null}
//           onAction={() => setSelectedDay(new Date())}
//         />
//         <CalendarStrip reminders={reminders} selectedDay={selectedDay} onDaySelect={setSelectedDay} />

//         {/* Day reminders */}
//         <View style={styles.dayHeader}>
//           <Text style={styles.dayHeaderText}>
//             {selectedDay.toDateString() === new Date().toDateString()
//               ? 'Today'
//               : selectedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
//           </Text>
//           <View style={styles.dayCountBadge}>
//             <Text style={styles.dayCountText}>{dayReminders.length}</Text>
//           </View>
//         </View>

//         <View style={[styles.card, shadows.sm]}>
//           {dayReminders.length > 0 ? (
//             dayReminders.map((r, i) => (
//               <View key={r.id || i}>
//                 <ReminderRow item={r} onPress={() => navigation.navigate('RemindersTab', { screen: 'ReminderDetail', params: { id: r.id } })} />
//                 {i < dayReminders.length - 1 && <View style={styles.rowDivider} />}
//               </View>
//             ))
//           ) : (
//             <View style={styles.dayEmpty}>
//               <Text style={styles.dayEmptyIcon}>🌿</Text>
//               <Text style={styles.dayEmptyTitle}>Free day</Text>
//               <Text style={styles.dayEmptyText}>Nothing scheduled</Text>
//             </View>
//           )}
//         </View>

//         {/* Quick actions */}
//         <SectionHeader title="Quick Actions" />
//         <View style={styles.qaRow}>
//           <QuickAction icon="add-circle"    label="Reminder" color="#6B9E78" bg="#EAF2EC" delay={0}   onPress={() => navigation.navigate('RemindersTab', { screen: 'CreateReminder' })} />
//           <QuickAction icon="people"        label="Friends"  color="#5B8DD9" bg="#EEF3FC" delay={60}  onPress={() => navigation.navigate('SocialTab')} />
//           <QuickAction icon="business"      label="Orgs"     color="#9B72CF" bg="#F3EDFC" delay={120} onPress={() => navigation.navigate('SocialTab')} />
//           <QuickAction icon="document-text" label="Notes"    color="#E09F3E" bg="#FFF8EC" delay={180} onPress={() => navigation.navigate('RemindersTab')} />
//         </View>

//         {/* Activity */}
//         <SectionHeader title="Recent Activity" />
//         <View style={[styles.card, shadows.sm, { marginBottom: spacing.xl }]}>
//           {[
//             { icon: 'person-add-outline',       iconColor: '#5B8DD9', iconBg: '#EEF3FC', title: 'Account created',  sub: 'Welcome to RemindApp!', time: 'Today' },
//             { icon: 'shield-checkmark-outline', iconColor: colors.primary, iconBg: colors.primaryLight, title: 'Email verified', sub: user?.email || '', time: 'Today' },
//           ].map((item, i, arr) => (
//             <View key={i}>
//               <View style={styles.actRow}>
//                 <View style={[styles.actIcon, { backgroundColor: item.iconBg }]}>
//                   <Ionicons name={item.icon} size={16} color={item.iconColor} />
//                 </View>
//                 <View style={styles.actInfo}>
//                   <Text style={styles.actTitle}>{item.title}</Text>
//                   <Text style={styles.actSub} numberOfLines={1}>{item.sub}</Text>
//                 </View>
//                 <Text style={styles.actTime}>{item.time}</Text>
//               </View>
//               {i < arr.length - 1 && <View style={styles.rowDivider} />}
//             </View>
//           ))}
//         </View>

//         <TouchableOpacity style={styles.signOut} onPress={logout}>
//           <Ionicons name="log-out-outline" size={15} color={colors.textMuted} />
//           <Text style={styles.signOutTxt}>Sign out</Text>
//         </TouchableOpacity>

//         <View style={{ height: 100 }} />
//       </Animated.ScrollView>
//     </View>
//   );
// }

// // ── Styles (unchanged from previous) ─────────────────────────────────────────
// const cds = StyleSheet.create({
//   container: { backgroundColor: colors.textPrimary, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.xl },
//   header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
//   dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF6B6B' },
//   label: { fontFamily: fonts.sansMedium, fontSize: 13, color: 'rgba(255,255,255,0.7)', flex: 1 },
//   pastBadge: { backgroundColor: '#FF6B6B', borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
//   pastText: { fontFamily: fonts.sansMedium, fontSize: 10, color: '#fff' },
//   row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
//   block: { alignItems: 'center', gap: 4 },
//   numWrap: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radius.md, width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
//   num: { fontFamily: fonts.serifBold, fontSize: 24, color: '#FFFFFF', letterSpacing: -0.5 },
//   unit: { fontFamily: fonts.sans, fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5 },
//   colon: { fontFamily: fonts.serifBold, fontSize: 22, color: 'rgba(255,255,255,0.3)', marginBottom: 16 },
// });

// const cal = StyleSheet.create({
//   wrapper: { backgroundColor: colors.bgCard, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, paddingTop: spacing.md, marginBottom: spacing.md, overflow: 'hidden' },
//   monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, marginBottom: spacing.sm },
//   monthBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bgInput, alignItems: 'center', justifyContent: 'center' },
//   monthLabel: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.textPrimary },
//   dayScroll: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.xs },
//   dayCol: { width: 52, alignItems: 'center', gap: 4, paddingVertical: spacing.sm, borderRadius: radius.md },
//   dayColSelected: { backgroundColor: colors.textPrimary },
//   dayColToday: { backgroundColor: colors.primaryLight },
//   dayName: { fontFamily: fonts.sans, fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
//   dayNameSelected: { color: 'rgba(255,255,255,0.6)' },
//   dayNum: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.textPrimary },
//   dayNumSelected: { color: '#FFFFFF' },
//   dayNumToday: { color: colors.primary },
//   reminderDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary },
//   reminderDotSelected: { backgroundColor: 'rgba(255,255,255,0.5)' },
//   reminderDotPlaceholder: { width: 5, height: 5 },
// });

// const styles = StyleSheet.create({
//   screen: { flex: 1, backgroundColor: colors.bg },
//   scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
//   sticky: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.sm },
//   stickyWord: { fontFamily: fonts.serifBold, fontSize: 20, color: colors.textPrimary, letterSpacing: -0.3 },
//   stickyAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primaryLight, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
//   stickyAvatarTxt: { fontFamily: fonts.serifBold, fontSize: 13, color: colors.primary },
//   topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
//   logoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
//   logoRing: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
//   logoRingInner: { width: 17, height: 17, borderRadius: 9, borderWidth: 1.5, borderColor: colors.primary, opacity: 0.4 },
//   logoDot: { position: 'absolute', width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
//   logoWord: { fontFamily: fonts.serifBold, fontSize: 22, color: colors.textPrimary, letterSpacing: -0.3 },
//   avatarWrap: { position: 'relative' },
//   avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primaryLight, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
//   avatarTxt: { fontFamily: fonts.serifBold, fontSize: 20, color: colors.primary },
//   onlineDot: { position: 'absolute', bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: '#6BC99E', borderWidth: 2, borderColor: colors.bg },
//   errorBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: '#FFF0F0', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: '#FFCDD2' },
//   errorText: { fontFamily: fonts.sans, fontSize: 13, color: '#FF6B6B', flex: 1 },
//   hero: { backgroundColor: colors.textPrimary, borderRadius: radius.xl, padding: spacing.xl, flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xl, overflow: 'hidden' },
//   heroLeft: { flex: 1, justifyContent: 'center', gap: spacing.xs },
//   heroGreeting: { fontFamily: fonts.sans, fontSize: 13, color: 'rgba(255,255,255,0.5)' },
//   heroName: { fontFamily: fonts.serifBold, fontSize: 26, color: '#fff', letterSpacing: -0.5 },
//   heroChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 5, alignSelf: 'flex-start', marginTop: spacing.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
//   heroChipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
//   heroChipText: { fontFamily: fonts.sans, fontSize: 11, color: 'rgba(255,255,255,0.6)' },
//   heroRight: { alignItems: 'center', gap: spacing.md },
//   ring: { width: 82, height: 82, borderRadius: 41, borderWidth: 5, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', position: 'relative' },
//   ringInner: { alignItems: 'center' },
//   ringPct: { fontFamily: fonts.serifBold, fontSize: 18, color: '#fff', letterSpacing: -0.5 },
//   ringLabel: { fontFamily: fonts.sans, fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: -2 },
//   ringArc: { position: 'absolute', top: -5, left: -5, width: 82, height: 82, borderRadius: 41, borderWidth: 5, borderColor: colors.primary, borderTopColor: 'transparent', borderRightColor: 'transparent' },
//   heroMiniStats: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
//   heroMiniStat: { alignItems: 'center', gap: 2 },
//   heroMiniNum: { fontFamily: fonts.serifBold, fontSize: 20, color: '#fff', letterSpacing: -0.5 },
//   heroMiniLabel: { fontFamily: fonts.sans, fontSize: 10, color: 'rgba(255,255,255,0.4)' },
//   heroMiniDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.1)' },
//   sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, marginTop: spacing.xs },
//   sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
//   sectionBar: { width: 3, height: 16, borderRadius: 2, backgroundColor: colors.primary },
//   sectionTitle: { fontFamily: fonts.serif, fontSize: 17, color: colors.textPrimary, letterSpacing: -0.2 },
//   sectionAction: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.primary },
//   dayHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
//   dayHeaderText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.textPrimary },
//   dayCountBadge: { backgroundColor: colors.primaryLight, borderRadius: radius.full, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
//   dayCountText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.primary },
//   card: { backgroundColor: colors.bgCard, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: spacing.md },
//   rowDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },
//   reminderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.md, gap: spacing.sm },
//   reminderAccent: { width: 3, height: 36, borderRadius: 2, flexShrink: 0 },
//   reminderInfo: { flex: 1, gap: 2 },
//   reminderTitle: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.textPrimary },
//   reminderDone: { textDecorationLine: 'line-through', color: colors.textMuted },
//   reminderDesc: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted },
//   reminderRight: { alignItems: 'flex-end', gap: 4 },
//   reminderTime: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted },
//   priorityChip: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
//   priorityChipText: { fontFamily: fonts.sansMedium, fontSize: 10, textTransform: 'capitalize' },
//   dayEmpty: { alignItems: 'center', padding: spacing.xl, gap: spacing.xs },
//   dayEmptyIcon: { fontSize: 32, marginBottom: spacing.xs },
//   dayEmptyTitle: { fontFamily: fonts.serif, fontSize: 16, color: colors.textPrimary },
//   dayEmptyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted },
//   qaRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
//   qaCard: { backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
//   qaIcon: { width: 46, height: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
//   qaLabel: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.textSecondary },
//   noCountdown: { backgroundColor: colors.bgCard, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', padding: spacing.xl, alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl, flexDirection: 'row', justifyContent: 'center' },
//   noCountdownText: { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted },
//   actRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
//   actIcon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
//   actInfo: { flex: 1 },
//   actTitle: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textPrimary },
//   actSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, marginTop: 2 },
//   actTime: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted },
//   signOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.md },
//   signOutTxt: { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted },
// });