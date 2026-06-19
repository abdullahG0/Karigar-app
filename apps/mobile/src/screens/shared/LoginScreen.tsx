import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../stores/authStore';
import { colors, spacing, radius } from '../../theme';
import type { AuthStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export default function LoginScreen() {
  const navigation = useNavigation<Nav>();
  const { login, isLoading } = useAuthStore();

  const [phone, setPhone]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState('');

  async function handleSubmit() {
    setError('');
    if (!phone.trim() || !password) {
      setError('Please enter your phone number and password.');
      return;
    }
    try {
      await login(phone.trim(), password);
    } catch (err: any) {
      setError(err.message ?? 'Login failed. Please try again.');
    }
  }

  function fillResident()     { setPhone('+92311111001'); setPassword('password123'); setError(''); }
  function fillProfessional() { setPhone('+92322222001'); setPassword('password123'); setError(''); }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand header */}
          <View style={styles.brand}>
            <Image
              source={require('../../../assets/icon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.tagline}>Services at your doorstep</Text>
          </View>

          {/* Form card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome back</Text>
            <Text style={styles.cardSub}>Sign in to your account</Text>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={15} color="#B91C1C" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Phone */}
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Phone Number</Text>
              <View style={styles.inputRow}>
                <Ionicons name="call-outline" size={17} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+92300000000"
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  placeholderTextColor={colors.textLight}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Password</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={17} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPwd}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textLight}
                />
                <TouchableOpacity onPress={() => setShowPwd(!showPwd)} style={styles.eyeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name={showPwd ? 'eye-outline' : 'eye-off-outline'} size={19} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, isLoading && styles.primaryBtnOff]}
              onPress={handleSubmit}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <Text style={styles.primaryBtnText}>Signing in…</Text>
              ) : (
                <View style={styles.btnContent}>
                  <Text style={styles.primaryBtnText}>Sign In</Text>
                  <Ionicons name="arrow-forward" size={18} color={colors.white} />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              style={styles.registerLink}
            >
              <Text style={styles.registerText}>
                Don't have an account?{' '}
                <Text style={styles.registerBold}>Register</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Dev quick-fill */}
          <View style={styles.devRow}>
            <Text style={styles.devLabel}>Dev accounts:</Text>
            <TouchableOpacity onPress={fillResident} style={styles.devBtn}>
              <Ionicons name="person-outline" size={12} color={colors.textMuted} />
              <Text style={styles.devBtnText}>Resident</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={fillProfessional} style={styles.devBtn}>
              <Ionicons name="construct-outline" size={12} color={colors.textMuted} />
              <Text style={styles.devBtnText}>Professional</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, paddingVertical: 32 },

  brand: { alignItems: 'center', marginBottom: 32 },
  logo: {
    width: 160, height: 100,
    marginBottom: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tagline: { fontSize: 13, color: colors.textMuted, marginTop: 3 },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 20,
  },
  cardTitle: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.3, marginBottom: 3 },
  cardSub:   { fontSize: 14, color: colors.textMuted, marginBottom: 20 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
    borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 16,
  },
  errorText: { fontSize: 13, color: '#B91C1C', flex: 1 },

  fieldWrap:  { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 8 },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15, color: colors.text,
  },
  eyeBtn: { paddingLeft: 8, paddingVertical: 4 },

  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  primaryBtnOff: { opacity: 0.6 },
  btnContent:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryBtnText:{ color: colors.white, fontSize: 16, fontWeight: '700' },

  registerLink: { alignItems: 'center', marginTop: 16 },
  registerText: { fontSize: 14, color: colors.textMuted },
  registerBold: { color: colors.primary, fontWeight: '700' },

  devRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  devLabel:  { fontSize: 11, color: colors.textLight },
  devBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: colors.card,
  },
  devBtnText: { fontSize: 11, color: colors.textMuted },
});
