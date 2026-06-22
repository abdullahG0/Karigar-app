import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import api from '../../api/client';
import Avatar from '../../components/Avatar';
import StarRating from '../../components/StarRating';
import ReviewCard from '../../components/ReviewCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import { colors, spacing, radius } from '../../theme';
import type { ResidentStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ResidentStackParamList, 'ProfessionalDetail'>;
type Nav   = NativeStackNavigationProp<ResidentStackParamList, 'ProfessionalDetail'>;

interface Category { id: string; name: string; icon_name: string }

interface ReviewData {
  id: string;
  rating: number;
  comment: string | null;
  reviewer_name: string;
  created_at: string;
}

interface ProfessionalDetail {
  id: string;
  user_id: string;
  name: string;
  bio: string;
  hourly_rate: number;
  is_available: boolean | number;
  is_verified: boolean | number;
  rating: number;
  total_jobs: number;
  categories: string | Category[];
}

function parseCategories(raw: string | Category[]): Category[] {
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

export default function ProfessionalDetailScreen({ route }: Props) {
  const navigation = useNavigation<Nav>();
  const { professional_id, category_id } = route.params;

  const [pro, setPro]         = useState<ProfessionalDetail | null>(null);
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useFocusEffect(
    useCallback(() => {
      api.get(`/professionals/${professional_id}`)
        .then((res) => {
          setPro(res.data);
          api.get(`/reviews/professional/${res.data.user_id}`)
            .then((r) => setReviews((r.data ?? []).slice(0, 5)))
            .catch(() => {});
        })
        .catch((err) => setError(err.message ?? 'Failed to load'))
        .finally(() => setLoading(false));
    }, [professional_id])
  );

  if (loading) return <LoadingSpinner />;
  if (error || !pro) {
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorText}>{error || 'Professional not found.'}</Text>
      </View>
    );
  }

  const available  = pro.is_available === true || pro.is_available === 1;
  const verified   = pro.is_verified  === true || pro.is_verified  === 1;
  const categories = parseCategories(pro.categories);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile hero */}
        <View style={styles.hero}>
          <Avatar name={pro.name} size={80} />
          <View style={styles.heroInfo}>
            <View style={styles.heroNameRow}>
              <Text style={styles.heroName}>{pro.name}</Text>
              {verified && (
                <Text style={styles.verifiedBadge}>✓ Verified</Text>
              )}
            </View>
            <StarRating rating={pro.rating} size={16} showNumber />
            <Text style={styles.heroJobs}>{pro.total_jobs} jobs completed</Text>

            <View style={styles.heroMeta}>
              <View
                style={[
                  styles.availPill,
                  { backgroundColor: available ? '#D1FAE5' : '#F3F4F6' },
                ]}
              >
                <Text style={[styles.availText, { color: available ? '#065F46' : colors.textMuted }]}>
                  ● {available ? 'Available' : 'Busy'}
                </Text>
              </View>
              <Text style={styles.rateText}>PKR {pro.hourly_rate}/hr</Text>
            </View>
          </View>
        </View>

        {/* Bio */}
        {pro.bio ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bioText}>{pro.bio}</Text>
          </View>
        ) : null}

        {/* Services */}
        {categories.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Services Offered</Text>
            <View style={styles.chipsRow}>
              {categories.map((cat) => (
                <View key={cat.id} style={styles.chip}>
                  <Text style={styles.chipText}>{cat.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Reviews */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Reviews{reviews.length > 0 ? ` (${reviews.length})` : ''}
          </Text>
          {reviews.length === 0 ? (
            <Text style={styles.noReviews}>No reviews yet.</Text>
          ) : (
            reviews.map((r) => (
              <ReviewCard
                key={r.id}
                reviewerName={r.reviewer_name}
                rating={r.rating}
                comment={r.comment}
                createdAt={r.created_at}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* Fixed CTA */}
      <View style={styles.cta}>
        <TouchableOpacity
          style={[styles.ctaBtn, !available && styles.ctaBtnDisabled]}
          activeOpacity={0.85}
          disabled={!available}
          onPress={() =>
            navigation.navigate('CreateBooking', {
              professional_id: pro.user_id,
              professional_name: pro.name,
              category_id,
            })
          }
        >
          <Text style={styles.ctaBtnText}>
            {available ? 'Request This Professional' : 'Currently Unavailable'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: colors.background },
  root:  { flex: 1 },

  errorBox:  { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorText: { fontSize: 15, color: colors.error, textAlign: 'center' },

  hero: {
    flexDirection: 'row', gap: spacing.lg,
    backgroundColor: colors.card,
    padding: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  heroInfo:    { flex: 1, gap: 4 },
  heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  heroName:    { fontSize: 20, fontWeight: '800', color: colors.text },
  verifiedBadge: {
    fontSize: 11, fontWeight: '700', color: '#2563EB',
    backgroundColor: '#DBEAFE', paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: radius.full,
  },
  heroJobs:  { fontSize: 13, color: colors.textMuted },
  heroMeta:  { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 4 },
  availPill: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  availText: { fontSize: 12, fontWeight: '600' },
  rateText:  { fontSize: 14, fontWeight: '700', color: colors.primary },

  section:      { backgroundColor: colors.card, padding: spacing.xl, marginTop: spacing.sm },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: spacing.md },

  bioText: { fontSize: 14, color: colors.textMuted, lineHeight: 21 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip:     {
    backgroundColor: colors.primaryLight, borderRadius: radius.full,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.primary },

  noReviews: { fontSize: 14, color: colors.textMuted },

  cta: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ctaBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg, paddingVertical: 15,
    alignItems: 'center',
  },
  ctaBtnDisabled: { backgroundColor: colors.border },
  ctaBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
});
