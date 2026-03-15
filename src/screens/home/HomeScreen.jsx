// src/screens/home/HomeScreen.jsx
import React, { useEffect, useRef, useState, useCallback, useMemo, useContext } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Animated, RefreshControl, Dimensions, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import useAuthStore from '../../store/authStore';
import useThemeStore from '../../store/themeStore';
import { fonts } from '../../theme';
import { getReminders, computeStats } from '../../api/reminders';

const { width: W } = Dimensions.get('window');

// ─── Light tokens (static baseline — used in StyleSheet.create) ───────────────
const T = {
  cream:       '#FAF8F5',
  creamDeep:   '#F2EEE8',
  creamBorder: 'rgba(0,0,0,0.07)',
  ink:         '#1C1917',
  inkMid:      '#57534E',
  inkLight:    '#A8A29E',
  inkGhost:    '#D6D3D1',
  sage:        '#4A7C59',
  sageMid:     '#6B9E78',
  sageLight:   '#EAF2EC',
  sageFaint:   '#F3F8F4',
  ember:       '#C2500A',
  emberLight:  '#FEF3EC',
  sky:         '#2563EB',
  skyLight:    '#EFF6FF',
  rose:        '#BE185D',
  roseLight:   '#FDF2F8',
  white:       '#FFFFFF',
  cardBg:      '#FFFFFF',
  inputBg:     '#F5F2EE',
  shadowColor: '#1C1917',
};

// ─── Dark tokens (same property names, dark values) ───────────────────────────
const DARK_T = {
  cream:       '#0A0A0F',
  creamDeep:   '#13131A',
  creamBorder: 'rgba(255,255,255,0.07)',
  ink:         '#F4F4F6',
  inkMid:      '#9898A8',
  inkLight:    '#5A5A6E',
  inkGhost:    '#3A3A4E',
  sage:        '#4ADE80',
  sageMid:     '#22C55E',
  sageLight:   'rgba(74,222,128,0.15)',
  sageFaint:   'rgba(74,222,128,0.06)',
  ember:       '#F87171',
  emberLight:  'rgba(248,113,113,0.15)',
  sky:         '#60A5FA',
  skyLight:    'rgba(96,165,250,0.15)',
  rose:        '#F472B6',
  roseLight:   'rgba(244,114,182,0.15)',
  white:       '#1C1C27',
  cardBg:      '#13131A',
  inputBg:     '#1C1C27',
  shadowColor: '#000000',
};

// ─── Theme context — every sub-component reads live palette from here ─────────
const ThemeContext = React.createContext(T);
const useTheme = () => useContext(ThemeContext);

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

function relativeTime(dateInput) {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';
  const now  = new Date();
  const diff = now - date;
  if (diff < 0)          return 'upcoming';
  if (diff < 60_000)     return 'just now';
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) { const h = Math.floor(diff/3_600_000); return `${h} hour${h>1?'s':''} ago`; }
  const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
  const dateStart  = new Date(date); dateStart.setHours(0,0,0,0);
  const dayDiff    = Math.round((todayStart - dateStart) / 86_400_000);
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff < 7)   return `${dayDiff} days ago`;
  if (dayDiff < 30)  return `${Math.floor(dayDiff/7)} week${Math.floor(dayDiff/7)>1?'s':''} ago`;
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

function fmtTime(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function productivityScore(stats) {
  if (!stats.total) return 0;
  const rate    = stats.completed / stats.total;
  const penalty = Math.min(stats.overdue / Math.max(stats.total, 1), 0.5);
  return Math.round(Math.max(0, (rate - penalty) * 100));
}

function scoreTheme(score, C) {
  if (score >= 80) return { color: C.sage,  label: 'Excellent', bg: C.sageLight };
  if (score >= 55) return { color: C.sky,   label: 'Good',      bg: C.skyLight };
  if (score >= 30) return { color: C.ember, label: 'Fair',       bg: C.emberLight };
  return                   { color: C.rose, label: 'Needs work', bg: C.roseLight };
}

function computeStreak(reminders) {
  const doneSet = new Set(
    reminders
      .filter(r => r.completed && (r.completed_at || r.updated_at))
      .map(r => { const d = new Date(r.completed_at || r.updated_at); d.setHours(0,0,0,0); return d.getTime(); })
  );
  if (doneSet.size === 0) return 0;
  let streak = 0;
  const cursor = new Date(); cursor.setHours(0,0,0,0);
  while (doneSet.has(cursor.getTime())) { streak++; cursor.setDate(cursor.getDate() - 1); }
  return streak;
}

function computeWeeklySummary(reminders) {
  const now    = new Date();
  const day    = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0,0,0,0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23,59,59,999);
  const weekItems = reminders.filter(r => { const d = new Date(r.created_at||r.due_date); return d>=monday&&d<=sunday; });
  const completed = reminders.filter(r => { if(!r.completed)return false; const d=new Date(r.completed_at||r.updated_at||r.due_date); return d>=monday&&d<=sunday; }).length;
  const missed    = reminders.filter(r => { if(r.completed||!r.due_date)return false; const d=new Date(r.due_date); return d>=monday&&d<now; }).length;
  const added     = weekItems.length;
  const rate      = added > 0 ? Math.round((completed/added)*100) : 0;
  const byDay     = Array(7).fill(0);
  reminders.forEach(r => {
    if (!r.completed) return;
    const d = new Date(r.completed_at||r.updated_at||r.due_date);
    if (d<monday||d>sunday) return;
    byDay[(d.getDay()+6)%7]++;
  });
  return { completed, missed, added, rate, byDay, monday, sunday };
}

// ─── Sub-components (all use useTheme() for live C) ───────────────────────────

function Entrance({ children, delay = 0, from = 18 }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue:1, delay, useNativeDriver:true, tension:60, friction:10 }).start();
  }, []);
  return (
    <Animated.View style={{ opacity:anim, transform:[{translateY:anim.interpolate({inputRange:[0,1],outputRange:[from,0]})}] }}>
      {children}
    </Animated.View>
  );
}

function Pill({ children, color, bg, size = 11 }) {
  const C = useTheme();
  return (
    <View style={[p.pill, { backgroundColor: bg || C.sageLight }]}>
      <Text style={[p.pillTxt, { color: color || C.sage, fontSize: size }]}>{children}</Text>
    </View>
  );
}
const p = StyleSheet.create({
  pill:    { borderRadius:99, paddingHorizontal:10, paddingVertical:3 },
  pillTxt: { fontFamily:fonts.sansMedium, letterSpacing:0.2, textTransform:'capitalize' },
});

