import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import api from '../../api/client';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import ProfessionalTabBar from '../../components/ProfessionalTabBar';
import { colors, spacing, radius, STATUS_CONFIG } from '../../theme';
import { formatDate } from '../../utils/dateUtils';
import type { ProfessionalStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<ProfessionalStackParamList, 'Jobs'>;
type FilterKey = 'active' | 'completed';

const ACTIVE_STATUSES = ['confirmed', 'in_progress'];

interface Booking {
  id: string;
  status: string;
  category_name: string;
  address: string;
  scheduled_at: string;
  quote_amount: number | null;
  resident_name: string;
}


export default function JobsScreen() {
  const navigation = useNavigation<Nav>();

  const [bookings, setBookings]     = useState<Booking[]>([]);
  const [filter, setFilter]         = useState<FilterKey>('active');
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBookings = useCallback(async () => {
    try {
      const { data } = await api.get('/bookings');
      setBookings(data ?? []);
    } catch {
      // keep stale
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchBookings(); }, [fetchBookings]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBookings();
  }, [fetchBookings]);

  const filtered = bookings.filter((b) =>
    filter === 'active'
      ? ACTIVE_STATUSES.includes(b.status)
      : b.status === 'completed'
  );

  function renderCard({ item }: { item: Booking }) {
    const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.cancelled;
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('JobDetail', { booking_id: item.id })}
      >
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardResident}>👤 {item.resident_name}</Text>
            <Text style={styles.cardCategory}>{item.category_name}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
          </View>
        </View>

        <Text style={styles.cardAddress} numberOfLines={1}>📍 {item.address}</Text>

        <View style={styles.cardBottom}>
          <Text style={styles.cardDate}>{formatDate(item.scheduled_at)}</Text>
          <Text style={styles.cardAmount}>
            {item.quote_amount != null
              ? `PKR ${item.quote_amount.toLocaleString()}`
              : '—'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Jobs</Text>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(['active', 'completed'] as FilterKey[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'active' ? 'Active' : 'Completed'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1 }}>
          <EmptyState
            icon={filter === 'active' ? 'briefcase-outline' : 'checkmark-circle-outline'}
            title={filter === 'active' ? 'No active jobs' : 'No completed jobs yet'}
            subtitle=""
          />
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

      <ProfessionalTabBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },

  header:      { backgroundColor: colors.card, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.text },

  filterRow: {
    flexDirection: 'row', backgroundColor: colors.card,
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  filterBtn:       { paddingHorizontal: spacing.lg, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.background },
  filterBtnActive: { backgroundColor: colors.primaryLight },
  filterText:      { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  filterTextActive:{ color: colors.primary },

  card: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    padding: spacing.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardTop:      { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.xs },
  cardResident: { fontSize: 12, color: colors.textMuted },
  cardCategory: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 2 },
  badge:        { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:    { fontSize: 11, fontWeight: '600' },

  cardAddress:  { fontSize: 12, color: colors.textLight, marginBottom: spacing.sm },
  cardBottom:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDate:     { fontSize: 12, color: colors.textMuted },
  cardAmount:   { fontSize: 14, fontWeight: '700', color: colors.primary },
});
