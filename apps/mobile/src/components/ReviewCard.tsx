import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import StarRating from './StarRating';
import { colors, spacing, radius } from '../theme';

interface Props {
  reviewerName: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatMonth(isoStr: string): string {
  try {
    return new Date(isoStr).toLocaleDateString('en-PK', {
      month: 'long', year: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function ReviewCard({ reviewerName, rating, comment, createdAt }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {/* Grey initials avatar */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(reviewerName)}</Text>
        </View>

        <View style={styles.headerInfo}>
          <Text style={styles.name}>{reviewerName}</Text>
          <Text style={styles.date}>{formatMonth(createdAt)}</Text>
        </View>

        <StarRating rating={rating} size={14} />
      </View>

      {comment ? (
        <Text style={styles.comment}>{comment}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginTop: spacing.md,
  },

  header:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  headerInfo: { flex: 1 },

  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#D1D5DB',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '700', color: '#374151' },

  name:    { fontSize: 14, fontWeight: '600', color: colors.text },
  date:    { fontSize: 11, color: colors.textLight, marginTop: 1 },
  comment: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
});
