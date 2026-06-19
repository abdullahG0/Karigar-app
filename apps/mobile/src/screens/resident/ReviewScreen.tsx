import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import api from '../../api/client';
import { colors, spacing, radius } from '../../theme';
import type { ResidentStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ResidentStackParamList, 'ReviewScreen'>;

const RATING_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Poor',      color: '#EF4444' },
  2: { label: 'Fair',      color: '#F97316' },
  3: { label: 'Good',      color: '#EAB308' },
  4: { label: 'Great',     color: '#22C55E' },
  5: { label: 'Excellent', color: '#10B981' },
};

const MAX_COMMENT = 300;

export default function ReviewScreen({ route, navigation }: Props) {
  const { booking_id, professional_name } = route.params;

  const [rating, setRating]         = useState(0);
  const [comment, setComment]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    navigation.setOptions({ title: 'Rate your experience' });
  }, [navigation]);

  async function handleSubmit() {
    if (rating === 0) {
      setError('Please select a star rating before submitting.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await api.post('/reviews', {
        booking_id,
        rating,
        comment: comment.trim() || undefined,
      });
      Alert.alert(
        'Thank You',
        'Your feedback helps the community.',
        [{
          text: 'OK',
          onPress: () =>
            navigation.reset({ index: 0, routes: [{ name: 'MyBookings' }] }),
        }]
      );
    } catch (err: any) {
      setError(err.message ?? 'Could not submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const ratingInfo = rating > 0 ? RATING_LABELS[rating] : null;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Who are we rating? */}
        <Text style={styles.proPrompt}>
          How did{' '}
          <Text style={styles.proName}>{professional_name}</Text>
          {' '}do?
        </Text>
        <Text style={styles.helpText}>
          Your review helps other residents in your community.
        </Text>

        {/* Interactive star picker */}
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <TouchableOpacity
              key={n}
              onPress={() => { setRating(n); setError(''); }}
              activeOpacity={0.55}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            >
              <Text style={[styles.star, n <= rating && styles.starFilled]}>★</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Text label below stars */}
        <View style={styles.labelRow}>
          {ratingInfo ? (
            <View style={[styles.labelPill, { backgroundColor: ratingInfo.color + '22' }]}>
              <Text style={[styles.labelText, { color: ratingInfo.color }]}>
                {ratingInfo.label}
              </Text>
            </View>
          ) : (
            <Text style={styles.labelPlaceholder}>Tap a star to rate</Text>
          )}
        </View>

        {/* Comment */}
        <View style={styles.commentWrap}>
          <TextInput
            style={styles.textarea}
            value={comment}
            onChangeText={(t) => setComment(t.slice(0, MAX_COMMENT))}
            placeholder="Share your experience (optional)"
            placeholderTextColor={colors.textLight}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <Text style={[
            styles.charCount,
            comment.length >= MAX_COMMENT && styles.charCountMax,
          ]}>
            {comment.length}/{MAX_COMMENT}
          </Text>
        </View>

        {error ? <Text style={styles.errText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, (submitting || rating === 0) && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={submitting || rating === 0}
          activeOpacity={0.85}
        >
          {submitting
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.btnText}>Submit Review</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.xl, paddingTop: spacing.xxl, paddingBottom: 40 },

  proPrompt: { fontSize: 22, fontWeight: '800', color: colors.text, lineHeight: 30 },
  proName:   { color: colors.primary },
  helpText:  { fontSize: 14, color: colors.textMuted, marginTop: 6, marginBottom: spacing.xxl },

  starsRow: {
    flexDirection: 'row', justifyContent: 'center',
    gap: spacing.lg, marginBottom: spacing.md,
  },
  star:       { fontSize: 48, color: colors.border },
  starFilled: { color: '#F59E0B' },

  labelRow: { alignItems: 'center', marginBottom: spacing.xxl, minHeight: 32 },
  labelPill: { borderRadius: radius.full, paddingHorizontal: spacing.lg, paddingVertical: 6 },
  labelText: { fontSize: 15, fontWeight: '700' },
  labelPlaceholder: { fontSize: 14, color: colors.textLight },

  commentWrap: { backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.md },
  textarea: {
    padding: spacing.md, fontSize: 14, color: colors.text,
    minHeight: 110, textAlignVertical: 'top',
  },
  charCount:    { textAlign: 'right', fontSize: 11, color: colors.textLight, paddingRight: spacing.md, paddingBottom: spacing.sm },
  charCountMax: { color: colors.error },

  errText: { fontSize: 13, color: colors.error, marginBottom: spacing.md, textAlign: 'center' },

  btn: {
    backgroundColor: colors.primary, borderRadius: radius.lg,
    paddingVertical: 15, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.45 },
  btnText:     { fontSize: 16, fontWeight: '700', color: colors.white },
});