function SectionHead({ title, badge, action, onAction }) {
  const C = useTheme();
  return (
    <View style={sh.row}>
      <View style={sh.left}>
        <Text style={[sh.title, { color:C.ink }]}>{title}</Text>
        {badge != null && (
          <View style={[sh.badge, { backgroundColor:C.creamDeep }]}>
            <Text style={[sh.badgeTxt, { color:C.inkMid }]}>{badge}</Text>
          </View>
        )}
      </View>
      {action && (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
          <Text style={[sh.action, { color:C.sage }]}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
const sh = StyleSheet.create({
  row:      { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:12, marginTop:4 },
  left:     { flexDirection:'row', alignItems:'center', gap:8 },
  title:    { fontFamily:fonts.serif, fontSize:16, letterSpacing:-0.3 },
  badge:    { borderRadius:99, paddingHorizontal:8, paddingVertical:2 },
  badgeTxt: { fontFamily:fonts.sansMedium, fontSize:11 },
  action:   { fontFamily:fonts.sansMedium, fontSize:13 },
});

function Divider({ mx = 16 }) {
  const C = useTheme();
  return <View style={{ height:1, backgroundColor:C.creamBorder, marginHorizontal:mx }} />;
}

// ── StreakBadge ───────────────────────────────────────────────────────────────
function StreakBadge({ streak }) {
  const C = useTheme();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (streak >= 3) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue:1.12, duration:700, useNativeDriver:true }),
        Animated.timing(pulseAnim, { toValue:1,    duration:700, useNativeDriver:true }),
      ])).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [streak]);
  if (streak < 1) return null;
  const emoji = streak >= 14 ? '🔥' : streak >= 7 ? '⚡' : streak >= 3 ? '✨' : '🌱';
  const color = streak >= 7 ? C.ember : C.sage;
  const bg    = streak >= 7 ? C.emberLight : C.sageLight;
  return (
    <Animated.View style={[stk.wrap, { backgroundColor:bg, transform:[{scale:pulseAnim}] }]}>
      <Text style={stk.emoji}>{emoji}</Text>
      <Text style={[stk.num, { color }]}>{streak}</Text>
      <Text style={[stk.lbl, { color }]}>day{streak > 1 ? 's' : ''}</Text>
    </Animated.View>
  );
}
const stk = StyleSheet.create({
  wrap:  { flexDirection:'row', alignItems:'center', gap:4, borderRadius:99, paddingHorizontal:10, paddingVertical:5, alignSelf:'flex-start', marginTop:10 },
  emoji: { fontSize:13 },
  num:   { fontFamily:fonts.serifBold, fontSize:14, letterSpacing:-0.3 },
  lbl:   { fontFamily:fonts.sans, fontSize:11 },
});

// ── HeroBanner ────────────────────────────────────────────────────────────────
function HeroBanner({ user, stats, streak = 0 }) {
  const C         = useTheme();
  const isDark    = useThemeStore(s => s.isDark);
  const score     = productivityScore(stats);
  const theme     = scoreTheme(score, C);
  const firstName = user?.name?.split(' ')[0] || 'there';
  const dateStr   = new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
  return (
    <Entrance delay={0}>
      <View style={[hb.card, { borderColor:C.creamBorder, shadowColor:C.shadowColor }]}>
        <LinearGradient
          colors={isDark ? ['#0F1A14', '#0A0A0F'] : ['#FFFFFF', C.sageFaint]}
          start={{x:0,y:0}} end={{x:1,y:1}}
          style={StyleSheet.absoluteFill}
          borderRadius={20}
        />
        <View style={[hb.decCircle, { backgroundColor:C.sageLight }]} />
        <View style={hb.inner}>
          <View style={hb.left}>
            <Text style={[hb.greeting, { color:C.inkLight }]}>{getGreeting()}</Text>
            <Text style={[hb.name,     { color:C.ink }]}>{firstName} 👋</Text>
            <Text style={[hb.date,     { color:C.inkLight }]}>{dateStr}</Text>
            <StreakBadge streak={streak} />
            <View style={hb.miniRow}>
              {[
                { num:stats.total,    lbl:'tasks'   },
                { num:stats.today||0, lbl:'today'   },
                { num:stats.overdue,  lbl:'overdue', warn:stats.overdue>0 },
              ].map(({ num, lbl, warn }, i, arr) => (
                <React.Fragment key={lbl}>
                  <View style={hb.miniStat}>
                    <Text style={[hb.miniNum, { color:warn ? C.ember : C.ink }]}>{num}</Text>
                    <Text style={[hb.miniLbl, { color:C.inkLight }]}>{lbl}</Text>
                  </View>
                  {i < arr.length-1 && <View style={[hb.miniDiv, { backgroundColor:C.creamBorder }]} />}
                </React.Fragment>
              ))}
            </View>
          </View>
          <View style={hb.right}>
            <View style={hb.ring}>
              <View style={[hb.ringTrack, { borderColor:C.creamBorder }]} />
              <View style={[hb.ringFill, { borderColor:theme.color, transform:[{rotate:`${(score/100)*360}deg`}], opacity:score>0?1:0 }]} />
              <View style={hb.ringCenter}>
                <Text style={[hb.ringPct, { color:theme.color }]}>{score}</Text>
                <Text style={[hb.ringLbl, { color:C.inkLight }]}>score</Text>
              </View>
            </View>
            <View style={[hb.scoreBadge, { backgroundColor:theme.bg }]}>
              <Text style={[hb.scoreBadgeTxt, { color:theme.color }]}>{theme.label}</Text>
            </View>
          </View>
        </View>
      </View>
    </Entrance>
  );
}
const hb = StyleSheet.create({
  card:      { borderRadius:20, borderWidth:1, overflow:'hidden', marginBottom:20, shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:12, elevation:2 },
  decCircle: { position:'absolute', width:160, height:160, borderRadius:80, opacity:0.4, top:-50, right:-50 },
  inner:     { flexDirection:'row', justifyContent:'space-between', padding:22 },
  left:      { flex:1, justifyContent:'center', gap:4 },
  greeting:  { fontFamily:fonts.sans, fontSize:12, letterSpacing:0.2 },
  name:      { fontFamily:fonts.serifBold, fontSize:26, letterSpacing:-0.8, marginBottom:2 },
  date:      { fontFamily:fonts.sans, fontSize:12 },
  miniRow:   { flexDirection:'row', alignItems:'center', gap:12, marginTop:14 },
  miniStat:  { alignItems:'center', gap:2 },
  miniNum:   { fontFamily:fonts.serifBold, fontSize:18, letterSpacing:-0.5 },
  miniLbl:   { fontFamily:fonts.sans, fontSize:10, textTransform:'lowercase' },
  miniDiv:   { width:1, height:20 },
  right:     { alignItems:'center', gap:8, justifyContent:'center' },
  ring:      { width:78, height:78, borderRadius:39, alignItems:'center', justifyContent:'center', position:'relative' },
  ringTrack: { position:'absolute', width:78, height:78, borderRadius:39, borderWidth:5 },
  ringFill:  { position:'absolute', width:78, height:78, borderRadius:39, borderWidth:5, borderTopColor:'transparent', borderRightColor:'transparent', borderBottomColor:'transparent' },
  ringCenter:{ alignItems:'center' },
  ringPct:   { fontFamily:fonts.serifBold, fontSize:20, letterSpacing:-0.5 },
  ringLbl:   { fontFamily:fonts.sans, fontSize:9, marginTop:-2 },
  scoreBadge:    { borderRadius:99, paddingHorizontal:10, paddingVertical:4 },
  scoreBadgeTxt: { fontFamily:fonts.sansMedium, fontSize:11 },
});

