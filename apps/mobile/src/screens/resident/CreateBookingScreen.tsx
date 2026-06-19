import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import api from '../../api/client';
import { colors, spacing, radius } from '../../theme';
import type { ResidentStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ResidentStackParamList, 'CreateBooking'>;

interface Category { id: string; name: string; icon_name: string }

function defaultScheduledAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d;
}

function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString('en-PK', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function formatDisplayTime(d: Date): string {
  return d.toLocaleTimeString('en-PK', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export default function CreateBookingScreen({ route, navigation }: Props) {
  const { professional_id, professional_name, category_id: presetCategoryId } = route.params ?? {};

  const [categories, setCategories]           = useState<Category[]>([]);
  const [selectedCat, setSelectedCat]         = useState(presetCategoryId ?? '');
  const [description, setDescription]         = useState('');
  const [address, setAddress]                 = useState('');
  const [scheduledAt, setScheduledAt]         = useState<Date>(defaultScheduledAt);
  const [showDatePicker, setShowDatePicker]   = useState(false);
  const [showTimePicker, setShowTimePicker]   = useState(false);
  // iOS uses a "pending" value while the user spins the wheel; confirmed on Done
  const [pendingDate, setPendingDate]         = useState<Date>(defaultScheduledAt);
  const [iosMode, setIosMode]                 = useState<'date' | 'time'>('date');
  const [errors, setErrors]                   = useState<Record<string, string>>({});
  const [submitting, setSubmitting]           = useState(false);

  const isIos = Platform.OS === 'ios';

  useEffect(() => {
    if (!presetCategoryId) {
      api.get('/categories').then((r) => setCategories(r.data ?? [])).catch(() => {});
    }
  }, [presetCategoryId]);

  function validate() {
    const e: Record<string, string> = {};
    if (!selectedCat)        e.category    = 'Please select a service type.';
    if (!description.trim()) e.description = 'Please describe the problem.';
    if (!address.trim())     e.address     = 'Please enter your address.';
    if (scheduledAt <= new Date()) e.date  = 'Please choose a future date and time.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const { data } = await api.post('/bookings', {
        category_id:         selectedCat,
        problem_description: description.trim(),
        address:             address.trim(),
        scheduled_at:        scheduledAt.toISOString(),
      });
      navigation.replace('BookingDetail', { booking_id: data.id });
    } catch (err: any) {
      setErrors({ submit: err.message ?? 'Could not create booking. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Android: picker is a native dialog; onChange fires and dismisses it ─────

  function onAndroidDateChange(_evt: DateTimePickerEvent, picked?: Date) {
    setShowDatePicker(false);
    if (picked) {
      const merged = new Date(picked);
      merged.setHours(scheduledAt.getHours(), scheduledAt.getMinutes(), 0, 0);
      setScheduledAt(merged);
      setErrors((e) => ({ ...e, date: '' }));
    }
  }

  function onAndroidTimeChange(_evt: DateTimePickerEvent, picked?: Date) {
    setShowTimePicker(false);
    if (picked) {
      const merged = new Date(scheduledAt);
      merged.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
      setScheduledAt(merged);
      setErrors((e) => ({ ...e, date: '' }));
    }
  }

  // ── iOS: picker renders inline inside a bottom sheet Modal ────────────────

  function openIosPicker(mode: 'date' | 'time') {
    setPendingDate(scheduledAt);
    setIosMode(mode);
    if (mode === 'date') setShowDatePicker(true);
    else setShowTimePicker(true);
  }

  function onIosChange(_evt: DateTimePickerEvent, picked?: Date) {
    if (picked) setPendingDate(picked);
  }

  function confirmIos() {
    if (iosMode === 'date') {
      const merged = new Date(pendingDate);
      merged.setHours(scheduledAt.getHours(), scheduledAt.getMinutes(), 0, 0);
      setScheduledAt(merged);
      setShowDatePicker(false);
    } else {
      const merged = new Date(scheduledAt);
      merged.setHours(pendingDate.getHours(), pendingDate.getMinutes(), 0, 0);
      setScheduledAt(merged);
      setShowTimePicker(false);
    }
    setErrors((e) => ({ ...e, date: '' }));
  }

  function cancelIos() {
    setShowDatePicker(false);
    setShowTimePicker(false);
  }

  const btnLabel = professional_id
    ? `Request Quote from ${professional_name ?? 'Professional'}`
    : 'Find Professionals & Get Quotes';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={isIos ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Category selector — shown only if not pre-filled */}
        {!presetCategoryId && (
          <View style={styles.section}>
            <Text style={styles.label}>Service Type</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillRow}
            >
              {categories.length === 0 ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                categories.map((cat) => {
                  const active = selectedCat === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.pill, active && styles.pillActive]}
                      onPress={() => {
                        setSelectedCat(cat.id);
                        setErrors((e) => ({ ...e, category: '' }));
                      }}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.pillText, active && styles.pillTextActive]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
            {errors.category ? <Text style={styles.errText}>{errors.category}</Text> : null}
          </View>
        )}

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.label}>Describe the problem</Text>
          <TextInput
            style={[styles.input, styles.multiline, errors.description && styles.inputErr]}
            value={description}
            onChangeText={(t) => {
              setDescription(t);
              setErrors((e) => ({ ...e, description: '' }));
            }}
            placeholder="E.g. Kitchen tap is leaking badly, needs urgent fix"
            placeholderTextColor={colors.textLight}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          {errors.description ? <Text style={styles.errText}>{errors.description}</Text> : null}
        </View>

        {/* Address */}
        <View style={styles.section}>
          <Text style={styles.label}>Your Address</Text>
          <TextInput
            style={[styles.input, errors.address && styles.inputErr]}
            value={address}
            onChangeText={(t) => {
              setAddress(t);
              setErrors((e) => ({ ...e, address: '' }));
            }}
            placeholder="House #, Block, Street — ParkView City"
            placeholderTextColor={colors.textLight}
          />
          {errors.address ? <Text style={styles.errText}>{errors.address}</Text> : null}
        </View>

        {/* Date & Time */}
        <View style={styles.section}>
          <Text style={styles.label}>Preferred Date & Time</Text>
          <View style={styles.dtRow}>
            {/* Date trigger */}
            <TouchableOpacity
              style={[styles.pickerTrigger, errors.date && styles.pickerTriggerErr, { flex: 3 }]}
              onPress={() => isIos ? openIosPicker('date') : setShowDatePicker(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={16} color={colors.primary} />
              <Text style={styles.pickerText} numberOfLines={1}>
                {formatDisplayDate(scheduledAt)}
              </Text>
            </TouchableOpacity>

            {/* Time trigger */}
            <TouchableOpacity
              style={[styles.pickerTrigger, errors.date && styles.pickerTriggerErr, { flex: 2 }]}
              onPress={() => isIos ? openIosPicker('time') : setShowTimePicker(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="time-outline" size={16} color={colors.primary} />
              <Text style={styles.pickerText}>{formatDisplayTime(scheduledAt)}</Text>
            </TouchableOpacity>
          </View>
          {errors.date ? <Text style={styles.errText}>{errors.date}</Text> : null}
        </View>

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
            : <Text style={styles.submitBtnText}>{btnLabel}</Text>
          }
        </TouchableOpacity>
      </ScrollView>

      {/* Android: native date/time dialog — rendered outside ScrollView so it floats */}
      {!isIos && showDatePicker && (
        <DateTimePicker
          value={scheduledAt}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={onAndroidDateChange}
        />
      )}
      {!isIos && showTimePicker && (
        <DateTimePicker
          value={scheduledAt}
          mode="time"
          display="default"
          is24Hour={false}
          onChange={onAndroidTimeChange}
        />
      )}

      {/* iOS: bottom-sheet modal with spinner picker */}
      {isIos && (showDatePicker || showTimePicker) && (
        <Modal transparent animationType="slide" visible onRequestClose={cancelIos}>
          <View style={styles.iosOverlay}>
            <View style={styles.iosSheet}>
              <View style={styles.iosSheetHeader}>
                <TouchableOpacity onPress={cancelIos}>
                  <Text style={styles.iosCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmIos}>
                  <Text style={styles.iosDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={pendingDate}
                mode={iosMode}
                display="spinner"
                minimumDate={iosMode === 'date' ? new Date() : undefined}
                is24Hour={false}
                onChange={onIosChange}
                style={{ width: '100%' }}
              />
            </View>
          </View>
        </Modal>
      )}
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.xl, paddingBottom: 40 },

  section: { marginBottom: spacing.xl },
  label:   { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },

  pillRow: { paddingBottom: spacing.xs, gap: spacing.sm },
  pill: {
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: colors.card,
  },
  pillActive:     { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  pillText:       { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  pillTextActive: { color: colors.primary },

  input: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 11,
    fontSize: 14, color: colors.text,
    backgroundColor: colors.card,
    marginBottom: spacing.xs,
  },
  inputErr:  { borderColor: colors.error },
  multiline: { minHeight: 100, paddingTop: 11 },

  dtRow: { flexDirection: 'row', gap: spacing.sm },

  pickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 11,
    backgroundColor: colors.card,
  },
  pickerTriggerErr: { borderColor: colors.error },
  pickerText: { fontSize: 14, color: colors.text, flexShrink: 1 },

  errText: { fontSize: 12, color: colors.error, marginTop: 3 },

  submitBtn: {
    backgroundColor: colors.primary, borderRadius: radius.lg,
    paddingVertical: 15, alignItems: 'center', marginTop: spacing.md,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },

  iosOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  iosSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingBottom: 30,
  },
  iosSheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  iosCancelText: { fontSize: 16, color: colors.textMuted },
  iosDoneText:   { fontSize: 16, fontWeight: '700', color: colors.primary },
});
