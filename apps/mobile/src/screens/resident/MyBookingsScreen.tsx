import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import api from '../../api/client';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import BottomTabBar from '../../components/BottomTabBar';
import { colors, spacing, radius, STATUS_CONFIG, ICON_MAP } from '../../theme';
import type { ResidentStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<ResidentStackParamList, 'MyBookings'>;

type FilterKey = 'all' | 'active' | 'completed' | 'cancelled';

const ACTIVE_STATUSES = ['pending_quote', 'quoted', 'confirmed', 'in_progress'];

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'active',    label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

interface Category { id: string; name: string; icon_name: string }

interface Booking {
  id: string;
  status: string;
  category_id: string;
  category_name: string;
  address: string;
  scheduled_at: string;
  professional_name: string | null;
  quote_amount: number | null;
}

function applyFilter(bookings: Booking[], filter: FilterKey): Booking[] {
  switch (filter) {
    case 'active':    return bookings.filter((b) => ACTIVE_STATUSES.includes(b.status));
    case 'completed': return bookings.filter((b) => b.status === 'completed');
    case 'cancelled': return bookings.filter((b) => b.status === 'cancelled');
    default:          return bookings;
  }
}

function formatDate(str: string) {
  try {
    return new Date(str).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return str; }
}

export default function MyBookingsScreen() {
  const navigation = useNavigation<Nav>();

  const [bookings, setBookings]     = useState<Booking[]>([]);
  const [iconMap, setIconMap]       = useState<Record<string, string>>({});
  const [filter, setFilter]         = useState<FilterKey>('all');
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [bkgRes, catRes] = await Promise.all([
        api.get('/bookings'),
        api.get('/categories'),
      ]);
      setBookings(bkgRes.data ?? []);

      const map: Record<string, string> = {};
      for (const c of (catRes.data ?? []) as Category[]) {
        map[c.id] = c.icon_name;
      }
      setIconMap(map);
    } catch {
      // keep stale
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  const filtered = applyFilter(bookings, filter);

  const emptyMessages: Record<FilterKey, string> = {
    all:       'No bookings yet. Tap + to request a service.',
    active:    'No active bookings. Tap + to request a service.',
    completed: 'No completed bookings yet.',
    cancelled: 'No cancelled bookings.',
  };

  function renderCard({ item }: { item: Booking }) {
    const cfg  = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.cancelled;
    const icon = ICON_MAP[iconMap[item.category_id] ?? ''] ?? 'construct-outline';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('BookingDetail', { booking_id: item.id })}
        activeOpacity={0.8}
      >
        {/* Top row */}
        <View style={styles.cardTop}>
          <View style={styles.iconBox}>
            <Ionicons name={icon as any} size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardCategory}>{item.category_name}</Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {formatDate(item.scheduled_at)}  ·  {item.address}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
          </View>
        </View>

        {/* Bottom row */}
        <View style={styles.cardBottom}>
          <Text style={styles.cardPro} numberOfLines={1}>
            {item.professional_name ? `👷 ${item.professional_name}` : 'Pending assignment'}
          </Text>
          <Text style={styles.cardAmount}>
            {item.quote_amount != null
              ? `PKR ${item.quote_amount.toLocaleString()}`
              : 'Awaiting quote'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Bookings</Text>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
            onPress={() => setFilter(f.key)}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1 }}>
          <EmptyState icon="document-text-outline" title={emptyMessages[filter]} subtitle="" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(b) => b.id}
          renderItem={renderCard}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        />
      )}

      <BottomTabBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },

  header:      { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.card },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.text },

  filterRow: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterBtn: {
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.background,
  },
  filterBtnActive: { backgroundColor: colors.primaryLight },
  filterText:      { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  filterTextActive: { color: colors.primary },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4,
    elevation: 2,
  },
  cardTop:      { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  iconBox:      {
    width: 36, height: 36, borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  cardCategory: { fontSize: 14, fontWeight: '700', color: colors.text },
  cardMeta:     { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  badge:        { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:    { fontSize: 11, fontWeight: '600' },

  cardBottom:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardPro:     { fontSize: 13, color: colors.textMuted, flex: 1 },
  cardAmount:  { fontSize: 13, fontWeight: '700', color: colors.primary },
});
