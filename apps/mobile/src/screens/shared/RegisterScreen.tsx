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

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

const ROLES = [
  { value: 'resident',     label: 'Resident',     icon: 'person-outline' as const,    desc: 'I need home services' },
  { value: 'professional', label: 'Professional',  icon: 'construct-outline' as const, desc: 'I provide services' },
] as const;

export default function RegisterScreen() {
  const navigation = useNavigation<Nav>();
  const { register, isLoading } = useAuthStore();

  const [name, setName]         = useState('');
  const [phone, setPhone]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [role, setRole]         = useState<'resident' | 'professional'>('resident');
  const [error, setError]       = useState('');

  async function handleSubmit() {
    setError('');
    if (!name.trim() || !phone.trim() || !password) {
      setError('All fields are required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    try {
      await register({ name: name.trim(), phone: phone.trim(), password, role });
    } catch (err: any) {
      setError(err.message ?? 'Registration failed. Please try again.');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('Login')}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>

          <Image
            source={require('../../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Join Karigar</Text>

          {/* Role selector */}
          <Text style={styles.sectionLabel}>I am a…</Text>
          <View style={styles.roleRow}>
            {ROLES.map((r) => {
              const active = role === r.value;
              return (
                <TouchableOpacity
                  key={r.value}
                  style={[styles.roleCard, active && styles.roleCardActive]}
                  onPress={() => setRole(r.value)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.roleIconWrap, active && styles.roleIconWrapActive]}>
                    <Ionicons name={r.icon} size={22} color={active ? colors.primary : colors.textMuted} />
                  </View>
                  <Text style={[styles.roleLabel, active && styles.roleLabelActive]}>{r.label}</Text>
                  <Text style={styles.roleDesc}>{r.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Form */}
          <View style={styles.card}>
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={15} color="#B91C1C" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Full name */}
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Full Name</Text>
              <View style={styles.inputRow}>
                <Ionicons name="person-outline" size={17} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Ali Hassan"
                  placeholderTextColor={colors.textLight}
                  autoCapitalize="words"
                />
              </View>
            </View>

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
                  placeholder="Min. 6 characters"
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
                <Text style={styles.primaryBtnText}>Creating account…</Text>
              ) : (
                <View style={styles.btnContent}>
                  <Text style={styles.primaryBtnText}>Create Account</Text>
                  <Ionicons name="arrow-forward" size={18} color={colors.white} />
                </View>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginLink}>
            <Text style={styles.loginText}>
              Already have an account? <Text style={styles.loginBold}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingBottom: 32, paddingTop: 16 },

  backBtn: { alignSelf: 'flex-start', padding: 4, marginBottom: 16 },
  logo: { width: 140, height: 88, marginBottom: 16, borderRadius: 10, overflow: 'hidden' },
  title:    { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 3, marginBottom: 24 },

  sectionLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 },

  roleRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  roleCard: {
    flex: 1, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.lg, padding: 14,
    backgroundColor: colors.card, alignItems: 'center',
  },
  roleCardActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  roleIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.background,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 8, borderWidth: 1, borderColor: colors.border,
  },
  roleIconWrapActive: { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}40` },
  roleLabel:       { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 2 },
  roleLabelActive: { color: colors.primary },
  roleDesc:        { fontSize: 11, color: colors.textMuted, textAlign: 'center' },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    marginBottom: 20,
  },

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
    borderRadius: radius.md, backgroundColor: colors.background,
    paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 8 },
  input: {
    flex: 1, paddingVertical: 12,
    fontSize: 15, color: colors.text,
  },
  eyeBtn: { paddingLeft: 8, paddingVertical: 4 },

  primaryBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  primaryBtnOff: { opacity: 0.6 },
  btnContent:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryBtnText:{ color: colors.white, fontSize: 16, fontWeight: '700' },

  loginLink: { alignItems: 'center', marginTop: 4 },
  loginText: { fontSize: 14, color: colors.textMuted },
  loginBold: { color: colors.primary, fontWeight: '700' },
});
