import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Switch, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import api from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import Avatar from '../../components/Avatar';
import StarRating from '../../components/StarRating';
import ProfessionalTabBar from '../../components/ProfessionalTabBar';
import { colors, spacing, radius } from '../../theme';

interface ProProfile {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  rating: number;
  total_jobs: number;
  is_available: boolean;
  bio: string;
  categories: { id: string; name: string }[];
}

export default function ProfileScreen() {
  const logout = useAuthStore((s) => s.logout);

  const [pro, setPro]           = useState<ProProfile | null>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const { data } = await api.get('/professionals/me');
      setPro(data);
    } catch {
      // keep stale
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchProfile(); }, [fetchProfile]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProfile();
  }, [fetchProfile]);

  async function toggleAvailability() {
    if (!pro || toggling) return;
    setToggling(true);
    const next = !pro.is_available;
    try {
      const { data } = await api.patch('/professionals/me/availability', { is_available: next });
      setPro((p) => p ? { ...p, is_available: data.is_available } : p);
    } catch {
      Alert.alert('Error', 'Could not update availability. Please try again.');
    } finally {
      setToggling(false);
    }
  }

  async function handleLogout() {
    await logout();
    // RootNavigator re-renders to AuthNavigator automatically.
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={{ paddingBottom: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Profile hero */}
        <View style={styles.hero}>
          <Avatar name={pro?.name ?? '?'} size={72} />
          <Text style={styles.heroName}>{pro?.name ?? '—'}</Text>
          <Text style={styles.heroPhone}>{pro?.phone ?? '—'}</Text>
          <StarRating rating={pro?.rating ?? 0} size={18} showNumber />
          <Text style={styles.heroJobs}>{pro?.total_jobs ?? 0} jobs completed</Text>
        </View>

        {/* Availability toggle */}
        <View style={styles.row}>
          <View>
            <Text style={styles.rowLabel}>Availability</Text>
            <Text style={styles.rowSub}>
              {pro?.is_available ? 'You are visible to residents' : 'You are marked as busy'}
            </Text>
          </View>
          <Switch
            value={Boolean(pro?.is_available)}
            onValueChange={toggleAvailability}
            disabled={toggling}
            trackColor={{ false: colors.border, true: '#86EFAC' }}
            thumbColor={pro?.is_available ? colors.success : colors.textLight}
          />
        </View>

        {/* Bio */}
        {pro?.bio ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bio</Text>
            <Text style={styles.bioText}>{pro.bio}</Text>
          </View>
        ) : null}

        {/* Categories */}
        {(pro?.categories?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Services</Text>
            <View style={styles.chips}>
              {(pro!.categories ?? []).map((c) => (
                <View key={c.id} style={styles.chip}>
                  <Text style={styles.chipText}>{c.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stats</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{pro?.total_jobs ?? 0}</Text>
              <Text style={styles.statLabel}>Jobs Done</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {pro && pro.rating > 0 ? pro.rating.toFixed(1) : '—'}
              </Text>
              <Text style={styles.statLabel}>Avg. Rating</Text>
            </View>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>

      <ProfessionalTabBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },
  root:   { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  hero: {
    backgroundColor: colors.card, alignItems: 'center',
    paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl,
    gap: 6, marginBottom: spacing.sm,
  },
  heroName:  { fontSize: 20, fontWeight: '800', color: colors.text },
  heroPhone: { fontSize: 14, color: colors.textMuted },
  heroJobs:  { fontSize: 13, color: colors.textMuted },

  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.card, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
    marginBottom: spacing.sm,
  },
  rowLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowSub:   { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  section:      { backgroundColor: colors.card, padding: spacing.xl, marginBottom: spacing.sm },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textMuted, marginBottom: spacing.md },
  bioText:      { fontSize: 14, color: colors.text, lineHeight: 21 },

  chips:    { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip:     { backgroundColor: colors.primaryLight, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5 },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.primary },

  statsRow:    { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  statItem:    { alignItems: 'center' },
  statValue:   { fontSize: 28, fontWeight: '800', color: colors.text },
  statLabel:   { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  statDivider: { width: 1, height: 40, backgroundColor: colors.border },

  logoutBtn: {
    marginHorizontal: spacing.lg, marginVertical: spacing.xl,
    borderRadius: radius.lg, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1.5, borderColor: colors.error,
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: colors.error },
});
