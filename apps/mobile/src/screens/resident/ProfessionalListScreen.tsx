import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';

import api from '../../api/client';
import Avatar from '../../components/Avatar';
import StarRating from '../../components/StarRating';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { colors, spacing, radius } from '../../theme';
import type { ResidentStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ResidentStackParamList, 'ProfessionalList'>;
type Nav   = NativeStackNavigationProp<ResidentStackParamList, 'ProfessionalList'>;

interface Professional {
  id: string;
  user_id: string;
  name: string;
  bio: string;
  hourly_rate: number;
  is_available: boolean | number;
  rating: number;
  total_jobs: number;
  categories: string | { id: string; name: string }[];
}

export default function ProfessionalListScreen({ navigation: nav, route }: Props) {
  const navigation = useNavigation<Nav>();
  const { category_id, category_name } = route.params;

  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    nav.setOptions({ title: category_name });
    api.get(`/professionals?category_id=${category_id}`)
      .then((res) => setProfessionals(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [category_id]);

  const isAvailable = (p: Professional) =>
    p.is_available === true || p.is_available === 1;

  function renderCard({ item }: { item: Professional }) {
    const available = isAvailable(item);
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() =>
          navigation.navigate('ProfessionalDetail', {
            professional_id: item.id,
            category_id,
          })
        }
      >
        <View style={styles.row}>
          <Avatar name={item.name} size={52} />

          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{item.name}</Text>
              <View
                style={[
                  styles.availPill,
                  { backgroundColor: available ? '#D1FAE5' : '#F3F4F6' },
                ]}
              >
                <Text
                  style={[
                    styles.availText,
                    { color: available ? '#065F46' : colors.textMuted },
                  ]}
                >
                  {available ? 'Available' : 'Busy'}
                </Text>
              </View>
            </View>

            <View style={styles.ratingRow}>
              <StarRating rating={item.rating} size={13} />
              <Text style={styles.jobs}>({item.total_jobs} jobs)</Text>
            </View>

            <Text style={styles.bio} numberOfLines={1}>
              {item.bio || 'Professional service provider'}
            </Text>
          </View>

          <Text style={styles.rate}>PKR {item.hourly_rate}/hr</Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (loading) return <LoadingSpinner />;

  if (professionals.length === 0) {
    return (
      <EmptyState
        icon="people-outline"
        title="No professionals found"
        subtitle={`No professionals are available for ${category_name} right now. Check back soon.`}
      />
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        data={professionals}
        keyExtractor={(p) => p.id}
        renderItem={renderCard}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  row:      { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  info:     { flex: 1, gap: 4 },
  nameRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  name:     { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  ratingRow:{ flexDirection: 'row', alignItems: 'center', gap: 4 },
  jobs:     { fontSize: 12, color: colors.textMuted },
  bio:      { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  rate:     { fontSize: 13, fontWeight: '700', color: colors.primary, marginLeft: spacing.sm, alignSelf: 'center' },
  availPill:{ borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  availText:{ fontSize: 11, fontWeight: '600' },
});