// ── CountdownTimer ────────────────────────────────────────────────────────────
function CountdownTimer({ targetDate, title }) {
  const C = useTheme();
  const [time, setTime] = useState({ d:0,h:0,m:0,s:0,past:false });
  useEffect(() => {
    const tick = () => {
      const diff = new Date(targetDate) - new Date();
      if (diff<=0) { setTime({d:0,h:0,m:0,s:0,past:true}); return; }
      setTime({ d:Math.floor(diff/86400000), h:Math.floor((diff%86400000)/3600000), m:Math.floor((diff%3600000)/60000), s:Math.floor((diff%60000)/1000), past:false });
    };
    tick(); const id=setInterval(tick,1000); return ()=>clearInterval(id);
  }, [targetDate]);
  const TimeBlock = ({ value, label }) => (
    <View style={cd.block}>
      <View style={cd.numBox}><Text style={cd.num}>{pad(value)}</Text></View>
      <Text style={cd.lbl}>{label}</Text>
    </View>
  );
  return (
    <View style={[cd.card, { backgroundColor:C.ink, shadowColor:C.ink }]}>
      <View style={cd.topRow}>
        <View style={[cd.liveDot, { backgroundColor:time.past ? C.ember : C.sageMid }]} />
        <Text style={cd.eventTitle} numberOfLines={1}>{title}</Text>
        {time.past && <Pill color={C.ember} bg={C.emberLight} size={10}>Overdue</Pill>}
      </View>
      <View style={cd.blocksRow}>
        <TimeBlock value={time.d} label="days" />
        <Text style={cd.sep}>:</Text>
        <TimeBlock value={time.h} label="hrs" />
        <Text style={cd.sep}>:</Text>
        <TimeBlock value={time.m} label="min" />
        <Text style={cd.sep}>:</Text>
        <TimeBlock value={time.s} label="sec" />
      </View>
      <Text style={cd.dueStr}>
        Due {new Date(targetDate).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
      </Text>
    </View>
  );
}
const cd = StyleSheet.create({
  card:      { borderRadius:18, padding:20, marginBottom:20, shadowOffset:{width:0,height:4}, shadowOpacity:0.14, shadowRadius:16, elevation:4 },
  topRow:    { flexDirection:'row', alignItems:'center', gap:8, marginBottom:18 },
  liveDot:   { width:7, height:7, borderRadius:4 },
  eventTitle:{ fontFamily:fonts.sansMedium, fontSize:13, color:'rgba(255,255,255,0.65)', flex:1 },
  blocksRow: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, marginBottom:14 },
  block:     { alignItems:'center', gap:6 },
  numBox:    { backgroundColor:'rgba(255,255,255,0.08)', borderRadius:12, width:60, height:60, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.07)' },
  num:       { fontFamily:fonts.serifBold, fontSize:26, color:'#FFFFFF', letterSpacing:-0.5 },
  lbl:       { fontFamily:fonts.sans, fontSize:10, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:0.6 },
  sep:       { fontFamily:fonts.serifBold, fontSize:20, color:'rgba(255,255,255,0.15)', marginBottom:16 },
  dueStr:    { fontFamily:fonts.sans, fontSize:11, color:'rgba(255,255,255,0.3)', textAlign:'center' },
});

