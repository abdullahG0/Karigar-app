import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ScrollView, TextInput,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import api from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import BottomTabBar from '../../components/BottomTabBar';
import {
  colors, spacing, radius,
  STATUS_CONFIG, CATEGORY_BG, CATEGORY_ICON_COLOR, ICON_MAP,
} from '../../theme';
import type { ResidentStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<ResidentStackParamList, 'Home'>;

const ACTIVE_STATUSES = ['pending_quote', 'quoted', 'confirmed', 'in_progress'];

const SOCIETY_NAMES: Record<string, string> = {
  'soc_pvc_isl': 'ParkView City · Islamabad',
  'soc_pvc_lhr': 'ParkView City · Lahore',
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

interface Category {
  id: string;
  name: string;
  icon_name: string;
  base_price_min: number;
}

interface Booking {
  id: string;
  status: string;
  category_name: string;
  professional_name?: string;
}

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { user, logout } = useAuthStore();

  const [categories, setCategories] = useState<Category[]>([]);
  const [bookings, setBookings]     = useState<Booking[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [catRes, bkgRes] = await Promise.all([
        api.get('/categories'),
        api.get('/bookings'),
      ]);
      setCategories(catRes.data ?? []);
      const active = (bkgRes.data ?? []).filter((b: Booking) =>
        ACTIVE_STATUSES.includes(b.status)
      );
      setBookings(active);
    } catch {
      // Silent — stale data is fine on first open
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  function renderCategoryCard({ item, index }: { item: Category; index: number }) {
    const bg   = CATEGORY_BG[index % CATEGORY_BG.length];
    const ic   = CATEGORY_ICON_COLOR[index % CATEGORY_ICON_COLOR.length];
    const icon = ICON_MAP[item.icon_name] ?? 'construct-outline';
    return (
      <TouchableOpacity
        style={styles.catCard}
        activeOpacity={0.75}
        onPress={() =>
          navigation.navigate('ProfessionalList', {
            category_id: item.id,
            category_name: item.name,
          })
        }
      >
        <View style={[styles.catIconBox, { backgroundColor: bg }]}>
          <Ionicons name={icon as any} size={28} color={ic} />
        </View>
        <Text style={styles.catName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.catPrice}>From PKR {item.base_price_min.toLocaleString()}</Text>
      </TouchableOpacity>
    );
  }

  function renderBookingCard({ item }: { item: Booking }) {
    const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.cancelled;
    return (
      <View style={styles.bkgCard}>
        <Text style={styles.bkgCategory}>{item.category_name}</Text>
        <Text style={styles.bkgPro} numberOfLines={1}>
          {item.professional_name ?? 'Finding professionals…'}
        </Text>
        <View style={styles.bkgFooter}>
          <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
          </View>
        </View>
      </View>
    );
  }

  const numCols = 2;

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
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>
                {greeting()}, {user?.name?.split(' ')[0]}
              </Text>
              <View style={styles.societyRow}>
                <Ionicons name="location-outline" size={13} color={colors.textMuted} />
                <Text style={styles.societyTag}>
                  {SOCIETY_NAMES[user?.society_id ?? ''] ?? user?.society_id}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
              <Ionicons name="log-out-outline" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Search bar (prototype UI only) */}
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color={colors.textLight} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search services…"
              placeholderTextColor={colors.textLight}
              editable={false}
            />
          </View>
        </View>

        {/* Active bookings */}
        {bookings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Active Bookings</Text>
            <FlatList
              data={bookings}
              keyExtractor={(b) => b.id}
              renderItem={renderBookingCard}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
            />
          </View>
        )}

        {/* Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What do you need today?</Text>
          <FlatList
            data={categories}
            keyExtractor={(c) => c.id}
            renderItem={renderCategoryCard}
            numColumns={numCols}
            scrollEnabled={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
            columnWrapperStyle={{ gap: spacing.md }}
          />
        </View>
      </ScrollView>
      <BottomTabBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  root: { flex: 1 },

  header: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: spacing.lg,
  },
  headerTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  greeting:   { fontSize: 20, fontWeight: '800', color: colors.text },
  societyRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  societyTag: { fontSize: 12, color: colors.textMuted },
  logoutBtn:  { padding: spacing.xs },
  searchBar:  {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.lg, paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, gap: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },

  section:      { marginBottom: spacing.xl },
  sectionTitle: {
    fontSize: 17, fontWeight: '700', color: colors.text,
    paddingHorizontal: spacing.lg, marginBottom: spacing.md,
  },

  catCard: {
    flex: 1, backgroundColor: colors.card,
    borderRadius: radius.lg, padding: spacing.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  catIconBox: { width: 52, height: 52, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  catName:    { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 2 },
  catPrice:   { fontSize: 11, color: colors.textMuted },

  bkgCard: {
    width: 200,
    backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  bkgCategory: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  bkgPro:      { fontSize: 13, color: colors.textMuted, marginBottom: spacing.md },
  bkgFooter:   { flexDirection: 'row', alignItems: 'center' },
  statusBadge: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  statusText:  { fontSize: 11, fontWeight: '600' },
});
