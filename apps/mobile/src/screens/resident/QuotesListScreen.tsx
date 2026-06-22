import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Modal, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import api from '../../api/client';
import Avatar from '../../components/Avatar';
import StarRating from '../../components/StarRating';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { colors, spacing, radius } from '../../theme';
import type { ResidentStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ResidentStackParamList, 'QuotesList'>;

interface Quote {
  id: string;
  booking_id: string;
  professional_id: string;
  professional_name: string;
  professional_rating: number;
  amount: number;
  note: string | null;
  status: string;
}

export default function QuotesListScreen({ route, navigation }: Props) {
  const { booking_id } = route.params;

  const [quotes, setQuotes]           = useState<Quote[]>([]);
  const [loading, setLoading]         = useState(true);
  const [pending, setPending]         = useState<Quote | null>(null); // confirmation sheet
  const [accepting, setAccepting]     = useState(false);

  useFocusEffect(
    useCallback(() => {
      api.get(`/quotes/booking/${booking_id}`)
        .then((r) => setQuotes(r.data ?? []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [booking_id])
  );

  async function acceptQuote() {
    if (!pending) return;
    setAccepting(true);
    try {
      await api.patch(`/quotes/${pending.id}/accept`);
      setPending(null);
      navigation.goBack(); // return to BookingDetail which auto-refreshes on focus
    } catch (err: any) {
      setPending(null);
      // Surface error minimally — booking detail will still show updated state on next poll
    } finally {
      setAccepting(false);
    }
  }

  function renderQuote({ item }: { item: Quote }) {
    const alreadyAccepted = item.status === 'accepted';
    return (
      <View style={styles.card}>
        {/* Header row */}
        <View style={styles.cardHeader}>
          <Avatar name={item.professional_name} size={44} />
          <View style={styles.cardInfo}>
            <Text style={styles.proName}>{item.professional_name}</Text>
            <StarRating rating={item.professional_rating} size={13} showNumber />
          </View>
          <Text style={styles.amount}>PKR {item.amount.toLocaleString()}</Text>
        </View>

        {/* Note */}
        {item.note ? (
          <Text style={styles.note}>{item.note}</Text>
        ) : null}

        {/* Actions */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.viewProfileBtn}
            onPress={() =>
              navigation.navigate('ProfessionalDetail', { professional_id: item.professional_id })
            }
            activeOpacity={0.7}
          >
            <Text style={styles.viewProfileText}>View Profile</Text>
          </TouchableOpacity>

          {!alreadyAccepted && (
            <TouchableOpacity
              style={styles.acceptBtn}
              onPress={() => setPending(item)}
              activeOpacity={0.85}
            >
              <Text style={styles.acceptBtnText}>Accept Quote</Text>
            </TouchableOpacity>
          )}

          {alreadyAccepted && (
            <View style={styles.acceptedPill}>
              <Text style={styles.acceptedPillText}>✓ Accepted</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  if (loading) return <LoadingSpinner />;

  return (
    <View style={styles.root}>
      {quotes.length === 0 ? (
        <EmptyState
          icon="notifications-outline"
          title="No quotes yet"
          subtitle="Professionals will send quotes shortly. Check back in a few minutes."
        />
      ) : (
        <FlatList
          data={quotes}
          keyExtractor={(q) => q.id}
          renderItem={renderQuote}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Confirmation bottom sheet */}
      <Modal
        visible={!!pending}
        transparent
        animationType="slide"
        onRequestClose={() => setPending(null)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => !accepting && setPending(null)}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Accept this quote?</Text>
          {pending && (
            <>
              <Text style={styles.sheetBody}>
                Accept{' '}
                <Text style={styles.sheetBold}>PKR {pending.amount.toLocaleString()}</Text>
                {' '}from{' '}
                <Text style={styles.sheetBold}>{pending.professional_name}</Text>?{'\n'}
                This will confirm your booking.
              </Text>

              <View style={styles.sheetButtons}>
                <TouchableOpacity
                  style={styles.sheetCancelBtn}
                  onPress={() => setPending(null)}
                  disabled={accepting}
                  activeOpacity={0.7}
                >
                  <Text style={styles.sheetCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.sheetConfirmBtn, accepting && styles.sheetConfirmBtnDisabled]}
                  onPress={acceptQuote}
                  disabled={accepting}
                  activeOpacity={0.85}
                >
                  {accepting
                    ? <ActivityIndicator color={colors.white} size="small" />
                    : <Text style={styles.sheetConfirmText}>Confirm</Text>
                  }
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Modal>
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
    shadowOpacity: 0.06, shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  cardInfo:   { flex: 1 },
  proName:    { fontSize: 15, fontWeight: '700', color: colors.text },
  amount:     { fontSize: 20, fontWeight: '800', color: colors.primary },
  note:       { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginBottom: spacing.md },

  cardActions: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'flex-end', gap: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  viewProfileBtn:  { paddingHorizontal: spacing.md, paddingVertical: 8 },
  viewProfileText: { fontSize: 13, color: colors.primary, fontWeight: '600' },

  acceptBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 9,
  },
  acceptBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },

  acceptedPill: {
    backgroundColor: '#D1FAE5', borderRadius: radius.full,
    paddingHorizontal: spacing.md, paddingVertical: 6,
  },
  acceptedPillText: { fontSize: 13, fontWeight: '700', color: '#065F46' },

  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.xxl, paddingBottom: 36,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center', marginBottom: spacing.lg,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  sheetBody:  { fontSize: 15, color: colors.textMuted, lineHeight: 22, marginBottom: spacing.xl },
  sheetBold:  { fontWeight: '700', color: colors.text },

  sheetButtons: { flexDirection: 'row', gap: spacing.md },
  sheetCancelBtn: {
    flex: 1, borderRadius: radius.lg, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1.5, borderColor: colors.border,
  },
  sheetCancelText: { fontSize: 15, fontWeight: '600', color: colors.textMuted },

  sheetConfirmBtn: {
    flex: 1, backgroundColor: colors.primary,
    borderRadius: radius.lg, paddingVertical: 14, alignItems: 'center',
  },
  sheetConfirmBtnDisabled: { opacity: 0.6 },
  sheetConfirmText: { fontSize: 15, fontWeight: '700', color: colors.white },
});