// ── CalendarStrip ─────────────────────────────────────────────────────────────
function CalendarStrip({ reminders = [], onDaySelect, selectedDay }) {
  const C         = useTheme();
  const scrollRef = useRef(null);
  const today     = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const days = getDaysInMonth(viewYear, viewMonth);
  const reminderDates = useMemo(() => new Set(
    reminders.map(r => r.due_date ? new Date(r.due_date).toDateString() : null).filter(Boolean)
  ), [reminders]);
  useEffect(() => {
    const idx = days.findIndex(d => d.toDateString()===today.toDateString());
    if (idx>2&&scrollRef.current) setTimeout(()=>scrollRef.current?.scrollTo({x:idx*62,animated:true}),300);
  }, [viewMonth]);
  const changeMonth = (dir) => setViewMonth(m => {
    const nm = m+dir;
    if (nm<0)  { setViewYear(y=>y-1); return 11; }
    if (nm>11) { setViewYear(y=>y+1); return 0; }
    return nm;
  });
  return (
    <View style={[cs.wrapper, { backgroundColor:C.cardBg, borderColor:C.creamBorder, shadowColor:C.shadowColor }]}>
      <View style={cs.monthRow}>
        <TouchableOpacity onPress={()=>changeMonth(-1)} style={[cs.navBtn,{backgroundColor:C.creamDeep}]} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={16} color={C.inkMid} />
        </TouchableOpacity>
        <Text style={[cs.monthTxt, { color:C.ink }]}>{MONTHS[viewMonth]} {viewYear}</Text>
        <TouchableOpacity onPress={()=>changeMonth(1)} style={[cs.navBtn,{backgroundColor:C.creamDeep}]} activeOpacity={0.7}>
          <Ionicons name="chevron-forward" size={16} color={C.inkMid} />
        </TouchableOpacity>
      </View>
      <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={cs.strip}>
        {days.map((day,i) => {
          const isToday   = day.toDateString()===today.toDateString();
          const isSel     = selectedDay && day.toDateString()===selectedDay.toDateString();
          const hasRemind = reminderDates.has(day.toDateString());
          return (
            <TouchableOpacity key={i} onPress={()=>onDaySelect(day)} activeOpacity={0.7}
              style={[cs.col, isSel&&{backgroundColor:C.ink}, isToday&&!isSel&&{backgroundColor:C.sageLight}]}>
              <Text style={[cs.dayName,{color:C.inkLight}, isSel&&{color:'#FFF'}, isToday&&!isSel&&{color:C.sage}]}>
                {DAYS[day.getDay()]}
              </Text>
              <Text style={[cs.dayNum,{color:C.ink}, isSel&&{color:'#FFF'}, isToday&&!isSel&&{color:C.sage}]}>
                {day.getDate()}
              </Text>
              {hasRemind
                ? <View style={[cs.dot,{backgroundColor:isSel?'rgba(255,255,255,0.5)':C.sage}]}/>
                : <View style={{height:5}}/>
              }
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
const cs = StyleSheet.create({
  wrapper:  { borderRadius:18, borderWidth:1, paddingTop:14, marginBottom:12, overflow:'hidden', shadowOffset:{width:0,height:1}, shadowOpacity:0.05, shadowRadius:8, elevation:1 },
  monthRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, marginBottom:10 },
  navBtn:   { width:30, height:30, borderRadius:15, alignItems:'center', justifyContent:'center' },
  monthTxt: { fontFamily:fonts.sansMedium, fontSize:14 },
  strip:    { paddingHorizontal:12, paddingBottom:14, gap:4 },
  col:      { width:54, alignItems:'center', gap:4, paddingVertical:8, borderRadius:14 },
  dayName:  { fontFamily:fonts.sans, fontSize:10, textTransform:'uppercase', letterSpacing:0.4 },
  dayNum:   { fontFamily:fonts.sansMedium, fontSize:16 },
  dot:      { width:5, height:5, borderRadius:3 },
});

// ── ReminderRow ───────────────────────────────────────────────────────────────
function ReminderRow({ item, onPress }) {
  const C = useTheme();
  const pConfig = {
    high:   { color:C.ember, bg:C.emberLight },
    medium: { color:C.sky,   bg:C.skyLight },
    low:    { color:C.sage,  bg:C.sageLight },
  }[item.priority?.toLowerCase()] || { color:C.inkLight, bg:C.creamDeep };
  const due = fmtTime(item.due_date);
  return (
    <TouchableOpacity style={rr.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[rr.accent,{backgroundColor:pConfig.color}]} />
      <View style={rr.info}>
        <Text style={[rr.title,{color:C.ink}, item.completed&&{textDecorationLine:'line-through',color:C.inkLight}]} numberOfLines={1}>{item.title}</Text>
        {item.description && <Text style={[rr.desc,{color:C.inkLight}]} numberOfLines={1}>{item.description}</Text>}
      </View>
      <View style={rr.right}>
        {due && <Text style={[rr.time,{color:C.inkLight}]}>{due}</Text>}
        <Pill color={pConfig.color} bg={pConfig.bg} size={10}>{item.priority||'none'}</Pill>
        {item.completed && <Ionicons name="checkmark-circle" size={14} color={C.sage} />}
      </View>
    </TouchableOpacity>
  );
}
const rr = StyleSheet.create({
  row:    { flexDirection:'row', alignItems:'center', paddingVertical:12, paddingHorizontal:16, gap:10 },
  accent: { width:3, height:34, borderRadius:2, flexShrink:0 },
  info:   { flex:1, gap:2 },
  title:  { fontFamily:fonts.sansMedium, fontSize:14 },
  desc:   { fontFamily:fonts.sans, fontSize:12 },
  right:  { alignItems:'flex-end', gap:4 },
  time:   { fontFamily:fonts.sans, fontSize:11 },
});

// ── QAction ───────────────────────────────────────────────────────────────────
function QAction({ icon, label, color, bg, onPress, delay = 0 }) {
  const anim  = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue:1, delay, useNativeDriver:true, tension:55, friction:8 }).start();
  }, []);
  const press = () => {
    Animated.sequence([
      Animated.spring(scale,{toValue:0.93,useNativeDriver:true,speed:50}),
      Animated.spring(scale,{toValue:1,   useNativeDriver:true,speed:50}),
    ]).start();
    onPress?.();
  };
  return (
    <Animated.View style={{flex:1,opacity:anim,transform:[{scale:Animated.multiply(anim,scale)}]}}>
      <TouchableOpacity onPress={press} activeOpacity={1}>
        <View style={[qa.card,{backgroundColor:bg}]}>
          <View style={[qa.iconWrap,{backgroundColor:color+'18'}]}>
            <Ionicons name={icon} size={20} color={color} />
          </View>
          <Text style={[qa.lbl,{color}]}>{label}</Text>
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

// ── InsightsStrip ─────────────────────────────────────────────────────────────
function InsightsStrip({ stats, reminders }) {
  const C = useTheme();
  const insights = useMemo(() => {
    const out = [];
    const score = productivityScore(stats);
    if (stats.overdue>0) out.push({ icon:'alert-circle-outline', color:C.ember, bg:C.emberLight, text:`${stats.overdue} reminder${stats.overdue>1?'s':''} overdue` });
    if (stats.completed>0&&stats.total>0) out.push({ icon:'trending-up-outline', color:C.sage, bg:C.sageLight, text:`${Math.round(stats.completed/stats.total*100)}% completion rate` });
    const todayCount = reminders.filter(r=>r.due_date&&new Date(r.due_date).toDateString()===new Date().toDateString()&&!r.completed).length;
    if (todayCount>0) out.push({ icon:'calendar-outline', color:C.sky, bg:C.skyLight, text:`${todayCount} task${todayCount>1?'s':''} due today` });
    if (score>=80) out.push({ icon:'star-outline', color:C.sky, bg:C.skyLight, text:'Great streak! Keep it up.' });
    if (out.length===0) out.push({ icon:'leaf-outline', color:C.sage, bg:C.sageLight, text:'All clear — enjoy your day.' });
    return out.slice(0,3);
  }, [stats, reminders, C]);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={{gap:8,paddingRight:20}}
      style={{marginBottom:20,marginLeft:-20,paddingLeft:20}}>
      {insights.map((ins,i) => (
        <View key={i} style={[ins2.card,{backgroundColor:ins.bg,borderColor:`${ins.color}20`}]}>
          <Ionicons name={ins.icon} size={14} color={ins.color} />
          <Text style={[ins2.txt,{color:ins.color}]}>{ins.text}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
const ins2 = StyleSheet.create({
  card: { flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:14, paddingVertical:9, borderRadius:99, borderWidth:1 },
  txt:  { fontFamily:fonts.sansMedium, fontSize:12, letterSpacing:0.1 },
});

// ── ActivityItem ──────────────────────────────────────────────────────────────
function ActivityItem({ icon, iconColor, iconBg, title, sub, timestamp, showDivider }) {
  const C = useTheme();
  return (
    <>
      <View style={ai.row}>
        <View style={[ai.iconBox,{backgroundColor:iconBg}]}>
          <Ionicons name={icon} size={15} color={iconColor} />
        </View>
        <View style={ai.info}>
          <Text style={[ai.title,{color:C.ink}]}>{title}</Text>
          {sub && <Text style={[ai.sub,{color:C.inkLight}]} numberOfLines={1}>{sub}</Text>}
        </View>
        <Text style={[ai.time,{color:C.inkLight}]}>{relativeTime(timestamp)}</Text>
      </View>
      {showDivider && <Divider />}
    </>
  );
}
const ai = StyleSheet.create({
  row:    { flexDirection:'row', alignItems:'center', gap:12, padding:14 },
  iconBox:{ width:34, height:34, borderRadius:10, alignItems:'center', justifyContent:'center', flexShrink:0 },
  info:   { flex:1 },
  title:  { fontFamily:fonts.sansMedium, fontSize:13 },
  sub:    { fontFamily:fonts.sans, fontSize:12, marginTop:2 },
  time:   { fontFamily:fonts.sans, fontSize:11 },
});

// ── Card ──────────────────────────────────────────────────────────────────────
function Card({ children, style }) {
  const C = useTheme();
  return (
    <View style={[kd.card,{backgroundColor:C.cardBg,borderColor:C.creamBorder,shadowColor:C.shadowColor},style]}>
      {children}
    </View>
  );
}
const kd = StyleSheet.create({
  card: { borderRadius:18, borderWidth:1, overflow:'hidden', marginBottom:12, shadowOffset:{width:0,height:1}, shadowOpacity:0.05, shadowRadius:8, elevation:1 },
});

// ── EmptyDay ──────────────────────────────────────────────────────────────────
function EmptyDay() {
  const C = useTheme();
  return (
    <View style={ed.wrap}>
      <Text style={ed.emoji}>🌿</Text>
      <Text style={[ed.title,{color:C.ink}]}>Nothing scheduled</Text>
      <Text style={[ed.sub,{color:C.inkLight}]}>A clear slate — or add something new.</Text>
    </View>
  );
}
const ed = StyleSheet.create({
  wrap:  { alignItems:'center', paddingVertical:28, gap:4 },
  emoji: { fontSize:28, marginBottom:6 },
  title: { fontFamily:fonts.serif, fontSize:15 },
  sub:   { fontFamily:fonts.sans, fontSize:12 },
});

// ── DueSoonAlert ──────────────────────────────────────────────────────────────
function DueSoonAlert({ reminders, onPress }) {
  const C = useTheme();
  const [dueSoon, setDueSoon] = useState([]);
  const slideAnim = useRef(new Animated.Value(-8)).current;
  const opacAnim  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const compute = () => {
      const now = new Date();
      const soon = reminders.filter(r=>{ if(!r.due_date||r.completed)return false; const d=new Date(r.due_date)-now; return d>0&&d<=2*3_600_000; })
        .sort((a,b)=>new Date(a.due_date)-new Date(b.due_date));
      setDueSoon(soon);
    };
    compute(); const id=setInterval(compute,60_000); return ()=>clearInterval(id);
  }, [reminders]);
  useEffect(() => {
    if (dueSoon.length>0) {
      Animated.parallel([
        Animated.spring(slideAnim,{toValue:0,useNativeDriver:true,tension:70,friction:10}),
        Animated.timing(opacAnim, {toValue:1,duration:300,useNativeDriver:true}),
      ]).start();
    } else { slideAnim.setValue(-8); opacAnim.setValue(0); }
  }, [dueSoon.length]);
  if (dueSoon.length===0) return null;
  const first    = dueSoon[0];
  const diffMs   = new Date(first.due_date)-new Date();
  const minsLeft = Math.floor(diffMs/60_000);
  const timeStr  = minsLeft<60 ? `${minsLeft} min` : `${Math.floor(minsLeft/60)}h ${minsLeft%60}m`;
  return (
    <Animated.View style={[dsa.wrap,{borderColor:`${C.ember}25`,shadowColor:C.ember,transform:[{translateY:slideAnim}],opacity:opacAnim}]}>
      <LinearGradient colors={[C.emberLight,C.creamDeep]} start={{x:0,y:0}} end={{x:1,y:0}} style={dsa.grad}>
        <View style={[dsa.bar,{backgroundColor:C.ember}]} />
        <View style={[dsa.iconBox,{backgroundColor:C.emberLight}]}>
          <Ionicons name="time-outline" size={18} color={C.ember} />
        </View>
        <View style={dsa.info}>
          <Text style={[dsa.title,{color:C.ink}]} numberOfLines={1}>{first.title}</Text>
          <Text style={[dsa.sub,{color:C.inkMid}]}>
            Due in <Text style={{fontFamily:fonts.sansMedium,color:C.ember}}>{timeStr}</Text>
            {dueSoon.length>1?`  ·  +${dueSoon.length-1} more`:''}
          </Text>
        </View>
        <TouchableOpacity style={[dsa.viewBtn,{backgroundColor:C.emberLight}]} onPress={onPress} activeOpacity={0.7}>
          <Text style={[dsa.viewBtnTxt,{color:C.ember}]}>View</Text>
          <Ionicons name="chevron-forward" size={12} color={C.ember} />
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );
}
const dsa = StyleSheet.create({
  wrap:      { marginBottom:16, borderRadius:16, overflow:'hidden', borderWidth:1, shadowOffset:{width:0,height:2}, shadowOpacity:0.08, shadowRadius:8, elevation:2 },
  grad:      { flexDirection:'row', alignItems:'center', padding:14, gap:10 },
  bar:       { position:'absolute', left:0, top:0, bottom:0, width:3, borderTopLeftRadius:16, borderBottomLeftRadius:16 },
  iconBox:   { width:34, height:34, borderRadius:17, alignItems:'center', justifyContent:'center' },
  info:      { flex:1, gap:2 },
  title:     { fontFamily:fonts.sansMedium, fontSize:13 },
  sub:       { fontFamily:fonts.sans, fontSize:11 },
  viewBtn:   { flexDirection:'row', alignItems:'center', gap:2, borderRadius:99, paddingHorizontal:10, paddingVertical:5 },
  viewBtnTxt:{ fontFamily:fonts.sansMedium, fontSize:11 },
});

// ── WeeklySummaryCard ─────────────────────────────────────────────────────────
function WeeklySummaryCard({ summary }) {
  const C = useTheme();
  const { completed, missed, added, rate, byDay, monday } = summary;
  const DAY_LABELS = ['M','T','W','T','F','S','S'];
  const todayIdx   = (new Date().getDay()+6)%7;
  const a0=useRef(new Animated.Value(0)).current, a1=useRef(new Animated.Value(0)).current,
        a2=useRef(new Animated.Value(0)).current, a3=useRef(new Animated.Value(0)).current,
        a4=useRef(new Animated.Value(0)).current, a5=useRef(new Animated.Value(0)).current,
        a6=useRef(new Animated.Value(0)).current;
  const barAnims = [a0,a1,a2,a3,a4,a5,a6];
  const maxVal = Math.max(...byDay,1);
  useEffect(() => {
    barAnims.forEach((anim,i) => Animated.spring(anim,{toValue:(byDay[i]??0)/maxVal,delay:i*60,useNativeDriver:false,tension:60,friction:10}).start());
  }, [byDay[0],byDay[1],byDay[2],byDay[3],byDay[4],byDay[5],byDay[6]]);
  const weekStart = monday instanceof Date ? monday.toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '';
  const weekEnd   = monday instanceof Date ? new Date(monday.getTime()+6*86_400_000).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '';
  const rateColor = rate>=70 ? C.sage : rate>=40 ? C.sky : C.ember;
  return (
    <View style={[ws.card,{backgroundColor:C.cardBg,borderColor:C.creamBorder,shadowColor:C.shadowColor}]}>
      <View style={ws.header}>
        <View>
          <Text style={[ws.title,{color:C.ink}]}>This Week</Text>
          <Text style={[ws.dateRange,{color:C.inkLight}]}>{weekStart} — {weekEnd}</Text>
        </View>
        <View style={[ws.rateBadge,{backgroundColor:rateColor+'18'}]}>
          <Text style={[ws.rateNum,{color:rateColor}]}>{rate}%</Text>
          <Text style={[ws.rateLbl,{color:rateColor}]}>done</Text>
        </View>
      </View>
      <View style={ws.bars}>
        {byDay.map((val,i) => {
          const isToday  = i===todayIdx;
          const barColor = isToday ? C.sage : val>0 ? C.sageMid : C.inkGhost;
          return (
            <View key={i} style={ws.barCol}>
              <View style={[ws.barTrack,{backgroundColor:C.creamDeep}]}>
                <Animated.View style={[ws.barFill,{height:barAnims[i].interpolate({inputRange:[0,1],outputRange:['0%','100%']}),backgroundColor:barColor}]} />
              </View>
              <Text style={[ws.barLabel,{color:C.inkLight},isToday&&{color:C.sage,fontFamily:fonts.sansMedium}]}>
                {DAY_LABELS[i]}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={[ws.statsRow,{borderTopColor:C.creamBorder}]}>
        {[
          {icon:'checkmark-circle-outline',color:C.sage, val:completed,lbl:'Completed'},
          {icon:'close-circle-outline',    color:C.ember,val:missed,   lbl:'Missed'},
          {icon:'add-circle-outline',      color:C.sky,  val:added,    lbl:'Added'},
        ].map(({icon,color,val,lbl},i,arr)=>(
          <React.Fragment key={lbl}>
            <View style={ws.statItem}>
              <Ionicons name={icon} size={14} color={color}/>
              <Text style={[ws.statNum,{color}]}>{val}</Text>
              <Text style={[ws.statLbl,{color:C.inkLight}]}>{lbl}</Text>
            </View>
            {i<arr.length-1&&<View style={[ws.statDiv,{backgroundColor:C.creamBorder}]}/>}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}
const ws = StyleSheet.create({
  card:      { borderRadius:18, borderWidth:1, padding:18, marginBottom:20, shadowOffset:{width:0,height:1}, shadowOpacity:0.05, shadowRadius:8, elevation:1 },
  header:    { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18 },
  title:     { fontFamily:fonts.serif, fontSize:16, letterSpacing:-0.3 },
  dateRange: { fontFamily:fonts.sans, fontSize:11, marginTop:2 },
  rateBadge: { borderRadius:12, padding:10, alignItems:'center', minWidth:52 },
  rateNum:   { fontFamily:fonts.serifBold, fontSize:18, letterSpacing:-0.5 },
  rateLbl:   { fontFamily:fonts.sans, fontSize:10, marginTop:1 },
  bars:      { flexDirection:'row', gap:4, height:64, marginBottom:6, alignItems:'flex-end' },
  barCol:    { flex:1, alignItems:'center', gap:4 },
  barTrack:  { flex:1, width:'70%', borderRadius:4, overflow:'hidden', justifyContent:'flex-end' },
  barFill:   { width:'100%', borderRadius:4 },
  barLabel:  { fontFamily:fonts.sans, fontSize:10 },
  statsRow:  { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop:14, paddingTop:14, borderTopWidth:1 },
  statItem:  { flex:1, alignItems:'center', gap:3 },
  statNum:   { fontFamily:fonts.serifBold, fontSize:18, letterSpacing:-0.5 },
  statLbl:   { fontFamily:fonts.sans, fontSize:10 },
  statDiv:   { width:1, height:28 },
});

// ─── Main HomeScreen ──────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const user   = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const isDark = useThemeStore(s => s.isDark);
  const C      = isDark ? DARK_T : T;

  const [reminders,     setReminders]     = useState([]);
  const [refreshing,    setRefreshing]    = useState(false);
  const [selectedDay,   setSelectedDay]   = useState(new Date());
  const [stats,         setStats]         = useState({ total:0, today:0, completed:0, overdue:0 });
  const [error,         setError]         = useState(null);
  const [activities,    setActivities]    = useState([]);
  const [streak,        setStreak]        = useState(0);
  const [weeklySummary, setWeeklySummary] = useState({ completed:0,missed:0,added:0,rate:0,byDay:Array(7).fill(0),monday:new Date(),sunday:new Date() });

  const scrollY    = useRef(new Animated.Value(0)).current;
  const hdrOpacity = scrollY.interpolate({ inputRange:[0,90], outputRange:[0,1], extrapolate:'clamp' });
  const pollRef    = useRef(null);

  const buildActivities = useCallback((list) => {
    const acts = [];
    if (user?.confirmed_at||user?.created_at) acts.push({key:'email_verified',icon:'shield-checkmark-outline',iconColor:T.sage,iconBg:T.sageLight,title:'Email verified',sub:user.email||'',timestamp:user.confirmed_at||user.created_at});
    if (user?.created_at) acts.push({key:'account_created',icon:'person-add-outline',iconColor:T.sky,iconBg:T.skyLight,title:'Account created',sub:`Welcome, ${user.name?.split(' ')[0]||'there'}!`,timestamp:user.created_at});
    list.filter(r=>r.completed&&(r.completed_at||r.updated_at)).slice(0,5).forEach(r=>acts.push({key:`done_${r.id}`,icon:'checkmark-circle-outline',iconColor:T.sage,iconBg:T.sageLight,title:'Reminder completed',sub:r.title,timestamp:r.completed_at||r.updated_at}));
    list.filter(r=>r.created_at).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,4).forEach(r=>acts.push({key:`created_${r.id}`,icon:'add-circle-outline',iconColor:'#6366F1',iconBg:'#EEF2FF',title:'Reminder created',sub:r.title,timestamp:r.created_at}));
    list.filter(r=>!r.completed&&r.due_date&&new Date(r.due_date)<new Date()).slice(0,3).forEach(r=>acts.push({key:`overdue_${r.id}`,icon:'alert-circle-outline',iconColor:T.ember,iconBg:T.emberLight,title:'Reminder overdue',sub:r.title,timestamp:r.due_date}));
    const seen=new Set();
    setActivities(acts.filter(a=>{if(seen.has(a.key))return false;seen.add(a.key);return true;}).sort((a,b)=>new Date(b.timestamp||0)-new Date(a.timestamp||0)).slice(0,8));
  }, [user]);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setError(null);
    try {
      const data = await getReminders();
      const list = Array.isArray(data) ? data : (data?.reminders||data?.data||[]);
      setReminders(list);
      setStats(computeStats(list));
      buildActivities(list);
      setStreak(computeStreak(list));
      setWeeklySummary(computeWeeklySummary(list));
    } catch {
      if (!silent) setError('Could not load reminders');
    }
  }, [buildActivities]);

  useFocusEffect(useCallback(() => {
    loadData();
    pollRef.current = setInterval(()=>loadData(true), 30_000);
    return () => clearInterval(pollRef.current);
  }, [loadData]));

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const dayReminders = useMemo(() => reminders.filter(r=>r.due_date&&new Date(r.due_date).toDateString()===selectedDay.toDateString()), [reminders,selectedDay]);
  const nextReminder = useMemo(() => reminders.filter(r=>r.due_date&&!r.completed&&new Date(r.due_date)>new Date()).sort((a,b)=>new Date(a.due_date)-new Date(b.due_date))[0], [reminders]);
  const isToday  = selectedDay.toDateString()===new Date().toDateString();
  const dayLabel = isToday ? 'Today' : selectedDay.toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'});

  return (
    <ThemeContext.Provider value={C}>
      <View style={[styles.screen, { backgroundColor:C.cream }]}>
        <StatusBar barStyle={isDark?'light-content':'dark-content'} backgroundColor={C.cream} />

        {/* Sticky header */}
        <Animated.View style={[styles.stickyHdr,{opacity:hdrOpacity,backgroundColor:C.cream,borderBottomColor:C.creamBorder}]}>
          <Text style={[styles.stickyLogo,{color:C.ink}]}>remind</Text>
          <TouchableOpacity onPress={()=>navigation.navigate('Profile')} style={[styles.stickyAv,{backgroundColor:C.sageLight,borderColor:C.sage}]}>
            <Text style={[styles.stickyAvTxt,{color:C.sage}]}>{user?.name?.[0]?.toUpperCase()||'?'}</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          onScroll={Animated.event([{nativeEvent:{contentOffset:{y:scrollY}}}],{useNativeDriver:false})}
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.sage} colors={[C.sage]} />}
        >
          {/* Top bar */}
          <View style={styles.topBar}>
            <View style={styles.logoRow}>
              <View style={styles.logoMark}>
                <View style={[styles.logoRing,{borderColor:C.sage}]} />
                <View style={[styles.logoDot,{backgroundColor:C.sage}]} />
              </View>
              <Text style={[styles.logoWord,{color:C.ink}]}>remind</Text>
            </View>
            <TouchableOpacity onPress={()=>navigation.navigate('Profile')} style={styles.avWrap}>
              <View style={[styles.av,{backgroundColor:C.sageLight,borderColor:C.sage}]}>
                <Text style={[styles.avTxt,{color:C.sage}]}>{user?.name?.[0]?.toUpperCase()||'?'}</Text>
              </View>
              <View style={[styles.onlineDot,{borderColor:C.cream}]} />
            </TouchableOpacity>
          </View>

          {/* Error */}
          {error && (
            <TouchableOpacity style={[styles.errBanner,{backgroundColor:C.emberLight,borderColor:`${C.ember}40`}]} onPress={()=>loadData()} activeOpacity={0.8}>
              <Ionicons name="alert-circle-outline" size={15} color={C.ember} />
              <Text style={[styles.errTxt,{color:C.ember}]}>{error} · Tap to retry</Text>
            </TouchableOpacity>
          )}

          <HeroBanner user={user} stats={stats} streak={streak} />
          <Entrance delay={80}><InsightsStrip stats={stats} reminders={reminders} /></Entrance>
          <DueSoonAlert reminders={reminders} onPress={()=>navigation.navigate('RemindersTab',{screen:'RemindersList'})} />

          <Entrance delay={120}>
            <SectionHead title="Next Up" />
            {nextReminder ? (
              <CountdownTimer targetDate={nextReminder.due_date} title={nextReminder.title} />
            ) : (
              <Card style={{padding:20,marginBottom:20}}>
                <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
                  <Ionicons name="timer-outline" size={20} color={C.inkGhost} />
                  <Text style={{fontFamily:fonts.sans,fontSize:13,color:C.inkLight}}>No upcoming reminders</Text>
                </View>
              </Card>
            )}
          </Entrance>

          <Entrance delay={160}>
            <SectionHead title="Calendar" action={!isToday?'Today':null} onAction={()=>setSelectedDay(new Date())} />
            <CalendarStrip reminders={reminders} selectedDay={selectedDay} onDaySelect={setSelectedDay} />
            <View style={styles.dayHdr}>
              <Text style={[styles.dayHdrTxt,{color:C.ink}]}>{dayLabel}</Text>
              <View style={[styles.dayCount,{backgroundColor:C.sageLight}]}>
                <Text style={[styles.dayCountTxt,{color:C.sage}]}>{dayReminders.length}</Text>
              </View>
            </View>
            <Card style={{marginBottom:20}}>
              {dayReminders.length>0
                ? dayReminders.map((r,i)=>(
                    <View key={r.id||i}>
                      <ReminderRow item={r} onPress={()=>navigation.navigate('RemindersTab',{screen:'ReminderDetail',params:{id:r.id}})} />
                      {i<dayReminders.length-1&&<Divider/>}
                    </View>
                  ))
                : <EmptyDay/>
              }
            </Card>
          </Entrance>

          <Entrance delay={200}>
            <SectionHead title="Quick Actions" />
            <View style={styles.qaRow}>
              <QAction icon="add-circle"    label="Reminder" color={C.sage}  bg={C.sageLight} delay={0}   onPress={()=>navigation.navigate('RemindersTab',{screen:'CreateReminder'})} />
              <QAction icon="people"        label="Friends"  color={C.sky}   bg={C.skyLight}  delay={60}  onPress={()=>navigation.navigate('SocialTab',{screen:'Friends'})} />
              <QAction icon="business"      label="Orgs"     color="#7C3AED" bg="#F5F3FF"     delay={120} onPress={()=>navigation.navigate('OrgsTab',{screen:'OrgsListScreen'})} />
              <QAction icon="document-text" label="Notes"    color="#B45309" bg="#FFFBEB"     delay={180} onPress={()=>navigation.navigate('RemindersTab',{screen:'Notes'})} />
            </View>
          </Entrance>

          <Entrance delay={220}>
            <SectionHead title="Progress" />
            <Card style={{padding:16,marginBottom:20}}>
              {[
                {label:'Completed',value:stats.completed,total:stats.total,color:C.sage},
                {label:'Overdue',  value:stats.overdue,  total:stats.total,color:C.ember},
                {label:"Today's",  value:stats.today||0, total:stats.total,color:C.sky},
              ].map(({label,value,total,color},i,arr)=>{
                const pct = total>0 ? Math.min(value/total,1) : 0;
                return (
                  <View key={label}>
                    <View style={pr.row}>
                      <Text style={[pr.lbl,{color:C.inkMid}]}>{label}</Text>
                      <Text style={[pr.val,{color}]}>{value} <Text style={[pr.of,{color:C.inkLight}]}>/ {total}</Text></Text>
                    </View>
                    <View style={[pr.track,{backgroundColor:C.creamDeep}]}>
                      <View style={[pr.fill,{width:`${pct*100}%`,backgroundColor:color}]} />
                    </View>
                    {i<arr.length-1&&<View style={{height:12}}/>}
                  </View>
                );
              })}
            </Card>
          </Entrance>

          <Entrance delay={240}>
            <SectionHead title="Weekly Summary" />
            <WeeklySummaryCard summary={weeklySummary} />
          </Entrance>

          <Entrance delay={260}>
            <SectionHead title="Recent Activity" badge={activities.length} />
            <Card style={{marginBottom:20}}>
              {activities.length===0
                ? <View style={{padding:20,alignItems:'center'}}><Text style={{fontFamily:fonts.sans,fontSize:13,color:C.inkLight}}>No activity yet</Text></View>
                : activities.map((act,i)=>(
                    <ActivityItem key={act.key} icon={act.icon} iconColor={act.iconColor} iconBg={act.iconBg} title={act.title} sub={act.sub} timestamp={act.timestamp} showDivider={i<activities.length-1} />
                  ))
              }
            </Card>
          </Entrance>

          <TouchableOpacity style={styles.signOut} onPress={logout} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={14} color={C.inkLight} />
            <Text style={[styles.signOutTxt,{color:C.inkLight}]}>Sign out</Text>
          </TouchableOpacity>
          <View style={{height:100}} />
        </Animated.ScrollView>
      </View>
    </ThemeContext.Provider>
  );
}

// ─── Progress styles ──────────────────────────────────────────────────────────
const pr = StyleSheet.create({
  row:   { flexDirection:'row', justifyContent:'space-between', marginBottom:6 },
  lbl:   { fontFamily:fonts.sans, fontSize:12 },
  val:   { fontFamily:fonts.sansMedium, fontSize:12 },
  of:    { fontFamily:fonts.sans },
  track: { height:5, borderRadius:99, overflow:'hidden' },
  fill:  { height:5, borderRadius:99 },
});

// ─── Screen styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen:     { flex:1 },
  scroll:     { paddingHorizontal:20, paddingTop:Platform.OS==='ios'?60:50 },
  stickyHdr:  { position:'absolute', top:0, left:0, right:0, zIndex:100, borderBottomWidth:1, flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:20, paddingTop:Platform.OS==='ios'?54:18, paddingBottom:12 },
  stickyLogo: { fontFamily:fonts.serifBold, fontSize:18, letterSpacing:-0.4 },
  stickyAv:   { width:30, height:30, borderRadius:15, borderWidth:1.5, alignItems:'center', justifyContent:'center' },
  stickyAvTxt:{ fontFamily:fonts.serifBold, fontSize:12 },
  topBar:     { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:20 },
  logoRow:    { flexDirection:'row', alignItems:'center', gap:8 },
  logoMark:   { width:30, height:30, alignItems:'center', justifyContent:'center' },
  logoRing:   { position:'absolute', width:30, height:30, borderRadius:15, borderWidth:2 },
  logoDot:    { position:'absolute', width:8, height:8, borderRadius:4 },
  logoWord:   { fontFamily:fonts.serifBold, fontSize:22, letterSpacing:-0.5 },
  avWrap:     { position:'relative' },
  av:         { width:44, height:44, borderRadius:22, borderWidth:2, alignItems:'center', justifyContent:'center' },
  avTxt:      { fontFamily:fonts.serifBold, fontSize:18 },
  onlineDot:  { position:'absolute', bottom:1, right:1, width:11, height:11, borderRadius:6, backgroundColor:'#34D399', borderWidth:2 },
  errBanner:  { flexDirection:'row', alignItems:'center', gap:8, borderRadius:12, padding:12, marginBottom:16, borderWidth:1 },
  errTxt:     { fontFamily:fonts.sans, fontSize:13, flex:1 },
  dayHdr:     { flexDirection:'row', alignItems:'center', gap:8, marginBottom:8, marginTop:4 },
  dayHdrTxt:  { fontFamily:fonts.sansMedium, fontSize:14 },
  dayCount:   { borderRadius:99, width:22, height:22, alignItems:'center', justifyContent:'center' },
  dayCountTxt:{ fontFamily:fonts.sansMedium, fontSize:11 },
  qaRow:      { flexDirection:'row', gap:8, marginBottom:20 },
  signOut:    { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, paddingVertical:14 },
  signOutTxt: { fontFamily:fonts.sans, fontSize:13 },
});