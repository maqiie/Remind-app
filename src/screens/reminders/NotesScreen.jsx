// src/screens/reminders/NotesScreen.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, StatusBar, ActivityIndicator, RefreshControl,
  KeyboardAvoidingView, Platform, Animated, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, spacing, radius } from '../../theme';
import { getNotes, createNote, updateNote, deleteNote } from '../../api/reminders';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function NoteCard({ item, onPress, onDelete }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={{ opacity: anim }}>
      <TouchableOpacity style={nc.card} onPress={onPress} activeOpacity={0.75}>
        <View style={nc.top}>
          <Text style={nc.title} numberOfLines={1}>{item.title || 'Untitled'}</Text>
          <TouchableOpacity onPress={() => onDelete(item.id)} hitSlop={10}>
            <Ionicons name="trash-outline" size={15} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
        {!!item.content && (
          <Text style={nc.content} numberOfLines={3}>{item.content}</Text>
        )}
        <Text style={nc.time}>{timeAgo(item.updated_at || item.created_at)}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function EmptyState({ onAdd }) {
  return (
    <View style={es.wrap}>
      <View style={es.icon}><Ionicons name="document-text-outline" size={34} color={colors.textMuted} /></View>
      <Text style={es.title}>No notes yet</Text>
      <Text style={es.sub}>Tap + to jot something down</Text>
      <TouchableOpacity style={es.btn} onPress={onAdd}>
        <Ionicons name="add" size={16} color={colors.primary} />
        <Text style={es.btnTxt}>New note</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function NotesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [notes,      setNotes]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing,    setEditing]    = useState(null);   // null | note object
  const [form,       setForm]       = useState({ title: '', content: '' });
  const [saving,     setSaving]     = useState(false);
  const fabAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(fabAnim, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 14 }).start();
    load();
  }, []);

  const load = async () => {
    try {
      const data = await getNotes();
      const list = Array.isArray(data) ? data : (data?.notes || data?.data || []);
      setNotes(list);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  const openNew  = () => { setForm({ title: '', content: '' }); setEditing({}); };
  const openEdit = (note) => { setForm({ title: note.title || '', content: note.content || '' }); setEditing(note); };
  const closeEdit= () => { setEditing(null); };

  const handleSave = async () => {
    if (!form.title.trim() && !form.content.trim()) { closeEdit(); return; }
    setSaving(true);
    try {
      if (editing?.id) {
        const updated = await updateNote(editing.id, form);
        setNotes((prev) => prev.map((n) => n.id === editing.id ? (updated?.note || updated) : n));
      } else {
        const created = await createNote(form);
        setNotes((prev) => [created?.note || created, ...prev]);
      }
      closeEdit();
    } catch {
      Alert.alert('Error', 'Could not save note');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const bk = [...notes];
    setNotes((prev) => prev.filter((n) => n.id !== id));
    try { await deleteNote(id); }
    catch { setNotes(bk); }
  };

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Notes</Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={{ gap: 10 }}
          renderItem={({ item }) => (
            <NoteCard item={item} onPress={() => openEdit(item)} onDelete={handleDelete} />
          )}
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState onAdd={openNew} />}
        />
      )}

      {/* FAB */}
      <Animated.View style={[s.fab, { transform: [{ scale: fabAnim }], bottom: insets.bottom + 90 }]}>
        <TouchableOpacity style={s.fabBtn} onPress={openNew} activeOpacity={0.85}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      {/* Edit sheet (inline modal) */}
      {editing !== null && (
        <KeyboardAvoidingView
          style={s.sheetOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={s.sheetBackdrop} onPress={closeEdit} activeOpacity={1} />
          <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={s.sheetHandle} />
            <View style={s.sheetNav}>
              <Text style={s.sheetTitle}>{editing?.id ? 'Edit Note' : 'New Note'}</Text>
              <TouchableOpacity style={s.sheetSaveBtn} onPress={handleSave} disabled={saving}>
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.sheetSaveTxt}>Save</Text>
                }
              </TouchableOpacity>
            </View>
            <TextInput
              style={s.sheetTitleInput}
              value={form.title}
              onChangeText={(t) => setForm((f) => ({ ...f, title: t }))}
              placeholder="Title"
              placeholderTextColor={colors.textMuted}
              autoFocus={!editing?.id}
            />
            <View style={s.sheetDivider} />
            <TextInput
              style={s.sheetBodyInput}
              value={form.content}
              onChangeText={(t) => setForm((f) => ({ ...f, content: t }))}
              placeholder="Write your note…"
              placeholderTextColor={colors.textMuted}
              multiline
            />
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const nc = StyleSheet.create({
  card:    { flex: 1, backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 6, minHeight: 100 },
  top:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title:   { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.textPrimary, flex: 1, marginRight: 6 },
  content: { fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  time:    { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, marginTop: 4 },
});

const es = StyleSheet.create({
  wrap:   { alignItems: 'center', paddingTop: 80, gap: 10 },
  icon:   { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.bgInput, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title:  { fontFamily: fonts.serif, fontSize: 20, color: colors.textPrimary },
  sub:    { fontFamily: fonts.sans, fontSize: 14, color: colors.textMuted },
  btn:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.full, backgroundColor: colors.primaryLight },
  btnTxt: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.primary },
});

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: colors.bg },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:   { fontFamily: fonts.serifBold, fontSize: 22, color: colors.textPrimary, letterSpacing: -0.4 },
  list:    { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: 10 },
  fab:     { position: 'absolute', right: spacing.md },
  fabBtn:  { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 10 },
  sheetOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  sheetBackdrop:{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet:        { backgroundColor: colors.bgCard, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  sheetHandle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.md },
  sheetNav:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  sheetTitle:   { fontFamily: fonts.serifBold, fontSize: 18, color: colors.textPrimary },
  sheetSaveBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: 8, borderRadius: radius.full },
  sheetSaveTxt: { fontFamily: fonts.sansMedium, fontSize: 14, color: '#fff' },
  sheetTitleInput: { fontFamily: fonts.sansMedium, fontSize: 18, color: colors.textPrimary, padding: 0, marginBottom: spacing.sm },
  sheetDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginBottom: spacing.sm },
  sheetBodyInput:  { fontFamily: fonts.sans, fontSize: 15, color: colors.textPrimary, minHeight: 140, textAlignVertical: 'top', padding: 0 },
});