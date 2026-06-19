import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import api from '../../api/client';
import Avatar from '../../components/Avatar';
import StarRating from '../../components/StarRating';
import { useAuthStore } from '../../stores/authStore';
import { colors, spacing, radius } from '../../theme';
import type { ResidentStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ResidentStackParamList, 'BookingDetail'>;

interface Professional {
  id: string;
  name: string;
  phone: string;
  rating: number;
}

interface Booking {
  id: string;
  status: string;
  category_name: string;
  address: string;
  scheduled_at: string;
  problem_description: string;
  quote_amount: number | null;
  professional_id: string | null;
  professional: Professional | null;
  quotes: { id: string }[];
  review: unknown | null;
}

interface StatusConfig {
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  border: string;
  textColor: string;
  label: string;
  desc: (b: Booking) => string;
}

const STATUS_CONFIGS: Record<string, StatusConfig> = {
  pending_quote: {
    icon: 'time-outline', bg: '#FFF7ED', border: '#FDBA74', textColor: '#C2410C',
    label: 'Waiting for Quotes',
    desc: () => 'Professionals will review your request and send quotes shortly.',
  },
  quoted: {
    icon: 'notifications-outline', bg: '#EFF6FF', border: '#93C5FD', textColor: '#1D4ED8',
    label: 'You Have Quotes',
    desc: (b) =>
      `${b.quotes?.length ?? 1} quote${(b.quotes?.length ?? 1) > 1 ? 's' : ''} received. Tap below to review.`,
  },
  confirmed: {
    icon: 'checkmark-circle-outline', bg: '#F0FDF4', border: '#86EFAC', textColor: '#065F46',
    label: 'Booking Confirmed',
    desc: (b) => `Confirmed with ${b.professional?.name ?? 'your professional'}.`,
  },
  in_progress: {
    icon: 'construct-outline', bg: '#FFFBEB', border: '#FCD34D', textColor: '#B45309',
    label: 'In Progress',
    desc: () => 'Your professional is currently working on the job.',
  },
  completed: {
    icon: 'checkmark-done-circle-outline', bg: '#F0FDF4', border: '#86EFAC', textColor: '#065F46',
    label: 'Job Completed',
    desc: () => 'The job is done. Leave a review to help the community.',
  },
  cancelled: {
    icon: 'close-circle-outline', bg: '#F9FAFB', border: '#E5E7EB', textColor: '#6B7280',
    label: 'Booking Cancelled',
    desc: () => 'This booking was cancelled.',
  },
};

function formatDate(str: string) {
  try {
    return new Date(str).toLocaleString('en-PK', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return str;
  }
}

export default function BookingDetailScreen({ route, navigation }: Props) {
  const { booking_id } = route.params;
  const isResident = useAuthStore((s) => s.user?.role === 'resident');

  const [booking, setBooking]   = useState<Booking | null>(null);
  const [loading, setLoading]   = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const fetchBooking = useCallback(async () => {
    try {
      const { data } = await api.get(`/bookings/${booking_id}`);
      setBooking(data);
    } catch {
      // Keep stale data on error; do not flash an error on polling failures.
    } finally {
      setLoading(false);
    }
  }, [booking_id]);

  // useFocusEffect: start polling when screen is in focus, stop when not.
  useFocusEffect(
    useCallback(() => {
      fetchBooking();
      const interval = setInterval(fetchBooking, 10_000);
      return () => clearInterval(interval);
    }, [fetchBooking])
  );

  function confirmCancel() {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await api.patch(`/bookings/${booking_id}/status`, { status: 'cancelled' });
              fetchBooking();
            } catch (err: any) {
              Alert.alert('Error', err.message ?? 'Could not cancel booking.');
            } finally {
              setCancelling(false);
            }
          },
        },
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
        <Text style={styles.errText}>Could not load booking.</Text>
      </View>
    );
  }

  const cfg = STATUS_CONFIGS[booking.status] ?? STATUS_CONFIGS.cancelled;
  const canCancel  = ['pending_quote', 'quoted', 'confirmed'].includes(booking.status);
  const showQuotes = booking.status === 'quoted';
  const showPro    = ['confirmed', 'in_progress', 'completed'].includes(booking.status);
  const showChat   = ['confirmed', 'in_progress'].includes(booking.status) && !!booking.professional;
  const showReview = booking.status === 'completed' && !booking.review && isResident;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Status card */}
        <View style={[styles.statusCard, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
          <Ionicons name={cfg.icon} size={28} color={cfg.textColor} style={styles.statusIcon} />
          <View style={styles.statusInfo}>
            <Text style={[styles.statusLabel, { color: cfg.textColor }]}>{cfg.label}</Text>
            <Text style={styles.statusDesc}>{cfg.desc(booking)}</Text>
          </View>
        </View>

        {/* Booking details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Booking Details</Text>
          <DetailRow label="Service"   value={booking.category_name} />
          <DetailRow label="Address"   value={booking.address} />
          <DetailRow label="Scheduled" value={formatDate(booking.scheduled_at)} />
          <DetailRow label="Problem"   value={booking.problem_description} />
          {booking.quote_amount != null && (
            <DetailRow label="Agreed Amount" value={`PKR ${booking.quote_amount.toLocaleString()}`} />
          )}
        </View>

        {/* View Quotes button */}
        {showQuotes && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('QuotesList', { booking_id })}
            activeOpacity={0.85}
          >
            <Text style={styles.actionBtnText}>
              🔔 View Quotes ({booking.quotes?.length ?? 0})
            </Text>
          </TouchableOpacity>
        )}

        {/* Professional info card */}
        {showPro && booking.professional && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Professional</Text>
            <View style={styles.proCard}>
              <Avatar name={booking.professional.name} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={styles.proName}>{booking.professional.name}</Text>
                <StarRating rating={booking.professional.rating} size={13} showNumber />
                <Text style={styles.proPhone}>{booking.professional.phone}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Open Chat */}
        {showChat && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() =>
              navigation.navigate('ChatScreen', {
                booking_id,
                other_user_name: booking.professional!.name,
              })
            }
            activeOpacity={0.85}
          >
            <Text style={styles.actionBtnText}>💬 Open Chat</Text>
          </TouchableOpacity>
        )}

        {/* Leave a Review */}
        {showReview && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnAccent]}
            onPress={() =>
              navigation.navigate('ReviewScreen', {
                booking_id,
                professional_name: booking.professional?.name ?? 'the professional',
              })
            }
            activeOpacity={0.85}
          >
            <Text style={[styles.actionBtnText, { color: colors.white }]}>⭐ Leave a Review</Text>
          </TouchableOpacity>
        )}

        {/* Cancel Booking */}
        {canCancel && (
          <TouchableOpacity
            style={[styles.cancelBtn, cancelling && styles.cancelBtnDisabled]}
            onPress={confirmCancel}
            disabled={cancelling}
            activeOpacity={0.8}
          >
            {cancelling
              ? <ActivityIndicator size="small" color={colors.error} />
              : <Text style={styles.cancelBtnText}>Cancel Booking</Text>
            }
          </TouchableOpacity>
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

  statusCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.lg,
    margin: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    padding: spacing.xl,
  },
  statusIcon:  { fontSize: 36 },
  statusInfo:  { flex: 1 },
  statusLabel: { fontSize: 17, fontWeight: '800' },
  statusDesc:  { fontSize: 13, color: colors.textMuted, marginTop: 3 },

  section:      { backgroundColor: colors.card, padding: spacing.xl, marginBottom: spacing.sm },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: spacing.md },

  detailRow:   {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  detailLabel: { fontSize: 13, color: colors.textMuted, flex: 1 },
  detailValue: { fontSize: 13, color: colors.text, fontWeight: '600', flex: 2, textAlign: 'right' },

  proCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
  },
  proName:  { fontSize: 15, fontWeight: '700', color: colors.text },
  proPhone: { fontSize: 13, color: colors.textMuted, marginTop: 3 },

  actionBtn: {
    marginHorizontal: spacing.lg, marginBottom: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg, paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.primary,
  },
  actionBtnAccent: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  actionBtnText: { fontSize: 15, fontWeight: '700', color: colors.primary },

  cancelBtn: {
    marginHorizontal: spacing.lg, marginTop: spacing.lg,
    borderRadius: radius.lg, paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.error,
  },
  cancelBtnDisabled: { opacity: 0.5 },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: colors.error },
});
