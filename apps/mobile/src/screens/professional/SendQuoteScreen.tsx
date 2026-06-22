import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import api from '../../api/client';
import { colors, spacing, radius } from '../../theme';
import { formatDateTime } from '../../utils/dateUtils';
import type { ProfessionalStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ProfessionalStackParamList, 'SendQuote'>;

interface BookingDetail {
  id: string;
  category_name: string;
  problem_description: string;
  address: string;
  scheduled_at: string;
}

export default function SendQuoteScreen({ route, navigation }: Props) {
  const { booking_id } = route.params;

  const [booking, setBooking]     = useState<BookingDetail | null>(null);
  const [loadingBkg, setLoadingBkg] = useState(true);
  const [amount, setAmount]       = useState('');
  const [note, setNote]           = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors]       = useState<Record<string, string>>({});

  useEffect(() => {
    api.get(`/bookings/${booking_id}`)
      .then((r) => setBooking(r.data))
      .catch(() => {})
      .finally(() => setLoadingBkg(false));
  }, [booking_id]);

  function validate() {
    const e: Record<string, string> = {};
    const n = parseFloat(amount);
    if (!amount.trim() || isNaN(n) || n <= 0) e.amount = 'Enter a valid amount greater than 0.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await api.post('/quotes', {
        booking_id,
        amount: parseFloat(amount),
        note: note.trim() || undefined,
      });
      Alert.alert('Quote Sent', 'The resident will be notified.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      setErrors({ submit: err.message ?? 'Could not send quote. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

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
        {/* Booking details card */}
        <View style={styles.bkgCard}>
          <Text style={styles.bkgLabel}>Booking Details</Text>
          {loadingBkg ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : booking ? (
            <>
              <DetailRow label="Service"   value={booking.category_name} />
              <DetailRow label="Problem"   value={booking.problem_description} />
              <DetailRow label="Address"   value={booking.address} />
              <DetailRow label="Preferred" value={formatDateTime(booking.scheduled_at)} />
            </>
          ) : (
            <Text style={styles.errText}>Could not load booking details.</Text>
          )}
        </View>

        {/* Quote form */}
        <Text style={styles.formTitle}>Your Quote</Text>

        <Text style={styles.fieldLabel}>Amount (PKR) *</Text>
        <TextInput
          style={[styles.input, errors.amount && styles.inputErr]}
          value={amount}
          onChangeText={(t) => {
            setAmount(t);
            setErrors((e) => ({ ...e, amount: '' }));
          }}
          placeholder="e.g. 1500"
          placeholderTextColor={colors.textLight}
          keyboardType="numeric"
        />
        {errors.amount ? <Text style={styles.errText}>{errors.amount}</Text> : null}

        <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>
          Note for the resident (optional)
        </Text>
        <TextInput
          style={[styles.input, styles.noteInput]}
          value={note}
          onChangeText={setNote}
          placeholder="e.g. Includes labor, spare parts extra"
          placeholderTextColor={colors.textLight}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {errors.submit ? (
          <Text style={[styles.errText, { textAlign: 'center', marginBottom: spacing.md }]}>
            {errors.submit}
          </Text>
        ) : null}

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.submitBtnText}>Send Quote</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.xl, paddingBottom: 40 },

  bkgCard: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    padding: spacing.lg, marginBottom: spacing.xl,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  bkgLabel:  { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: spacing.sm },

  detailRow:   { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailLabel: { fontSize: 12, color: colors.textMuted, width: 70 },
  detailValue: { fontSize: 13, color: colors.text, fontWeight: '600', flex: 1 },

  formTitle:  { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: spacing.lg },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },

  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 11,
    fontSize: 15, color: colors.text, backgroundColor: colors.card,
    marginBottom: spacing.xs,
  },
  inputErr:  { borderColor: colors.error },
  noteInput: { minHeight: 80, paddingTop: 11 },

  errText:   { fontSize: 12, color: colors.error, marginBottom: spacing.sm },

  submitBtn: {
    backgroundColor: colors.primary, borderRadius: radius.lg,
    paddingVertical: 15, alignItems: 'center', marginTop: spacing.lg,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText:     { fontSize: 16, fontWeight: '700', color: colors.white },
});
