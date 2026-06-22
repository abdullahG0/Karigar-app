import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import api from '../../api/client';
import StarRating from '../../components/StarRating';
import { colors, spacing, radius } from '../../theme';
import { formatDateTime } from '../../utils/dateUtils';
import type { ProfessionalStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ProfessionalStackParamList, 'JobDetail'>;

interface Resident { id: string; name: string; phone: string }
interface Review   { id: string; rating: number; comment: string | null; reviewer_name: string }

interface Booking {
  id: string;
  status: string;
  category_name: string;
  problem_description: string;
  address: string;
  scheduled_at: string;
  quote_amount: number | null;
  resident: Resident | null;
  review: Review | null;
}


export default function JobDetailScreen({ route, navigation }: Props) {
  const { booking_id } = route.params;

  const [booking, setBooking]   = useState<Booking | null>(null);
  const [loading, setLoading]   = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchBooking = useCallback(async () => {
    try {
      const { data } = await api.get(`/bookings/${booking_id}`);
      setBooking(data);
    } catch {
      // keep stale
    } finally {
      setLoading(false);
    }
  }, [booking_id]);

  useFocusEffect(useCallback(() => {
    fetchBooking();
  }, [fetchBooking]));

  async function patchStatus(status: string) {
    setUpdating(true);
    try {
      await api.patch(`/bookings/${booking_id}/status`, { status });
      await fetchBooking();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not update status.');
    } finally {
      setUpdating(false);
    }
  }

  function handleComplete() {
    Alert.alert(
      'Mark as Completed?',
      'Confirm that this job is fully done.',
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes, Complete', onPress: () => patchStatus('completed') },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={styles.center}>
        <Text style={styles.errText}>Could not load job.</Text>
      </View>
    );
  }

  // ── Action button ────────────────────────────────────────────────────────────
  let ActionSection: React.ReactNode = null;
  if (booking.status === 'confirmed') {
    ActionSection = (
      <TouchableOpacity
        style={[styles.actionBtn, updating && styles.actionBtnOff]}
        onPress={() => patchStatus('in_progress')}
        disabled={updating}
        activeOpacity={0.85}
      >
        {updating
          ? <ActivityIndicator color={colors.white} />
          : <View style={styles.btnRow}>
              <Ionicons name="construct-outline" size={18} color={colors.white} />
              <Text style={styles.actionBtnText}>Start Job</Text>
            </View>
        }
      </TouchableOpacity>
    );
  } else if (booking.status === 'in_progress') {
    ActionSection = (
      <TouchableOpacity
        style={[styles.actionBtn, styles.actionBtnGreen, updating && styles.actionBtnOff]}
        onPress={handleComplete}
        disabled={updating}
        activeOpacity={0.85}
      >
        {updating
          ? <ActivityIndicator color={colors.white} />
          : <View style={styles.btnRow}>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />
              <Text style={styles.actionBtnText}>Mark as Complete</Text>
            </View>
        }
      </TouchableOpacity>
    );
  } else if (booking.status === 'completed') {
    ActionSection = (
      <View style={styles.completedLabel}>
        <Ionicons name="checkmark-done-circle" size={20} color={colors.success} />
        <Text style={styles.completedText}>Job Completed</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Booking details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Booking Details</Text>
          <DetailRow label="Service"   value={booking.category_name} />
          <DetailRow label="Problem"   value={booking.problem_description} />
          <DetailRow label="Address"   value={booking.address} />
          <DetailRow label="Scheduled" value={formatDateTime(booking.scheduled_at)} />
          {booking.quote_amount != null && (
            <DetailRow label="Amount" value={`PKR ${booking.quote_amount.toLocaleString()}`} />
          )}
        </View>

        {/* Resident contact */}
        {booking.resident && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resident</Text>
            <View style={styles.contactCard}>
              <View style={styles.contactAvatar}>
                <Text style={styles.contactInitials}>
                  {booking.resident.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                </Text>
              </View>
              <View>
                <Text style={styles.contactName}>{booking.resident.name}</Text>
                <Text style={styles.contactPhone}>{booking.resident.phone}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Review received (if completed) */}
        {booking.status === 'completed' && booking.review && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Review Received</Text>
            <StarRating rating={booking.review.rating} size={18} showNumber />
            {booking.review.comment ? (
              <Text style={styles.reviewComment}>{booking.review.comment}</Text>
            ) : null}
          </View>
        )}

        {/* Chat button */}
        {['confirmed', 'in_progress'].includes(booking.status) && booking.resident && (
          <TouchableOpacity
            style={styles.chatBtn}
            activeOpacity={0.85}
            onPress={() =>
              navigation.navigate('ChatScreen', {
                booking_id,
                other_user_name: booking.resident!.name,
              })
            }
          >
            <View style={styles.btnRow}>
              <Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.primary} />
              <Text style={styles.chatBtnText}>Chat with Resident</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Status action */}
        {ActionSection && (
          <View style={styles.actionWrap}>{ActionSection}</View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },
  root:   { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errText:{ fontSize: 15, color: colors.error },

  section:      { backgroundColor: colors.card, padding: spacing.xl, marginBottom: spacing.sm },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: spacing.md },

  detailRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailLabel: { fontSize: 13, color: colors.textMuted, flex: 1 },
  detailValue: { fontSize: 13, color: colors.text, fontWeight: '600', flex: 2, textAlign: 'right' },

  contactCard:    { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  contactAvatar:  { width: 44, height: 44, borderRadius: 22, backgroundColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center' },
  contactInitials:{ fontSize: 16, fontWeight: '700', color: '#374151' },
  contactName:    { fontSize: 15, fontWeight: '600', color: colors.text },
  contactPhone:   { fontSize: 13, color: colors.textMuted, marginTop: 2 },

  reviewComment: { fontSize: 13, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 19 },

  chatBtn: {
    marginHorizontal: spacing.lg, marginVertical: spacing.sm,
    backgroundColor: colors.primaryLight, borderRadius: radius.lg, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1.5, borderColor: colors.primary,
  },
  chatBtnText: { fontSize: 15, fontWeight: '700', color: colors.primary },

  actionWrap: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
  actionBtn: {
    backgroundColor: colors.primary, borderRadius: radius.lg,
    paddingVertical: 15, alignItems: 'center',
  },
  actionBtnGreen: { backgroundColor: colors.success },
  actionBtnOff:   { opacity: 0.6 },
  actionBtnText:  { fontSize: 16, fontWeight: '700', color: colors.white },

  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  completedLabel: {
    flexDirection: 'row', gap: 8,
    borderRadius: radius.lg, paddingVertical: 15,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.border,
  },
  completedText: { fontSize: 16, fontWeight: '700', color: colors.textMuted },
});
