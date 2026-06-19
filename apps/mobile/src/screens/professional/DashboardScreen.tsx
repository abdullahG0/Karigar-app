import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Switch, RefreshControl, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import api from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import ProfessionalTabBar from '../../components/ProfessionalTabBar';
import { colors, spacing, radius } from '../../theme';
import type { ProfessionalStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<ProfessionalStackParamList, 'Dashboard'>;

interface ProProfile {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  rating: number;
  total_jobs: number;
  is_available: boolean;
  bio: string;
}

interface Booking {
  id: string;
  status: string;
  category_name: string;
  category_id: string;
  problem_description: string;
  address: string;
  created_at: string;
}

function timeAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return 'Just now';
}

export default function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);

  const [pro, setPro]           = useState<ProProfile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [proRes, bkgRes] = await Promise.all([
        api.get('/professionals/me'),
        api.get('/bookings'),
      ]);
      setPro(proRes.data);
      setBookings(bkgRes.data ?? []);
    } catch {
      // keep stale on error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  async function toggleAvailability() {
    if (!pro || toggling) return;
    setToggling(true);
    const next = !pro.is_available;
    try {
      const { data } = await api.patch('/professionals/me/availability', { is_available: next });
      setPro((p) => p ? { ...p, is_available: data.is_available } : p);
    } catch {
      // revert implicit — no optimistic update
    } finally {
      setToggling(false);
    }
  }

  const pendingRequests = bookings.filter((b) => b.status === 'pending_quote');
  const activeCount     = bookings.filter((b) => b.status === 'in_progress').length;

  function renderRequest({ item }: { item: Booking }) {
    return (
      <View style={styles.reqCard}>
        <View style={styles.reqTop}>
          <Text style={styles.reqCategory}>{item.category_name}</Text>
          <Text style={styles.reqTime}>{timeAgo(item.created_at)}</Text>
        </View>
        <Text style={styles.reqDesc} numberOfLines={2}>
          {item.problem_description}
        </Text>
        <Text style={styles.reqAddress} numberOfLines={1}>📍 {item.address}</Text>
        <TouchableOpacity
          style={styles.quoteBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('SendQuote', { booking_id: item.id })}
        >
          <Text style={styles.quoteBtnText}>Send Quote</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Welcome back</Text>
          <Text style={styles.name}>{user?.name ?? '—'}</Text>
        </View>
        <View style={styles.toggleWrap}>
          <Text style={styles.toggleLabel}>
            {pro?.is_available ? 'Available' : 'Busy'}
          </Text>
          <Switch
            value={Boolean(pro?.is_available)}
            onValueChange={toggleAvailability}
            disabled={toggling || loading}
            trackColor={{ false: colors.border, true: '#86EFAC' }}
            thumbColor={pro?.is_available ? colors.success : colors.textLight}
          />
        </View>
      </View>

      <ScrollView
        style={styles.root}
        contentContainerStyle={{ paddingBottom: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatCard label="Jobs Done" value={String(pro?.total_jobs ?? 0)} />
          <StatCard
            label="Rating"
            value={pro && pro.rating > 0 ? `${pro.rating.toFixed(1)} ⭐` : '—'}
          />
          <StatCard label="Active" value={String(activeCount)} highlight={activeCount > 0} />
        </View>

        {/* New requests */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            New Requests Near You
            {pendingRequests.length > 0 && (
              <Text style={styles.badge}> {pendingRequests.length}</Text>
            )}
          </Text>
          {pendingRequests.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="file-tray-outline" size={32} color={colors.textMuted} style={{ marginBottom: 6 }} />
              <Text style={styles.emptyText}>No new requests at the moment.</Text>
            </View>
          ) : (
            <FlatList
              data={pendingRequests}
              keyExtractor={(b) => b.id}
              renderItem={renderRequest}
              scrollEnabled={false}
              contentContainerStyle={{ gap: spacing.md }}
            />
          )}
        </View>
      </ScrollView>

      <ProfessionalTabBar />
    </SafeAreaView>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={[statStyles.card, highlight && statStyles.cardHighlight]}>
      <Text style={[statStyles.value, highlight && statStyles.valueHighlight]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card:           { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' },
  cardHighlight:  { backgroundColor: '#FFF7ED', borderWidth: 1.5, borderColor: '#FDBA74' },
  value:          { fontSize: 22, fontWeight: '800', color: colors.text },
  valueHighlight: { color: '#C2410C' },
  label:          { fontSize: 11, color: colors.textMuted, marginTop: 2, textAlign: 'center' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  root: { flex: 1 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerLeft: { gap: 2 },
  greeting:   { fontSize: 12, color: colors.textMuted },
  name:       { fontSize: 20, fontWeight: '800', color: colors.text },
  toggleWrap: { alignItems: 'center', gap: 2 },
  toggleLabel:{ fontSize: 11, fontWeight: '600', color: colors.textMuted },

  statsRow: {
    flexDirection: 'row', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.lg,
  },

  section:      { paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  badge:        { color: colors.primary, fontSize: 15 },

  reqCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg, padding: spacing.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  reqTop:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  reqCategory: { fontSize: 14, fontWeight: '700', color: colors.text },
  reqTime:     { fontSize: 12, color: colors.textMuted },
  reqDesc:     { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginBottom: spacing.sm },
  reqAddress:  { fontSize: 12, color: colors.textLight, marginBottom: spacing.md },

  quoteBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 10, alignItems: 'center',
  },
  quoteBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },

  emptyBox:  { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyIcon: { fontSize: 32, marginBottom: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textMuted },
});
