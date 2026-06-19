import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import api from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { colors, spacing, radius } from '../../theme';
import { SOCKET_URL } from '../../config';

// Generic — works in both ResidentStackParamList and ProfessionalStackParamList.
interface Props {
  route: { params: { booking_id: string; other_user_name: string } };
  navigation: NativeStackNavigationProp<any>;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  booking_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
}

type DateItem    = { type: 'date'; id: string; label: string };
type MessageItem = Message & { type: 'message' };
type RenderItem  = DateItem | MessageItem;

// ── Helpers ──────────────────────────────────────────────────────────────────

function isSameDay(a: Date, b: Date) {
  return (
    a.getDate()     === b.getDate()  &&
    a.getMonth()    === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

function getDateLabel(isoStr: string): string {
  try {
    const d   = new Date(isoStr);
    const now = new Date();
    const yest = new Date(now);
    yest.setDate(now.getDate() - 1);
    if (isSameDay(d, now))  return 'Today';
    if (isSameDay(d, yest)) return 'Yesterday';
    return d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

function formatTime(isoStr: string): string {
  try {
    return new Date(isoStr).toLocaleTimeString('en-PK', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch {
    return '';
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DateSeparator({ label }: { label: string }) {
  return (
    <View style={sepStyles.row}>
      <View style={sepStyles.line} />
      <Text style={sepStyles.label}>{label}</Text>
      <View style={sepStyles.line} />
    </View>
  );
}

const sepStyles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.md, paddingHorizontal: spacing.sm },
  line:  { flex: 1, height: 1, backgroundColor: colors.border },
  label: { fontSize: 12, color: colors.textMuted, marginHorizontal: spacing.sm },
});

function Bubble({ msg, isOwn }: { msg: Message; isOwn: boolean }) {
  return (
    <View style={[bubStyles.row, isOwn ? bubStyles.rowOwn : bubStyles.rowOther]}>
      <View style={[bubStyles.bubble, isOwn ? bubStyles.bubbleOwn : bubStyles.bubbleOther]}>
        {!isOwn && (
          <Text style={bubStyles.senderName}>{msg.sender_name}</Text>
        )}
        <Text style={[bubStyles.content, isOwn ? bubStyles.contentOwn : bubStyles.contentOther]}>
          {msg.content}
        </Text>
        <Text style={[bubStyles.time, isOwn ? bubStyles.timeOwn : bubStyles.timeOther]}>
          {formatTime(msg.created_at)}
        </Text>
      </View>
    </View>
  );
}

const bubStyles = StyleSheet.create({
  row:      { paddingVertical: 2, paddingHorizontal: spacing.sm },
  rowOwn:   { alignItems: 'flex-end' },
  rowOther: { alignItems: 'flex-start' },

  bubble: {
    maxWidth: '78%',
    borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9,
  },
  bubbleOwn: {
    backgroundColor: '#1A6B4A',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#F3F4F6',
    borderBottomLeftRadius: 4,
  },

  senderName: { fontSize: 11, fontWeight: '700', color: colors.primary, marginBottom: 3 },

  content:      { fontSize: 15, lineHeight: 20 },
  contentOwn:   { color: colors.white },
  contentOther: { color: colors.text },

  time:      { fontSize: 10, marginTop: 4 },
  timeOwn:   { color: 'rgba(255,255,255,0.65)', textAlign: 'right' },
  timeOther: { color: colors.textLight },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ChatScreen({ route, navigation }: Props) {
  const { booking_id, other_user_name } = route.params;
  const user  = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);

  const [messages, setMessages]   = useState<Message[]>([]);
  const [text, setText]           = useState('');
  const [typingName, setTypingName] = useState('');

  const flatRef        = useRef<FlatList<RenderItem>>(null);
  const socketRef      = useRef<Socket | null>(null);
  const typingTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Custom header ─────────────────────────────────────────────────────────

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={hdrStyles.wrap}>
          <Text style={hdrStyles.name}>{other_user_name}</Text>
          <Text style={hdrStyles.sub}>
            Booking #{booking_id.slice(0, 8).toUpperCase()}
          </Text>
        </View>
      ),
    });
  }, [navigation, other_user_name, booking_id]);

  // ── Load history ──────────────────────────────────────────────────────────

  useEffect(() => {
    api.get(`/messages/${booking_id}`)
      .then((r) => setMessages(r.data ?? []))
      .catch(() => {});
  }, [booking_id]);

  // ── Socket lifecycle ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;

    const socket = io(SOCKET_URL, {
      auth: { token, userId: user.id },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_booking_room', { booking_id });
    });

    socket.on('new_message', (msg: Message) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    socket.on('user_typing', ({ sender_id }: { sender_id: string }) => {
      if (sender_id === user.id) return;
      setTypingName(other_user_name);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTypingName(''), 3000);
    });

    return () => {
      socket.emit('leave_room', { room: `booking_${booking_id}` });
      socket.disconnect();
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [booking_id, user]);

  // ── Render list (date separators interspersed) ────────────────────────────

  const renderItems = useMemo((): RenderItem[] => {
    const items: RenderItem[] = [];
    let lastLabel = '';

    for (const msg of messages) {
      const label = getDateLabel(msg.created_at);
      if (label !== lastLabel) {
        items.push({ type: 'date', id: `sep-${msg.id}`, label });
        lastLabel = label;
      }
      items.push({ type: 'message', ...msg });
    }

    // Reverse so FlatList inverted renders newest at the bottom of the screen.
    return items.reverse();
  }, [messages]);

  // ── Actions ───────────────────────────────────────────────────────────────

  function handleTyping(val: string) {
    setText(val);
    socketRef.current?.emit('typing', { booking_id, sender_id: user?.id });
  }

  function sendMessage() {
    const content = text.trim();
    if (!content || !user || !socketRef.current?.connected) return;
    socketRef.current.emit('send_message', {
      booking_id,
      sender_id: user.id,
      content,
    });
    setText('');
  }

  // ── Item renderer ─────────────────────────────────────────────────────────

  function renderItem({ item }: { item: RenderItem }) {
    if (item.type === 'date') {
      return <DateSeparator label={item.label} />;
    }
    return <Bubble msg={item} isOwn={item.sender_id === user?.id} />;
  }

  // ── Empty state ───────────────────────────────────────────────────────────

  const emptyComp = useMemo(
    () => (
      <View style={styles.empty}>
        <View style={styles.emptyIconWrap}>
          <Ionicons name="chatbubble-ellipses-outline" size={32} color={colors.textMuted} />
        </View>
        <Text style={styles.emptyText}>
          No messages yet. Say hello to {other_user_name}!
        </Text>
      </View>
    ),
    [other_user_name]
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Messages */}
        <FlatList
          ref={flatRef}
          data={renderItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          inverted
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={emptyComp}
        />

        {/* Typing indicator */}
        {typingName ? (
          <View style={styles.typingRow}>
            <Text style={styles.typingText}>{typingName} is typing…</Text>
          </View>
        ) : null}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={handleTyping}
            placeholder="Type a message…"
            placeholderTextColor={colors.textLight}
            multiline
            maxLength={1000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, !text.trim() && styles.sendBtnOff]}
            onPress={sendMessage}
            disabled={!text.trim()}
            activeOpacity={0.8}
          >
            <Ionicons name="send" size={18} color={colors.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Header styles (used in navigation.setOptions) ────────────────────────────

const hdrStyles = StyleSheet.create({
  wrap: { alignItems: Platform.OS === 'ios' ? 'center' : 'flex-start' },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  sub:  { fontSize: 11, color: colors.textMuted, marginTop: 1 },
});

// ── Screen styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ECEEF0' },

  listContent: { paddingHorizontal: spacing.xs, paddingVertical: spacing.md },

  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIconWrap:{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  emptyText:    { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },

  typingRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 5,
    backgroundColor: '#ECEEF0',
  },
  typingText: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic' },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: 40, maxHeight: 120,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, color: colors.text,
    lineHeight: 20,
  },
  sendBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnOff: { backgroundColor: colors.border },
});
